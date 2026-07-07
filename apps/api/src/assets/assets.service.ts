import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AssetObjectDto,
  AssetObjectSummaryDto,
  FormField,
  FormValues,
  LocationDto,
  ObjectByTokenDto,
  ObjectFamilyDto,
  ObjectHistoryDto,
  ProblemDto,
  ServiceLogEntryDto,
  TicketPriority,
  validateFormFields,
  validateFormValues,
} from '@tickets/shared';
import { randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { AssetObject } from '../entities/asset-object.entity';
import { Category } from '../entities/category.entity';
import { Location } from '../entities/location.entity';
import { ObjectFamily } from '../entities/object-family.entity';
import { Problem } from '../entities/problem.entity';
import { ServiceLogEntry } from '../entities/service-log-entry.entity';
import { Ticket } from '../entities/ticket.entity';
import { User } from '../entities/user.entity';

@Injectable()
export class AssetsService {
  constructor(
    @InjectRepository(Location) private readonly locations: Repository<Location>,
    @InjectRepository(ObjectFamily) private readonly families: Repository<ObjectFamily>,
    @InjectRepository(AssetObject) private readonly objects: Repository<AssetObject>,
    @InjectRepository(ServiceLogEntry) private readonly serviceLog: Repository<ServiceLogEntry>,
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(User) private readonly users: Repository<User>,
    @InjectRepository(Problem) private readonly problems: Repository<Problem>,
    @InjectRepository(Category) private readonly categories: Repository<Category>,
  ) {}

  // ---------- problems ----------

  async listProblems(familyId?: string, includeInactive = false): Promise<ProblemDto[]> {
    const qb = this.problems
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.family', 'family')
      .orderBy('p.sortOrder', 'ASC')
      .addOrderBy('p.name', 'ASC');
    if (!includeInactive) qb.andWhere('p.active = true');
    if (familyId) qb.andWhere('p.familyId = :familyId', { familyId });
    const rows = await qb.getMany();
    return rows.map((p) => this.toProblemDto(p));
  }

  async saveProblem(
    id: string | null,
    dto: {
      familyId?: string;
      name?: string;
      description?: string;
      categoryId?: string;
      priority?: TicketPriority | null;
      active?: boolean;
      sortOrder?: number;
    },
  ): Promise<ProblemDto> {
    let problem = id
      ? await this.problems.findOne({ where: { id }, relations: { family: true } })
      : null;
    if (id && !problem) throw new NotFoundException('Problem not found');
    const categoryId = dto.categoryId ?? problem?.categoryId;
    if (categoryId && !(await this.categories.findOne({ where: { id: categoryId } }))) {
      throw new BadRequestException('Unknown category');
    }
    if (
      dto.priority !== undefined &&
      dto.priority !== null &&
      !Object.values(TicketPriority).includes(dto.priority)
    ) {
      throw new BadRequestException('Unknown priority');
    }
    if (!problem) {
      if (!dto.familyId || !(await this.families.findOne({ where: { id: dto.familyId } }))) {
        throw new BadRequestException('Unknown family');
      }
      if (!dto.name?.trim()) throw new BadRequestException('Name is required');
      if (!categoryId) throw new BadRequestException('Category is required');
      problem = this.problems.create({
        familyId: dto.familyId,
        name: dto.name.trim(),
        description: dto.description ?? '',
        categoryId,
        priority: dto.priority ?? null,
        sortOrder: dto.sortOrder ?? 0,
      });
    } else {
      if (dto.name !== undefined) problem.name = dto.name.trim() || problem.name;
      if (dto.description !== undefined) problem.description = dto.description;
      if (categoryId) problem.categoryId = categoryId;
      if (dto.priority !== undefined) problem.priority = dto.priority;
      if (dto.active !== undefined) problem.active = dto.active;
      if (dto.sortOrder !== undefined) problem.sortOrder = dto.sortOrder;
    }
    const saved = await this.problems.save(problem);
    saved.family ??= (await this.families.findOne({ where: { id: saved.familyId } }))!;
    return this.toProblemDto(saved);
  }

  private toProblemDto(p: Problem): ProblemDto {
    return {
      id: p.id,
      familyId: p.familyId,
      familyName: p.family?.name ?? '',
      name: p.name,
      description: p.description,
      categoryId: p.categoryId,
      priority: p.priority,
      active: p.active,
      sortOrder: p.sortOrder,
    };
  }

  // ---------- locations ----------

  async listLocations(includeInactive = false): Promise<LocationDto[]> {
    const rows = await this.locations.find({ order: { name: 'ASC' } });
    return rows
      .filter((l) => includeInactive || l.active)
      .map((l) => ({ id: l.id, name: l.name, parentId: l.parentId, active: l.active }));
  }

  async saveLocation(
    id: string | null,
    dto: { name?: string; parentId?: string | null; active?: boolean },
  ): Promise<LocationDto> {
    let location = id ? await this.locations.findOne({ where: { id } }) : null;
    if (id && !location) throw new NotFoundException('Location not found');
    if (!location) {
      if (!dto.name?.trim()) throw new BadRequestException('Name is required');
      location = this.locations.create({ name: dto.name.trim(), parentId: dto.parentId ?? null });
    } else {
      if (dto.name !== undefined) location.name = dto.name.trim() || location.name;
      if (dto.parentId !== undefined) {
        if (dto.parentId === location.id) throw new BadRequestException('Cannot be own parent');
        location.parentId = dto.parentId;
      }
      if (dto.active !== undefined) location.active = dto.active;
    }
    const saved = await this.locations.save(location);
    return { id: saved.id, name: saved.name, parentId: saved.parentId, active: saved.active };
  }

  // ---------- families ----------

  async listFamilies(): Promise<ObjectFamilyDto[]> {
    const rows = await this.families.find({ order: { name: 'ASC' } });
    return rows.map((f) => ({
      id: f.id,
      name: f.name,
      description: f.description,
      fields: f.fields,
      defaultCategoryId: f.defaultCategoryId,
    }));
  }

  async saveFamily(
    id: string | null,
    dto: {
      name?: string;
      description?: string;
      fields?: FormField[];
      defaultCategoryId?: string | null;
    },
  ): Promise<ObjectFamilyDto> {
    let family = id ? await this.families.findOne({ where: { id } }) : null;
    if (id && !family) throw new NotFoundException('Family not found');
    if (dto.fields) {
      for (const field of dto.fields) {
        if (field.options) {
          field.options = field.options.map((o) => String(o).trim()).filter(Boolean);
        }
      }
      const errors = validateFormFields(dto.fields);
      if (errors.length > 0) throw new BadRequestException(errors.join('; '));
    }
    if (!family) {
      if (!dto.name?.trim()) throw new BadRequestException('Name is required');
      family = this.families.create({
        name: dto.name.trim(),
        description: dto.description ?? '',
        fields: dto.fields ?? [],
        defaultCategoryId: dto.defaultCategoryId ?? null,
      });
    } else {
      if (dto.name !== undefined) family.name = dto.name.trim() || family.name;
      if (dto.description !== undefined) family.description = dto.description;
      if (dto.fields !== undefined) family.fields = dto.fields;
      if (dto.defaultCategoryId !== undefined) family.defaultCategoryId = dto.defaultCategoryId;
    }
    const saved = await this.families.save(family);
    return {
      id: saved.id,
      name: saved.name,
      description: saved.description,
      fields: saved.fields,
      defaultCategoryId: saved.defaultCategoryId,
    };
  }

  // ---------- objects ----------

  async listObjects(filters: {
    familyId?: string;
    locationId?: string;
    q?: string;
    includeInactive?: boolean;
  }): Promise<AssetObjectSummaryDto[]> {
    const qb = this.objects
      .createQueryBuilder('o')
      .leftJoinAndSelect('o.family', 'family')
      .leftJoinAndSelect('o.location', 'location')
      .orderBy('o.name', 'ASC');
    if (!filters.includeInactive) qb.andWhere('o.active = true');
    if (filters.familyId) qb.andWhere('o.familyId = :f', { f: filters.familyId });
    if (filters.locationId) qb.andWhere('o.locationId = :l', { l: filters.locationId });
    if (filters.q?.trim()) {
      qb.andWhere('(o.name ILIKE :q OR o.serialNo ILIKE :q OR o.inventoryNo ILIKE :q)', {
        q: `%${filters.q.trim()}%`,
      });
    }
    const rows = await qb.getMany();
    return rows.map((o) => this.toSummary(o));
  }

  async getObject(id: string): Promise<AssetObjectDto> {
    const object = await this.objects.findOne({
      where: { id },
      relations: { family: true, location: true },
    });
    if (!object) throw new NotFoundException('Object not found');
    return {
      ...this.toSummary(object),
      fields: object.fields,
      familyFields: object.family?.fields ?? [],
      qrToken: object.qrToken,
    };
  }

  async getObjectByToken(token: string): Promise<ObjectByTokenDto> {
    const object = await this.objects.findOne({
      where: { qrToken: token, active: true },
      relations: { family: true, location: true },
    });
    if (!object) throw new NotFoundException('Object not found');
    return {
      id: object.id,
      name: object.name,
      serialNo: object.serialNo,
      familyId: object.familyId,
      familyName: object.family?.name ?? '',
      defaultCategoryId: object.family?.defaultCategoryId ?? null,
      locationId: object.locationId,
      locationName: object.location?.name ?? null,
    };
  }

  async saveObject(
    id: string | null,
    dto: {
      name?: string;
      familyId?: string;
      locationId?: string | null;
      serialNo?: string;
      inventoryNo?: string;
      fields?: FormValues;
      active?: boolean;
    },
  ): Promise<AssetObjectDto> {
    let object = id
      ? await this.objects.findOne({ where: { id }, relations: { family: true } })
      : null;
    if (id && !object) throw new NotFoundException('Object not found');

    const familyId = dto.familyId ?? object?.familyId;
    if (!familyId) throw new BadRequestException('Family is required');
    const family = await this.families.findOne({ where: { id: familyId } });
    if (!family) throw new BadRequestException('Unknown family');

    if (dto.locationId) {
      const location = await this.locations.findOne({ where: { id: dto.locationId } });
      if (!location) throw new BadRequestException('Unknown location');
    }

    const fields = dto.fields ?? object?.fields ?? {};
    const errors = validateFormValues(family.fields, fields);
    if (errors.length > 0) throw new BadRequestException(errors.join('; '));

    if (!object) {
      if (!dto.name?.trim()) throw new BadRequestException('Name is required');
      object = this.objects.create({
        name: dto.name.trim(),
        familyId,
        locationId: dto.locationId ?? null,
        serialNo: dto.serialNo?.trim() ?? '',
        inventoryNo: dto.inventoryNo?.trim() ?? '',
        fields,
        qrToken: randomBytes(6).toString('base64url'),
      });
    } else {
      if (dto.name !== undefined) object.name = dto.name.trim() || object.name;
      object.familyId = familyId;
      if (dto.locationId !== undefined) object.locationId = dto.locationId;
      if (dto.serialNo !== undefined) object.serialNo = dto.serialNo.trim();
      if (dto.inventoryNo !== undefined) object.inventoryNo = dto.inventoryNo.trim();
      object.fields = fields;
      if (dto.active !== undefined) object.active = dto.active;
    }
    const saved = await this.objects.save(object);
    return this.getObject(saved.id);
  }

  // ---------- service history ----------

  async getHistory(objectId: string): Promise<ObjectHistoryDto> {
    await this.getObject(objectId);
    const [tickets, entries] = await Promise.all([
      this.tickets.find({
        where: { objectId },
        relations: { requester: true, assignee: true, category: true },
        order: { createdAt: 'DESC' },
      }),
      this.serviceLog.find({
        where: { objectId },
        relations: { createdBy: true },
        order: { date: 'DESC', createdAt: 'DESC' },
      }),
    ]);
    const totalCost = entries.reduce((sum, e) => sum + Number(e.cost), 0);
    return {
      tickets: tickets.map((t) => ({
        id: t.id,
        ticketNo: t.ticketNo,
        title: t.title,
        status: t.status,
        priority: t.priority,
        categoryId: t.categoryId,
        categoryName: t.category?.name ?? '',
        requester: { id: t.requesterId, displayName: t.requester?.displayName ?? '?' },
        assignee: t.assignee ? { id: t.assignee.id, displayName: t.assignee.displayName } : null,
        locationId: t.locationId,
        locationName: null,
        objectId: t.objectId,
        objectName: null,
        problemId: t.problemId ?? null,
        problemName: null,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
      })),
      entries: entries.map((e) => this.toEntryDto(e)),
      totals: {
        tickets: tickets.length,
        services: entries.length,
        totalCost: Math.round(totalCost * 100) / 100,
      },
    };
  }

  async addServiceEntry(
    objectId: string,
    userId: string,
    dto: { date?: string; description?: string; performedBy?: string; cost?: number },
  ): Promise<ServiceLogEntryDto> {
    await this.getObject(objectId);
    if (!dto.description?.trim()) throw new BadRequestException('Description is required');
    const cost = Number(dto.cost ?? 0);
    if (!Number.isFinite(cost) || cost < 0) throw new BadRequestException('Invalid cost');
    const entry = await this.serviceLog.save(
      this.serviceLog.create({
        objectId,
        date: dto.date || new Date().toISOString().slice(0, 10),
        description: dto.description.trim(),
        performedBy: dto.performedBy?.trim() ?? '',
        cost: cost.toFixed(2),
        createdById: userId,
      }),
    );
    entry.createdBy = await this.users.findOneBy({ id: userId });
    return this.toEntryDto(entry);
  }

  // ---------- mapping ----------

  private toSummary(o: AssetObject): AssetObjectSummaryDto {
    return {
      id: o.id,
      name: o.name,
      serialNo: o.serialNo,
      inventoryNo: o.inventoryNo,
      familyId: o.familyId,
      familyName: o.family?.name ?? '',
      locationId: o.locationId,
      locationName: o.location?.name ?? null,
      active: o.active,
    };
  }

  private toEntryDto(e: ServiceLogEntry): ServiceLogEntryDto {
    return {
      id: e.id,
      date: e.date,
      description: e.description,
      performedBy: e.performedBy,
      cost: Number(e.cost),
      createdBy: e.createdBy ? { id: e.createdBy.id, displayName: e.createdBy.displayName } : null,
      createdAt: e.createdAt.toISOString(),
    };
  }
}
