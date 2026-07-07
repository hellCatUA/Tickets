import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppSetting } from '../entities/app-setting.entity';
import { Group } from '../entities/group.entity';
import { Notification } from '../entities/notification.entity';
import { NotificationPreference } from '../entities/notification-preference.entity';
import { PushSubscription } from '../entities/push-subscription.entity';
import { RoleMapping } from '../entities/role-mapping.entity';
import { User } from '../entities/user.entity';
import { TicketsModule } from '../tickets/tickets.module';
import { EmailService } from './email.service';
import {
  NotificationsController,
  PreferencesController,
  PushController,
} from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PreferencesService } from './preferences.service';
import { PushService } from './push.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Notification,
      NotificationPreference,
      PushSubscription,
      AppSetting,
      RoleMapping,
      User,
      Group,
    ]),
    forwardRef(() => TicketsModule),
  ],
  controllers: [NotificationsController, PushController, PreferencesController],
  providers: [NotificationsService, PreferencesService, PushService, EmailService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
