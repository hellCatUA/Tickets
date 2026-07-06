import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationDto, NotificationListDto, Role } from '@tickets/shared';
import { In, Repository } from 'typeorm';
import { Group } from '../entities/group.entity';
import { Notification } from '../entities/notification.entity';
import { RoleMapping } from '../entities/role-mapping.entity';
import { User } from '../entities/user.entity';
import { TicketsGateway } from '../tickets/tickets.gateway';

export interface NotificationInput {
  type: string;
  title: string;
  body?: string;
  ticketId?: string | null;
}

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification) private readonly notifications: Repository<Notification>,
    @InjectRepository(RoleMapping) private readonly mappings: Repository<RoleMapping>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => TicketsGateway)) private readonly gateway: TicketsGateway,
  ) {}

  async createForUsers(userIds: string[], input: NotificationInput): Promise<void> {
    const unique = [...new Set(userIds)].filter(Boolean);
    if (unique.length === 0) return;
    await this.notifications.save(
      unique.map((userId) =>
        this.notifications.create({
          userId,
          type: input.type,
          title: input.title,
          body: input.body ?? '',
          ticketId: input.ticketId ?? null,
        }),
      ),
    );
    this.gateway.emitNotification(unique);
  }

  /** Users who hold the Manager (or Admin) role via group mappings or the bootstrap group. */
  async managerUserIds(): Promise<string[]> {
    const rows = await this.mappings.find({
      where: { role: In([Role.Manager, Role.Admin]) },
    });
    const gids = new Set(rows.map((r) => r.ncGid));
    const bootstrap = this.config.get<string>('BOOTSTRAP_ADMIN_GROUP');
    if (bootstrap) gids.add(bootstrap);
    if (gids.size === 0) return [];
    const users = await this.users
      .createQueryBuilder('u')
      .innerJoin('u.groups', 'g', 'g.ncGid IN (:...gids)', { gids: [...gids] })
      .where('u.active = true')
      .getMany();
    return users.map((u) => u.id);
  }

  async list(userId: string, limit = 20): Promise<NotificationListDto> {
    const [items, unreadCount] = await Promise.all([
      this.notifications.find({
        where: { userId },
        order: { createdAt: 'DESC' },
        take: limit,
      }),
      this.unread(userId),
    ]);
    return { items: items.map((n) => this.toDto(n)), unreadCount };
  }

  private unread(userId: string): Promise<number> {
    return this.notifications
      .createQueryBuilder('n')
      .where('n.userId = :userId AND n.readAt IS NULL', { userId })
      .getCount();
  }

  async markRead(userId: string, ids?: string[]): Promise<number> {
    const qb = this.notifications
      .createQueryBuilder()
      .update()
      .set({ readAt: new Date() })
      .where('userId = :userId AND readAt IS NULL', { userId });
    if (ids && ids.length > 0) qb.andWhere('id IN (:...ids)', { ids });
    await qb.execute();
    return this.unread(userId);
  }

  private toDto(n: Notification): NotificationDto {
    return {
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      ticketId: n.ticketId,
      readAt: n.readAt ? n.readAt.toISOString() : null,
      createdAt: n.createdAt.toISOString(),
    };
  }
}
