import {
  BadRequestException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  MaintenanceIntervalUnit,
  MaintenancePlanDto,
  TicketPriority,
} from '@tickets/shared';
import { LessThanOrEqual, Repository } from 'typeorm';
import { AccessService } from '../access/access.service';
import { AssetObject } from '../entities/asset-object.entity';
import { MaintenancePlan } from '../entities/maintenance-plan.entity';
import { Problem } from '../entities/problem.entity';
import { TicketsService } from '../tickets/tickets.service';

const UNITS: MaintenanceIntervalUnit[] = ['days', 'weeks', 'months'];

function addInterval(date: Date, value: number, unit: MaintenanceIntervalUnit): Date {
  const next = new Date(date);
  if (unit === 'months') next.setMonth(next.getMonth() + value);
  else next.setDate(next.getDate() + (unit === 'weeks' ? value * 7 : value));
  return next;
}

@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);

  constructor(
    @InjectRepository(MaintenancePlan) private readonly plans: Repository<MaintenancePlan>,
    @InjectRepository(AssetObject) private readonly objects: Repository<AssetObject>,
    @InjectRepository(Problem) private readonly problems: Repository<Problem>,
    private readonly access: AccessService,
    @Inject(forwardRef(() => TicketsService)) private readonly tickets: TicketsService,
  ) {}

  async list(): Promise<MaintenancePlanDto[]> {
    const rows = await this.plans.find({
      relations: { family: true, object: true, problem: true, createdBy: true },
      order: { name: 'ASC' },
    });
    return rows.map((p) => this.toDto(p));
  }

  async save(
    id: string | null,
    dto: Partial<MaintenancePlanDto>,
    creatorId: string,
  ): Promise<MaintenancePlanDto> {
    let plan = id ? await this.plans.findOne({ where: { id } }) : null;
    if (id && !plan) throw new NotFoundException('Plan not found');

    const familyId = dto.familyId !== undefined ? dto.familyId : (plan?.familyId ?? null);
    const objectId = dto.objectId !== undefined ? dto.objectId : (plan?.objectId ?? null);
    if (!familyId === !objectId) {
      throw new BadRequestException('Pick exactly one target: a family or a device');
    }
    const problemId = dto.problemId !== undefined ? dto.problemId : (plan?.problemId ?? null);
    let categoryId = dto.categoryId !== undefined ? dto.categoryId : (plan?.categoryId ?? null);
    if (problemId) {
      const problem = await this.problems.findOne({ where: { id: problemId, active: true } });
      if (!problem) throw new BadRequestException('Unknown problem');
      categoryId = problem.categoryId;
    }
    if (!problemId && !categoryId) {
      throw new BadRequestException('Pick a problem or a category for the tickets');
    }
    const intervalValue = Number(dto.intervalValue ?? plan?.intervalValue ?? 30);
    const intervalUnit = (dto.intervalUnit ?? plan?.intervalUnit ?? 'days') as MaintenanceIntervalUnit;
    if (!Number.isInteger(intervalValue) || intervalValue < 1 || !UNITS.includes(intervalUnit)) {
      throw new BadRequestException('Invalid interval');
    }
    const nextDueAt = dto.nextDueAt ? new Date(dto.nextDueAt) : (plan?.nextDueAt ?? new Date());
    if (Number.isNaN(nextDueAt.getTime())) throw new BadRequestException('Invalid next-due date');

    plan = this.plans.create({
      ...(plan ?? {}),
      name: (dto.name ?? plan?.name ?? '').trim() || 'Maintenance plan',
      active: dto.active ?? plan?.active ?? true,
      familyId,
      objectId,
      problemId,
      categoryId,
      titleTemplate:
        (dto.titleTemplate ?? plan?.titleTemplate)?.trim() || 'Maintenance: {name} ({serial})',
      description: dto.description ?? plan?.description ?? '',
      priority:
        dto.priority !== undefined ? (dto.priority as TicketPriority | null) : (plan?.priority ?? null),
      intervalValue,
      intervalUnit,
      nextDueAt,
      createdById: plan?.createdById ?? creatorId,
    });
    const saved = await this.plans.save(plan);
    return this.get(saved.id);
  }

  async get(id: string): Promise<MaintenancePlanDto> {
    const plan = await this.plans.findOne({
      where: { id },
      relations: { family: true, object: true, problem: true, createdBy: true },
    });
    if (!plan) throw new NotFoundException('Plan not found');
    return this.toDto(plan);
  }

  /** All due plans; called from the automation cron. */
  async runDue(): Promise<number> {
    const due = await this.plans.find({
      where: { active: true, nextDueAt: LessThanOrEqual(new Date()) },
    });
    let created = 0;
    for (const plan of due) {
      created += await this.runPlan(plan.id).catch((err) => {
        this.logger.error(`Maintenance plan "${plan.name}" failed: ${err.message}`);
        return 0;
      });
    }
    return created;
  }

  /** Files tickets for every target device and advances the schedule. */
  async runPlan(id: string): Promise<number> {
    const plan = await this.plans.findOne({ where: { id }, relations: { family: true } });
    if (!plan) throw new NotFoundException('Plan not found');
    const me = await this.access.getMe(plan.createdById);
    const targets = plan.objectId
      ? await this.objects.find({ where: { id: plan.objectId, active: true } })
      : await this.objects.find({ where: { familyId: plan.familyId!, active: true } });

    let created = 0;
    for (const target of targets) {
      const title = plan.titleTemplate
        .replaceAll('{name}', target.name)
        .replaceAll('{serial}', target.serialNo || '—')
        .replaceAll('{family}', plan.family?.name ?? '')
        .replaceAll('{date}', new Date().toISOString().slice(0, 10));
      try {
        await this.tickets.create(
          me,
          {
            categoryId: plan.categoryId!,
            title,
            description: plan.description,
            objectId: target.id,
            problemId: plan.problemId,
          },
          {
            forcePriority: plan.priority,
            eventExtra: { auto: true, plan: plan.name },
          },
        );
        created += 1;
      } catch (err) {
        this.logger.error(
          `Maintenance ticket for ${target.name} failed: ${(err as Error).message}`,
        );
      }
    }

    // Advance past "now" so a lagging cron never floods duplicates.
    const now = new Date();
    let next = addInterval(plan.nextDueAt, plan.intervalValue, plan.intervalUnit);
    while (next <= now) next = addInterval(next, plan.intervalValue, plan.intervalUnit);
    plan.nextDueAt = next;
    plan.lastRunAt = now;
    await this.plans.save(plan);
    if (created > 0) this.logger.log(`Maintenance "${plan.name}": ${created} tickets created`);
    return created;
  }

  private toDto(p: MaintenancePlan): MaintenancePlanDto {
    return {
      id: p.id,
      name: p.name,
      active: p.active,
      familyId: p.familyId,
      familyName: p.family?.name ?? null,
      objectId: p.objectId,
      objectName: p.object?.name ?? null,
      problemId: p.problemId,
      problemName: p.problem?.name ?? null,
      categoryId: p.categoryId,
      titleTemplate: p.titleTemplate,
      description: p.description,
      priority: p.priority,
      intervalValue: p.intervalValue,
      intervalUnit: p.intervalUnit,
      nextDueAt: p.nextDueAt.toISOString(),
      lastRunAt: p.lastRunAt ? p.lastRunAt.toISOString() : null,
      createdBy: p.createdBy ? { id: p.createdBy.id, displayName: p.createdBy.displayName } : null,
    };
  }
}
