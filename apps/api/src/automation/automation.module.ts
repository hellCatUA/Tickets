import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetObject } from '../entities/asset-object.entity';
import { AutomationRule } from '../entities/automation-rule.entity';
import { MaintenancePlan } from '../entities/maintenance-plan.entity';
import { Problem } from '../entities/problem.entity';
import { Ticket } from '../entities/ticket.entity';
import { TicketEvent } from '../entities/ticket-event.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { TicketsModule } from '../tickets/tickets.module';
import { AutomationController, MaintenanceController } from './automation.controller';
import { AutomationService } from './automation.service';
import { MaintenanceService } from './maintenance.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AutomationRule,
      Ticket,
      TicketEvent,
      MaintenancePlan,
      AssetObject,
      Problem,
    ]),
    NotificationsModule,
    forwardRef(() => TicketsModule),
  ],
  controllers: [AutomationController, MaintenanceController],
  providers: [AutomationService, MaintenanceService],
})
export class AutomationModule {}
