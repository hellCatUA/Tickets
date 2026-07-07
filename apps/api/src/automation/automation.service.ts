import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import {
  AutomationRuleDto,
  AutomationRuleType,
  AutomationRunResultDto,
  TicketStatus,
} from '@tickets/shared';
import { IsNull, LessThan, Repository } from 'typeorm';
import { AutomationRule } from '../entities/automation-rule.entity';
import { Ticket } from '../entities/ticket.entity';
import { TicketEvent } from '../entities/ticket-event.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { TicketsGateway } from '../tickets/tickets.gateway';
import { MaintenanceService } from './maintenance.service';

const RULE_TYPES: AutomationRuleType[] = ['auto_close_resolved', 'escalate_unassigned'];
const DEFAULT_PARAMS: Record<AutomationRuleType, Record<string, number>> = {
  auto_close_resolved: { days: 5 },
  escalate_unassigned: { hours: 4 },
};

@Injectable()
export class AutomationService {
  private readonly logger = new Logger(AutomationService.name);
  private running = false;

  constructor(
    @InjectRepository(AutomationRule) private readonly rules: Repository<AutomationRule>,
    @InjectRepository(Ticket) private readonly tickets: Repository<Ticket>,
    @InjectRepository(TicketEvent) private readonly events: Repository<TicketEvent>,
    private readonly notifications: NotificationsService,
    @Inject(forwardRef(() => TicketsGateway)) private readonly gateway: TicketsGateway,
    private readonly maintenance: MaintenanceService,
  ) {}

  async listRules(): Promise<AutomationRuleDto[]> {
    const rows = await this.rules.find();
    const byType = new Map(rows.map((r) => [r.type, r]));
    return RULE_TYPES.map((type) => ({
      type,
      enabled: byType.get(type)?.enabled ?? false,
      params: { ...DEFAULT_PARAMS[type], ...(byType.get(type)?.params ?? {}) },
    }));
  }

  async saveRules(dtos: AutomationRuleDto[]): Promise<AutomationRuleDto[]> {
    for (const dto of dtos) {
      if (!RULE_TYPES.includes(dto.type)) continue;
      const params: Record<string, number> = {};
      for (const [key, fallback] of Object.entries(DEFAULT_PARAMS[dto.type])) {
        const raw = Number(dto.params?.[key]);
        params[key] = Number.isFinite(raw) && raw >= 0 ? raw : fallback;
      }
      const existing = await this.rules.findOne({ where: { type: dto.type } });
      await this.rules.save(
        this.rules.create({
          ...(existing ?? {}),
          type: dto.type,
          enabled: dto.enabled === true,
          params,
        }),
      );
    }
    return this.listRules();
  }

  @Cron('*/5 * * * *')
  scheduled(): void {
    this.run().catch((err) => this.logger.error(`Automation run failed: ${err.message}`));
  }

  /** Evaluates all enabled rules once. Also exposed via POST /api/admin/automation/run. */
  async run(): Promise<AutomationRunResultDto> {
    if (this.running) return { closed: 0, escalated: 0, maintenanceCreated: 0 };
    this.running = true;
    try {
      const rules = await this.listRules();
      let closed = 0;
      let escalated = 0;
      for (const rule of rules) {
        if (!rule.enabled) continue;
        if (rule.type === 'auto_close_resolved') closed = await this.autoCloseResolved(rule.params.days);
        if (rule.type === 'escalate_unassigned') escalated = await this.escalateUnassigned(rule.params.hours);
      }
      const maintenanceCreated = await this.maintenance.runDue();
      if (closed || escalated || maintenanceCreated) {
        this.logger.log(
          `Automation: closed ${closed}, escalated ${escalated}, maintenance ${maintenanceCreated}`,
        );
      }
      return { closed, escalated, maintenanceCreated };
    } finally {
      this.running = false;
    }
  }

  /** Resolved tickets with no requester reply for N days are closed automatically. */
  private async autoCloseResolved(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const stale = await this.tickets.find({
      where: { status: TicketStatus.Resolved, resolvedAt: LessThan(cutoff) },
    });
    for (const ticket of stale) {
      ticket.status = TicketStatus.Closed;
      ticket.closedAt = new Date();
      await this.tickets.save(ticket);
      await this.events.save(
        this.events.create({
          ticketId: ticket.id,
          type: 'status_changed',
          actorId: null,
          payload: {
            from: TicketStatus.Resolved,
            to: TicketStatus.Closed,
            auto: true,
            rule: 'auto_close_resolved',
          },
        }),
      );
      this.gateway.emitTicketUpdate(ticket.id, { type: 'status_changed' });
      await this.notifications.createForUsers([ticket.requesterId], {
        type: 'automation',
        title: `${ticket.ticketNo} was closed automatically`,
        body: `Resolved for ${days}+ days without a reply`,
        ticketId: ticket.id,
      });
    }
    return stale.length;
  }

  /** New tickets without an assignee for N hours escalate to managers (once per ticket). */
  private async escalateUnassigned(hours: number): Promise<number> {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const candidates = await this.tickets.find({
      where: { status: TicketStatus.New, assigneeId: IsNull(), createdAt: LessThan(cutoff) },
    });
    if (candidates.length === 0) return 0;
    const managers = await this.notifications.managerUserIds();
    let escalated = 0;
    for (const ticket of candidates) {
      const already = await this.events.findOne({
        where: { ticketId: ticket.id, type: 'escalated' },
      });
      if (already) continue;
      await this.events.save(
        this.events.create({
          ticketId: ticket.id,
          type: 'escalated',
          actorId: null,
          payload: { rule: 'escalate_unassigned', hours },
        }),
      );
      this.gateway.emitTicketUpdate(ticket.id, { type: 'escalated' });
      await this.notifications.createForUsers(managers, {
        type: 'escalation',
        title: `${ticket.ticketNo} has been unassigned for ${hours}h`,
        body: ticket.title,
        ticketId: ticket.id,
      });
      escalated += 1;
    }
    return escalated;
  }
}
