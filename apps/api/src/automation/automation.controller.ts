import { Body, Controller, Get, Post, Put } from '@nestjs/common';
import { AutomationRuleDto, AutomationRunResultDto, Role } from '@tickets/shared';
import { RequireRoles } from '../access/decorators';
import { AutomationService } from './automation.service';

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
