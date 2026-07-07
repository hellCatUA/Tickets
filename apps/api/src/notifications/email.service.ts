import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { NotificationEventType } from '@tickets/shared';
import nodemailer, { Transporter } from 'nodemailer';
import { In, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { PreferencesService } from './preferences.service';
import type { PushPayload } from './push.service';

/**
 * Email channel — dormant until SMTP_URL is configured (e.g.
 * smtps://user:pass@mail.example.com:465). Enabling it is config-only.
 */
@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor(
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly config: ConfigService,
    private readonly preferences: PreferencesService,
  ) {
    const smtpUrl = this.config.get<string>('SMTP_URL');
    if (smtpUrl) {
      this.transporter = nodemailer.createTransport(smtpUrl);
      this.logger.log('SMTP configured — email notifications enabled');
    }
  }

  get configured(): boolean {
    return this.transporter !== null;
  }

  async sendToUsers(userIds: string[], payload: PushPayload): Promise<void> {
    if (!this.transporter || userIds.length === 0) return;
    const prefs = await this.preferences.getMany(userIds);
    const allowed = userIds.filter(
      (id) => prefs.get(id)?.email[payload.type as NotificationEventType] !== false,
    );
    if (allowed.length === 0) return;
    const users = await this.users.find({ where: { id: In(allowed) } });
    const publicUrl = (this.config.get<string>('PUBLIC_URL') ?? '').replace(/\/$/, '');
    const from = this.config.get<string>('EMAIL_FROM') ?? 'tickets@417group.org';
    await Promise.all(
      users
        .filter((u) => u.email)
        .map(async (user) => {
          try {
            await this.transporter!.sendMail({
              from,
              to: user.email!,
              subject: payload.title,
              text: `${payload.body ?? ''}\n\n${
                payload.ticketId ? `${publicUrl}/tickets/${payload.ticketId}` : publicUrl
              }`,
            });
          } catch (err) {
            this.logger.warn(`Email to ${user.email} failed: ${String(err)}`);
          }
        }),
    );
  }
}
