import { Body, Controller, Get, Param, Patch, Post, Put, Req } from '@nestjs/common';
import {
  AutomationRuleDto,
  AutomationRunResultDto,
  MaintenancePlanDto,
  Role,
} from '@tickets/shared';
import type { Request } from 'express';
import { RequireRoles } from '../access/decorators';
import { AutomationService } from './automation.service';
import { MaintenanceService } from './maintenance.service';

@Controller('api/admin/automation')
@RequireRoles(Role.Admin)
export class AutomationController {
  constructor(private readonly automation: AutomationService) {}

  @Get()
  list(): Promise<AutomationRuleDto[]> {
    return this.automation.listRules();
  }

  @Put()
  save(@Body() rules: AutomationRuleDto[]): Promise<AutomationRuleDto[]> {
    return this.automation.saveRules(Array.isArray(rules) ? rules : []);
  }

  @Post('run')
  run(): Promise<AutomationRunResultDto> {
    return this.automation.run();
  }
}

@Controller('api/admin/maintenance')
@RequireRoles(Role.Admin)
export class MaintenanceController {
  constructor(private readonly maintenance: MaintenanceService) {}

  @Get()
  list(): Promise<MaintenancePlanDto[]> {
    return this.maintenance.list();
  }

  @Post()
  create(@Req() req: Request, @Body() dto: Partial<MaintenancePlanDto>): Promise<MaintenancePlanDto> {
    return this.maintenance.save(null, dto, req.session.userId as string);
  }

  @Patch(':id')
  update(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: Partial<MaintenancePlanDto>,
  ): Promise<MaintenancePlanDto> {
    return this.maintenance.save(id, dto, req.session.userId as string);
  }

  /** Run one plan immediately — also the hook for external systems later. */
  @Post(':id/run')
  async run(@Param('id') id: string): Promise<{ created: number; plan: MaintenancePlanDto }> {
    const created = await this.maintenance.runPlan(id);
    return { created, plan: await this.maintenance.get(id) };
  }
}
