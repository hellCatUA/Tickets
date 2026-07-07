import {
  BadRequestException,
  ForbiddenException,
  forwardRef,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import {
  AttachmentDto,
  CommentDto,
  CreateTicketDto,
  DashboardAlertDto,
  DashboardDto,
  formatTicketNumber,
  FormField,
  FormValues,
  MeDto,
  Role,
  TicketDetailDto,
  TicketEventDto,
  TicketListDto,
  TicketPriority,
  TicketStatus,
  TicketSummaryDto,
  UserRefDto,
  validateFormValues,
} from '@tickets/shared';
import { Brackets, DataSource, In, Repository, SelectQueryBuilder } from 'typeorm';
import { CategoriesService } from '../categories/categories.service';
import { AssetObject } from '../entities/asset-object.entity';
import { Attachment } from '../entities/attachment.entity';
import { Category } from '../entities/category.entity';
import { Location } from '../entities/location.entity';
import { Comment } from '../entities/comment.entity';
import { Ticket } from '../entities/ticket.entity';
import { TicketEvent } from '../entities/ticket-event.entity';
import { User } from '../entities/user.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { TicketsGateway } from './tickets.gateway';

const OPEN_STATUSES: TicketStatus[] = [
  TicketStatus.New,
  TicketStatus.InProgress,
  TicketStatus.WaitingForRequester,
  TicketStatus.WaitingForVendor,
];

const STALE_AFTER_DAYS = 7;

export interface ListFilters {
  status?: TicketStatus;
  categoryId?: string;
  assigneeId?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

const OPEN_TRANSITION_TIMESTAMPS: Partial<Record<TicketStatus, 'resolvedAt' | 'closedAt'>> = {
  [TicketStatus.Resolved]: 'resolvedAt',
  [TicketStatus.Closed]: 'closedAt',
};

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(TicketEvent) private readonly events: Repository<TicketEvent>,
    @InjectRepository(Comment) private readonly comments: Repository<Comment>,
    @InjectRepository(Attachment) private readonly attachments: Repository<Attachment>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    @InjectRepository(AssetObject) private readonly objects: Repository<AssetObject>,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly categories: CategoriesService,
    @Inject(forwardRef(() => TicketsGateway)) private readonly gateway: TicketsGateway,
    @Inject(forwardRef(() => NotificationsService))
    private readonly notifications: NotificationsService,
  ) {}

  /** Notify ticket participants (requester + assignee) except the actor. */
  private async notifyParticipants(
    ticket: Ticket,
    actorId: string,
    input: { type: string; title: string; body?: string },
    opts?: { staffOnly?: boolean },
  ): Promise<void> {
    const ids = new Set<string>();
    if (!opts?.staffOnly) ids.add(ticket.requesterId);
    if (ticket.assigneeId) ids.add(ticket.assigneeId);
    ids.delete(actorId);
    await this.notifications.createForUsers([...ids], { ...input, ticketId: ticket.id });
  }

  // ---------- access helpers ----------

  private isManager(me: MeDto): boolean {
    return me.roles.includes(Role.Manager);
  }

  private isAgent(me: MeDto): boolean {
    return me.roles.includes(Role.Agent);
  }

  /** Categories this user's groups are assigned to as agents. */
  private async agentCategoryIds(me: MeDto): Promise<string[]> {
    if (!this.isAgent(me) || me.groups.length === 0) return [];
    const rows: Array<{ id: string }> = await this.dataSource.query(
      'SELECT id FROM categories WHERE "agentGroups" ?| $1',
      [me.groups],
    );
    return rows.map((r) => r.id);
  }

  private async isStaffFor(me: MeDto, ticket: Ticket): Promise<boolean> {
    if (this.isManager(me)) return true;
    if (!this.isAgent(me)) return false;
    const cats = await this.agentCategoryIds(me);
    return cats.includes(ticket.categoryId) || ticket.assigneeId === me.id;
  }

  private async canView(me: MeDto, ticket: Ticket): Promise<boolean> {
    if (ticket.requesterId === me.id) return true;
    return this.isStaffFor(me, ticket);
  }

  async assertCanView(me: MeDto, ticketId: string): Promise<Ticket> {
    const ticket = await this.tickets.findOne({ where: { id: ticketId } });
    if (!ticket || !(await this.canView(me, ticket))) {
      throw new NotFoundException('Ticket not found');
    }
    return ticket;
  }

  /** Fresh query builder limited to what this user may see. */
  private async scopedQb(me: MeDto): Promise<SelectQueryBuilder<Ticket>> {
    const qb = this.tickets.createQueryBuilder('t');
    if (!this.isManager(me)) {
      const cats = await this.agentCategoryIds(me);
      qb.andWhere(
        new Brackets((w) => {
          w.where('t.requesterId = :uid', { uid: me.id }).orWhere('t.assigneeId = :uid');
          if (cats.length > 0) w.orWhere('t.categoryId IN (:...cats)', { cats });
        }),
      );
    }
    return qb;
  }

  // ---------- commands ----------

  /**
   * Priority precedence: form-value rules (first match) → requester's choice
   * (only when the category allows it) → the category default.
   */
  private resolvePriority(
    category: Category,
    fields: FormField[],
    dto: CreateTicketDto,
    formValues: FormValues,
  ): TicketPriority {
    for (const rule of category.priorityRules ?? []) {
      if (!fields.some((f) => f.key === rule.field)) continue;
      const value = formValues[rule.field];
      const matches = Array.isArray(value)
        ? value.map(String).includes(String(rule.equals))
        : String(value) === String(rule.equals);
      if (matches) return rule.priority;
    }
    if (
      category.allowRequesterPriority &&
      dto.priority &&
      Object.values(TicketPriority).includes(dto.priority)
    ) {
      return dto.priority;
    }
    return category.defaultPriority;
  }

  async create(me: MeDto, dto: CreateTicketDto): Promise<TicketDetailDto> {
    if (!dto.title?.trim()) throw new BadRequestException('Title is required');
    const { category, schema } = await this.categories.getCategoryWithSchema(dto.categoryId);
    if (!category.active) throw new BadRequestException('Category is not active');
    const formValues = dto.formValues ?? {};
    const errors = validateFormValues(schema.fields, formValues);
    if (errors.length > 0) throw new BadRequestException(errors.join('; '));
    const priority = this.resolvePriority(category, schema.fields, dto, formValues);

    let locationId = dto.locationId ?? null;
    const objectId = dto.objectId ?? null;
    if (category.objectRequired && !objectId) {
      throw new BadRequestException('This category requires selecting an object/device');
    }
    if (objectId) {
      const object = await this.objects.findOne({ where: { id: objectId, active: true } });
      if (!object) throw new BadRequestException('Unknown object');
      if (category.objectFamilies.length > 0 && !category.objectFamilies.includes(object.familyId)) {
        throw new BadRequestException('This category does not apply to that device type');
      }
      // The object's own location wins when none was picked explicitly.
      if (!locationId) locationId = object.locationId;
    }
    if (locationId && !(await this.locations.findOne({ where: { id: locationId } }))) {
      throw new BadRequestException('Unknown location');
    }

    const ticket = await this.dataSource.transaction(async (em) => {
      const year = new Date().getFullYear();
      const [counter]: Array<{ seq: number }> = await em.query(
        `INSERT INTO ticket_counters(year, seq) VALUES ($1, 1)
         ON CONFLICT (year) DO UPDATE SET seq = ticket_counters.seq + 1
         RETURNING seq`,
        [year],
      );
      const created = await em.save(
        em.create(Ticket, {
          ticketNo: formatTicketNumber(year, counter.seq),
          year,
          seq: counter.seq,
          categoryId: category.id,
          formSchemaId: schema.id,
          title: dto.title.trim(),
          description: dto.description ?? '',
          status: TicketStatus.New,
          priority,
          requesterId: me.id,
          formValues,
          locationId,
          objectId,
        }),
      );
      await em.save(
        em.create(TicketEvent, {
          ticketId: created.id,
          type: 'created',
          actorId: me.id,
          payload: { ticketNo: created.ticketNo },
        }),
      );
      return created;
    });

    return this.getDetail(me, ticket.id);
  }

  async list(me: MeDto, filters: ListFilters): Promise<TicketListDto> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));

    const qb = (await this.scopedQb(me))
      .leftJoinAndSelect('t.requester', 'requester')
      .leftJoinAndSelect('t.assignee', 'assignee')
      .leftJoinAndSelect('t.category', 'category')
      .leftJoinAndSelect('t.location', 'location')
      .leftJoinAndSelect('t.object', 'object');

    if (filters.status) qb.andWhere('t.status = :status', { status: filters.status });
    if (filters.categoryId) qb.andWhere('t.categoryId = :cat', { cat: filters.categoryId });
    if (filters.assigneeId) qb.andWhere('t.assigneeId = :assignee', { assignee: filters.assigneeId });
    if (filters.q?.trim()) {
      qb.andWhere('(t.title ILIKE :q OR t.ticketNo ILIKE :q)', { q: `%${filters.q.trim()}%` });
    }

    qb.orderBy('t.updatedAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map((t) => this.toSummary(t)), total, page, pageSize };
  }

  async dashboard(me: MeDto): Promise<DashboardDto> {
    const staff = this.isManager(me) || (await this.agentCategoryIds(me)).length > 0;

    const statusRows = await (await this.scopedQb(me))
      .select('t.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .andWhere('t.status IN (:...open)', { open: OPEN_STATUSES })
      .groupBy('t.status')
      .getRawMany<{ status: TicketStatus; count: string }>();
    const openByStatus: Partial<Record<TicketStatus, number>> = {};
    let openTotal = 0;
    for (const row of statusRows) {
      openByStatus[row.status] = Number(row.count);
      openTotal += Number(row.count);
    }

    const [myAssignedOpen, myRequestedOpen, waitingOnYou] = await Promise.all([
      this.tickets.count({ where: { assigneeId: me.id, status: In(OPEN_STATUSES) } }),
      this.tickets.count({ where: { requesterId: me.id, status: In(OPEN_STATUSES) } }),
      this.tickets.count({
        where: { requesterId: me.id, status: TicketStatus.WaitingForRequester },
      }),
    ]);

    const alerts: DashboardAlertDto[] = [];
    if (staff) {
      const staleCut = new Date(Date.now() - STALE_AFTER_DAYS * 24 * 60 * 60 * 1000);
      const [unassigned, criticalOpen, stale] = await Promise.all([
        (await this.scopedQb(me))
          .andWhere('t.assigneeId IS NULL')
          .andWhere('t.status IN (:...open)', { open: OPEN_STATUSES })
          .getCount(),
        (await this.scopedQb(me))
          .andWhere('t.priority = :p', { p: TicketPriority.Critical })
          .andWhere('t.status IN (:...open)', { open: OPEN_STATUSES })
          .getCount(),
        (await this.scopedQb(me))
          .andWhere('t.status IN (:...open)', { open: OPEN_STATUSES })
          .andWhere('t.updatedAt < :cut', { cut: staleCut })
          .getCount(),
      ]);
      if (criticalOpen > 0) alerts.push({ kind: 'critical_open', count: criticalOpen });
      if (unassigned > 0) alerts.push({ kind: 'unassigned', count: unassigned });
      if (stale > 0) alerts.push({ kind: 'stale', count: stale });
    }
    if (waitingOnYou > 0) alerts.push({ kind: 'waiting_on_you', count: waitingOnYou });

    const recent = await (await this.scopedQb(me))
      .leftJoinAndSelect('t.requester', 'requester')
      .leftJoinAndSelect('t.assignee', 'assignee')
      .leftJoinAndSelect('t.category', 'category')
      .andWhere('t.status IN (:...open)', { open: OPEN_STATUSES })
      .orderBy('t.updatedAt', 'DESC')
      .take(6)
      .getMany();

    return {
      staff,
      openTotal,
      openByStatus,
      myAssignedOpen,
      myRequestedOpen,
      alerts,
      recent: recent.map((t) => this.toSummary(t)),
    };
  }

  async getDetail(me: MeDto, id: string): Promise<TicketDetailDto> {
    const ticket = await this.tickets.findOne({
      where: { id },
      relations: { requester: true, assignee: true, category: true, location: true, object: true },
    });
    if (!ticket || !(await this.canView(me, ticket))) {
      throw new NotFoundException('Ticket not found');
    }
    const staff = await this.isStaffFor(me, ticket);

    const [schemaMap, events, comments, attachments] = await Promise.all([
      this.categories.getSchemasByIds([ticket.formSchemaId]),
      this.events.find({
        where: { ticketId: id },
        relations: { actor: true },
        order: { createdAt: 'ASC' },
      }),
      this.comments.find({
        where: { ticketId: id },
        relations: { author: true },
        order: { createdAt: 'ASC' },
      }),
      this.attachments.find({
        where: { ticketId: id },
        relations: { uploader: true },
        order: { createdAt: 'ASC' },
      }),
    ]);

    const visibleComments = comments.filter((c) => staff || !c.internal);
    const internalCommentIds = new Set(comments.filter((c) => c.internal).map((c) => c.id));
    const visibleEvents = events.filter(
      (e) =>
        staff ||
        !(e.type === 'comment_added' && internalCommentIds.has(e.payload.commentId as string)),
    );

    return {
      ...this.toSummary(ticket),
      description: ticket.description,
      formFields: schemaMap.get(ticket.formSchemaId)?.fields ?? [],
      formValues: ticket.formValues,
      events: visibleEvents.map((e) => this.toEventDto(e)),
      comments: visibleComments.map((c) => this.toCommentDto(c)),
      attachments: attachments.map((a) => this.toAttachmentDto(a)),
      canManage: staff,
      canComment: true,
      canInternal: staff,
    };
  }

  async changeStatus(me: MeDto, id: string, status: TicketStatus): Promise<TicketDetailDto> {
    if (!Object.values(TicketStatus).includes(status)) {
      throw new BadRequestException('Unknown status');
    }
    const ticket = await this.assertCanView(me, id);
    if (!(await this.isStaffFor(me, ticket))) {
      throw new ForbiddenException('Not allowed to change status');
    }
    if (ticket.status === status) return this.getDetail(me, id);

    const from = ticket.status;
    ticket.status = status;
    const stampField = OPEN_TRANSITION_TIMESTAMPS[status];
    if (stampField) ticket[stampField] = new Date();
    await this.tickets.save(ticket);
    await this.addEvent(ticket.id, 'status_changed', me.id, { from, to: status });
    await this.notifyParticipants(ticket, me.id, {
      type: 'status',
      title: `${ticket.ticketNo} is now ${status.replaceAll('_', ' ')}`,
      body: ticket.title,
    });
    return this.getDetail(me, id);
  }

  async assign(me: MeDto, id: string, assigneeId: string | null): Promise<TicketDetailDto> {
    const ticket = await this.assertCanView(me, id);
    const staff = await this.isStaffFor(me, ticket);
    if (!staff) throw new ForbiddenException('Not allowed to assign');
    // Agents may only take tickets themselves; managers assign anyone.
    if (!this.isManager(me) && assigneeId !== me.id && assigneeId !== null) {
      throw new ForbiddenException('Agents can only assign tickets to themselves');
    }
    let assignee: User | null = null;
    if (assigneeId) {
      assignee = await this.users.findOne({ where: { id: assigneeId, active: true } });
      if (!assignee) throw new BadRequestException('Assignee not found');
    }
    if (ticket.assigneeId === assigneeId) return this.getDetail(me, id);
    ticket.assigneeId = assigneeId;
    await this.tickets.save(ticket);
    await this.addEvent(ticket.id, 'assigned', me.id, {
      assigneeId,
      assigneeName: assignee?.displayName ?? null,
    });
    await this.notifyParticipants(ticket, me.id, {
      type: 'assigned',
      title: assignee
        ? `${ticket.ticketNo} assigned to ${assignee.displayName}`
        : `${ticket.ticketNo} is now unassigned`,
      body: ticket.title,
    });
    return this.getDetail(me, id);
  }

  async setPriority(me: MeDto, id: string, priority: TicketPriority): Promise<TicketDetailDto> {
    if (!Object.values(TicketPriority).includes(priority)) {
      throw new BadRequestException('Unknown priority');
    }
    const ticket = await this.assertCanView(me, id);
    if (!(await this.isStaffFor(me, ticket))) {
      throw new ForbiddenException('Not allowed to change priority');
    }
    if (ticket.priority === priority) return this.getDetail(me, id);
    const from = ticket.priority;
    ticket.priority = priority;
    await this.tickets.save(ticket);
    await this.addEvent(ticket.id, 'priority_changed', me.id, { from, to: priority });
    return this.getDetail(me, id);
  }

  /** Staff can move a ticket to another category (e.g. after triage). */
  async changeCategory(me: MeDto, id: string, categoryId: string): Promise<TicketDetailDto> {
    const ticket = await this.assertCanView(me, id);
    if (!(await this.isStaffFor(me, ticket))) {
      throw new ForbiddenException('Not allowed to change the category');
    }
    if (ticket.categoryId === categoryId) return this.getDetail(me, id);
    const { category, schema } = await this.categories.getCategoryWithSchema(categoryId);
    if (!category.active) throw new BadRequestException('Category is not active');
    if (category.objectRequired && !ticket.objectId) {
      throw new BadRequestException('That category requires an object — attach a device first');
    }
    if (ticket.objectId && category.objectFamilies.length > 0) {
      const object = await this.objects.findOne({ where: { id: ticket.objectId } });
      if (object && !category.objectFamilies.includes(object.familyId)) {
        throw new BadRequestException(
          'That category does not apply to the attached device — change the device first',
        );
      }
    }
    const previous = await this.categories.getCategoryWithSchema(ticket.categoryId);
    const fromName = previous.category.name;
    ticket.categoryId = category.id;
    // Adopt the new category's current form; matching keys keep their values.
    ticket.formSchemaId = schema.id;
    await this.tickets.save(ticket);
    await this.addEvent(id, 'category_changed', me.id, { from: fromName, to: category.name });
    return this.getDetail(me, id);
  }

  /** Staff can attach, replace or detach the device on a ticket. */
  async changeObject(me: MeDto, id: string, objectId: string | null): Promise<TicketDetailDto> {
    const ticket = await this.assertCanView(me, id);
    if (!(await this.isStaffFor(me, ticket))) {
      throw new ForbiddenException('Not allowed to change the object');
    }
    if (ticket.objectId === objectId) return this.getDetail(me, id);
    const { category } = await this.categories.getCategoryWithSchema(ticket.categoryId);
    const previous = ticket.objectId
      ? await this.objects.findOne({ where: { id: ticket.objectId } })
      : null;
    let toName: string | null = null;
    if (objectId) {
      const object = await this.objects.findOne({ where: { id: objectId, active: true } });
      if (!object) throw new BadRequestException('Unknown object');
      if (
        category.objectFamilies.length > 0 &&
        !category.objectFamilies.includes(object.familyId)
      ) {
        throw new BadRequestException("The ticket's category does not apply to that device type");
      }
      toName = object.name;
      ticket.objectId = objectId;
      // The device's own location is authoritative when it has one.
      if (object.locationId) ticket.locationId = object.locationId;
    } else {
      if (category.objectRequired) {
        throw new BadRequestException("The ticket's category requires an object");
      }
      ticket.objectId = null;
    }
    await this.tickets.save(ticket);
    await this.addEvent(id, 'object_changed', me.id, { from: previous?.name ?? null, to: toName });
    return this.getDetail(me, id);
  }

  async addComment(me: MeDto, id: string, body: string, internal: boolean): Promise<CommentDto> {
    if (!body?.trim()) throw new BadRequestException('Comment cannot be empty');
    const ticket = await this.assertCanView(me, id);
    if (internal && !(await this.isStaffFor(me, ticket))) {
      throw new ForbiddenException('Internal notes are staff-only');
    }
    const comment = await this.comments.save(
      this.comments.create({ ticketId: id, authorId: me.id, body: body.trim(), internal }),
    );
    comment.author = (await this.users.findOneBy({ id: me.id }))!;
    // Requester replies while waiting flip the ticket back to In Progress.
    if (
      !internal &&
      ticket.requesterId === me.id &&
      ticket.status === TicketStatus.WaitingForRequester
    ) {
      ticket.status = TicketStatus.InProgress;
      await this.tickets.save(ticket);
      await this.addEvent(id, 'status_changed', me.id, {
        from: TicketStatus.WaitingForRequester,
        to: TicketStatus.InProgress,
        auto: true,
      });
    }
    await this.addEvent(id, 'comment_added', me.id, { commentId: comment.id, internal });
    await this.notifyParticipants(
      ticket,
      me.id,
      {
        type: 'comment',
        title: `${me.displayName} commented on ${ticket.ticketNo}`,
        body: body.trim().slice(0, 140),
      },
      { staffOnly: internal },
    );
    return this.toCommentDto(comment);
  }

  async registerAttachment(
    me: MeDto,
    ticketId: string,
    meta: { filename: string; storedName: string; mimeType: string; size: number },
  ): Promise<AttachmentDto> {
    await this.assertCanView(me, ticketId);
    const attachment = await this.attachments.save(
      this.attachments.create({ ticketId, uploaderId: me.id, ...meta }),
    );
    attachment.uploader = (await this.users.findOneBy({ id: me.id }))!;
    await this.addEvent(ticketId, 'attachment_added', me.id, {
      attachmentId: attachment.id,
      filename: meta.filename,
    });
    return this.toAttachmentDto(attachment);
  }

  async getAttachmentForDownload(me: MeDto, attachmentId: string): Promise<Attachment> {
    const attachment = await this.attachments.findOne({ where: { id: attachmentId } });
    if (!attachment) throw new NotFoundException('Attachment not found');
    await this.assertCanView(me, attachment.ticketId);
    return attachment;
  }

  private async addEvent(
    ticketId: string,
    type: string,
    actorId: string | null,
    payload: Record<string, unknown>,
  ): Promise<void> {
    await this.events.save(this.events.create({ ticketId, type, actorId, payload }));
    this.gateway.emitTicketUpdate(ticketId, { type });
  }

  // ---------- mapping ----------

  private toUserRef(user: User | null | undefined): UserRefDto | null {
    return user ? { id: user.id, displayName: user.displayName } : null;
  }

  private toSummary(t: Ticket): TicketSummaryDto {
    return {
      id: t.id,
      ticketNo: t.ticketNo,
      title: t.title,
      status: t.status,
      priority: t.priority,
      categoryId: t.categoryId,
      categoryName: t.category?.name ?? '',
      requester: this.toUserRef(t.requester) ?? { id: t.requesterId, displayName: '?' },
      assignee: this.toUserRef(t.assignee),
      locationId: t.locationId ?? null,
      locationName: t.location?.name ?? null,
      objectId: t.objectId ?? null,
      objectName: t.object?.name ?? null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    };
  }

  private toEventDto(e: TicketEvent): TicketEventDto {
    return {
      id: e.id,
      type: e.type,
      actor: this.toUserRef(e.actor),
      payload: e.payload,
      createdAt: e.createdAt.toISOString(),
    };
  }

  private toCommentDto(c: Comment): CommentDto {
    return {
      id: c.id,
      author: this.toUserRef(c.author) ?? { id: c.authorId, displayName: '?' },
      body: c.body,
      internal: c.internal,
      createdAt: c.createdAt.toISOString(),
    };
  }

  private toAttachmentDto(a: Attachment): AttachmentDto {
    return {
      id: a.id,
      filename: a.filename,
      mimeType: a.mimeType,
      size: a.size,
      uploader: this.toUserRef(a.uploader) ?? { id: a.uploaderId, displayName: '?' },
      createdAt: a.createdAt.toISOString(),
    };
  }
}
