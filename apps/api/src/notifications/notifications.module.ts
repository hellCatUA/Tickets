import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from '../entities/group.entity';
import { Notification } from '../entities/notification.entity';
import { RoleMapping } from '../entities/role-mapping.entity';
import { User } from '../entities/user.entity';
import { TicketsModule } from '../tickets/tickets.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, RoleMapping, User, Group]),
    forwardRef(() => TicketsModule),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
