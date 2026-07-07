import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  NOTIFICATION_EVENT_TYPES,
  NotificationEventType,
  NotificationPrefs,
} from '@tickets/shared';
import { In, Repository } from 'typeorm';
import { NotificationPreference } from '../entities/notification-preference.entity';

function defaultChannel(): Record<NotificationEventType, boolean> {
  return Object.fromEntries(NOTIFICATION_EVENT_TYPES.map((t) => [t, true])) as Record<
    NotificationEventType,
    boolean
  >;
}

export function defaultPrefs(): NotificationPrefs {
  return { push: defaultChannel(), email: defaultChannel() };
}

function mergePrefs(stored: Record<string, Record<string, boolean>> | undefined): NotificationPrefs {
  const merged = defaultPrefs();
  for (const channel of ['push', 'email'] as const) {
    for (const type of NOTIFICATION_EVENT_TYPES) {
      const value = stored?.[channel]?.[type];
      if (typeof value === 'boolean') merged[channel][type] = value;
    }
  }
  return merged;
}

@Injectable()
export class PreferencesService {
  constructor(
    @InjectRepository(NotificationPreference)
    private readonly repo: Repository<NotificationPreference>,
  ) {}

  async get(userId: string): Promise<NotificationPrefs> {
    const row = await this.repo.findOne({ where: { userId } });
    return mergePrefs(row?.prefs);
  }

  /** Bulk fetch with defaults for missing rows — used by the push/email fan-out. */
  async getMany(userIds: string[]): Promise<Map<string, NotificationPrefs>> {
    const rows = userIds.length
      ? await this.repo.find({ where: { userId: In(userIds) } })
      : [];
    const byUser = new Map(rows.map((r) => [r.userId, r.prefs]));
    return new Map(userIds.map((id) => [id, mergePrefs(byUser.get(id))]));
  }

  async put(userId: string, prefs: unknown): Promise<NotificationPrefs> {
    const sanitized = mergePrefs(prefs as Record<string, Record<string, boolean>>);
    await this.repo.save(this.repo.create({ userId, prefs: sanitized }));
    return sanitized;
  }
}
