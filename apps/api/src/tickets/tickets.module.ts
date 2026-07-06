import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoriesModule } from '../categories/categories.module';
import { Attachment } from '../entities/attachment.entity';
import { Comment } from '../entities/comment.entity';
import { Ticket } from '../entities/ticket.entity';
import { TicketCounter } from '../entities/ticket-counter.entity';
import { TicketEvent } from '../entities/ticket-event.entity';
import { User } from '../entities/user.entity';
import { AttachmentsController, TicketsController } from './tickets.controller';
import { TicketsGateway } from './tickets.gateway';
import { TicketsService } from './tickets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Ticket, TicketEvent, Comment, Attachment, TicketCounter, User]),
    CategoriesModule,
  ],
  controllers: [TicketsController, AttachmentsController],
  providers: [TicketsService, TicketsGateway],
  exports: [TicketsService],
})
export class TicketsModule {}
