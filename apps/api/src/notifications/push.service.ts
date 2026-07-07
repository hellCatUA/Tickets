import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationEventType } from '@tickets/shared';
import { In, Repository } from 'typeorm';
import webpush from 'web-push';
import { AppSetting } from '../entities/app-setting.entity';
import { PushSubscription } from '../entities/push-subscription.entity';
import { PreferencesService } from './preferences.service';

export interface PushPayload {
  type: NotificationEventType | string;
  title: string;
  body?: string;
  ticketId?: string | null;
}

@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private vapidPublicKey = '';

  constructor(
    @InjectRepository(PushSubscription) private readonly subs: Repository<PushSubscription>,
    @InjectRepository(AppSetting) private readonly settings: Repository<AppSetting>,
    private readonly config: ConfigService,
    private readonly preferences: PreferencesService,
  ) {}

  /** VAPID keys come from env when provided, otherwise are generated once and persisted. */
  async onModuleInit(): Promise<void> {
    let publicKey = this.config.get<string>('VAPID_PUBLIC_KEY');
    let privateKey = this.config.get<string>('VAPID_PRIVATE_KEY');
    if (!publicKey || !privateKey) {
      const [pub, priv] = await Promise.all([
        this.settings.findOne({ where: { key: 'vapid_public' } }),
        this.settings.findOne({ where: { key: 'vapid_private' } }),
      ]);
      if (pub && priv) {
        publicKey = pub.value;
        privateKey = priv.value;
      } else {
        const generated = webpush.generateVAPIDKeys();
        publicKey = generated.publicKey;
        privateKey = generated.privateKey;
        await this.settings.save([
          { key: 'vapid_public', value: publicKey },
          { key: 'vapid_private', value: privateKey },
        ]);
        this.logger.log('Generated and stored new VAPID keys for Web Push');
      }
    }
    const subject =
      this.config.get<string>('VAPID_SUBJECT') ??
      `mailto:admin@${new URL(this.config.get<string>('PUBLIC_URL') ?? 'https://localhost').hostname}`;
    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.vapidPublicKey = publicKey;
  }

  get publicKey(): string {
    return this.vapidPublicKey;
  }

  async subscribe(
    userId: string,
    sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  ): Promise<void> {
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      throw new Error('Invalid subscription');
    }
    const existing = await this.subs.findOne({ where: { endpoint: sub.endpoint } });
    await this.subs.save(
      this.subs.create({
        ...(existing ?? {}),
        userId,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
      }),
    );
  }

  async unsubscribe(userId: string, endpoint: string): Promise<void> {
    await this.subs.delete({ userId, endpoint });
  }

  async hasSubscription(userId: string): Promise<boolean> {
    return (await this.subs.count({ where: { userId } })) > 0;
  }

  /** Fire-and-forget delivery to all devices of the given users, honouring preferences. */
  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    if (userIds.length === 0) return;
    const prefs = await this.preferences.getMany(userIds);
    const allowed = userIds.filter(
      (id) => prefs.get(id)?.push[payload.type as NotificationEventType] !== false,
    );
    if (allowed.length === 0) return;
    const subs = await this.subs.find({ where: { userId: In(allowed) } });
    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            JSON.stringify(payload),
            { TTL: 3600 },
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await this.subs.delete({ id: sub.id });
          } else {
            this.logger.warn(`Push to ${sub.endpoint.slice(0, 40)}… failed: ${String(err)}`);
          }
        }
      }),
    );
  }
}
