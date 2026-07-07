import { BadRequestException, Body, Controller, Get, Post, Put, Query, Req } from '@nestjs/common';
import type { NotificationListDto, NotificationPrefsDto } from '@tickets/shared';
import type { Request } from 'express';
import { EmailService } from './email.service';
import { NotificationsService } from './notifications.service';
import { PreferencesService } from './preferences.service';
import { PushService } from './push.service';

@Controller('api/notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@Req() req: Request, @Query('limit') limit?: string): Promise<NotificationListDto> {
    return this.notifications.list(req.session.userId as string, limit ? Number(limit) : 20);
  }

  @Post('read')
  async markRead(
    @Req() req: Request,
    @Body() body: { ids?: string[] },
  ): Promise<{ unreadCount: number }> {
    const unreadCount = await this.notifications.markRead(
      req.session.userId as string,
      body?.ids,
    );
    return { unreadCount };
  }
}

@Controller('api/push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('key')
  key(): { key: string } {
    return { key: this.push.publicKey };
  }

  @Get('status')
  async status(@Req() req: Request): Promise<{ subscribed: boolean }> {
    return { subscribed: await this.push.hasSubscription(req.session.userId as string) };
  }

  @Post('subscribe')
  async subscribe(
    @Req() req: Request,
    @Body() body: { endpoint: string; keys: { p256dh: string; auth: string } },
  ): Promise<{ ok: true }> {
    try {
      await this.push.subscribe(req.session.userId as string, body);
    } catch (err) {
      throw new BadRequestException((err as Error).message);
    }
    return { ok: true };
  }

  @Post('unsubscribe')
  async unsubscribe(
    @Req() req: Request,
    @Body() body: { endpoint: string },
  ): Promise<{ ok: true }> {
    if (body?.endpoint) {
      await this.push.unsubscribe(req.session.userId as string, body.endpoint);
    }
    return { ok: true };
  }
}

@Controller('api/notification-preferences')
export class PreferencesController {
  constructor(
    private readonly preferences: PreferencesService,
    private readonly email: EmailService,
  ) {}

  @Get()
  async get(@Req() req: Request): Promise<NotificationPrefsDto> {
    return {
      prefs: await this.preferences.get(req.session.userId as string),
      channels: { push: true, email: this.email.configured },
    };
  }

  @Put()
  async put(@Req() req: Request, @Body() body: { prefs?: unknown }): Promise<NotificationPrefsDto> {
    return {
      prefs: await this.preferences.put(req.session.userId as string, body?.prefs ?? body),
      channels: { push: true, email: this.email.configured },
    };
  }
}
