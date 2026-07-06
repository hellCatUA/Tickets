import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import type { NotificationListDto } from '@tickets/shared';
import type { Request } from 'express';
import { NotificationsService } from './notifications.service';

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
