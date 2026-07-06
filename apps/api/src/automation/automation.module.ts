import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AutomationRule } from '../entities/automation-rule.entity';
import { Ticket } from '../entities/ticket.entity';
import { TicketEvent } from '../entities/ticket-event.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { TicketsModule } from '../tickets/tickets.module';
import { AutomationController } from './automation.controller';
import { AutomationService } from './automation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([AutomationRule, Ticket, TicketEvent]),
    NotificationsModule,
    forwardRef(() => TicketsModule),
  ],
  controllers: [AutomationController],
  providers: [AutomationService],
})
export class AutomationModule {}
