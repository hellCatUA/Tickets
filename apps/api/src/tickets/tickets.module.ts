import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '../categories/categories.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AssetObject } from '../entities/asset-object.entity';
import { Attachment } from '../entities/attachment.entity';
import { Location } from '../entities/location.entity';
import { Problem } from '../entities/problem.entity';
import { Comment } from '../entities/comment.entity';
import { Ticket } from '../entities/ticket.entity';
import { TicketCounter } from '../entities/ticket-counter.entity';
import { TicketEvent } from '../entities/ticket-event.entity';
import { User } from '../entities/user.entity';
import { AttachmentsController, DashboardController, TicketsController } from './tickets.controller';
import { TicketsGateway } from './tickets.gateway';
import { TicketsService } from './tickets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Ticket,
      TicketEvent,
      Comment,
      Attachment,
      TicketCounter,
      User,
      Location,
      AssetObject,
      Problem,
    ]),
    CategoriesModule,
    forwardRef(() => NotificationsModule),
  ],
  controllers: [TicketsController, DashboardController, AttachmentsController],
  providers: [TicketsService, TicketsGateway],
  exports: [TicketsService, TicketsGateway],
})
export class TicketsModule {}
