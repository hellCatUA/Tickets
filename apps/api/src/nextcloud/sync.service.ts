import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import type { SyncResultDto } from '@tickets/shared';
import { CronJob } from 'cron';
import { Not, In, Repository } from 'typeorm';
import { User } from '../entities/user.entity';
import { UsersService } from '../users/users.service';
import { OcsClient } from './ocs.client';

/**
 * Mirrors the Nextcloud user/group directory into the local database, so that
 * staff can be assigned tickets before their first login. Runs on a cron
 * (SYNC_CRON) and on demand via POST /api/admin/sync.
 */
@Injectable()
export class SyncService implements OnApplicationBootstrap {
  private readonly logger = new Logger(SyncService.name);
  private running = false;
  lastResult: SyncResultDto | null = null;

  constructor(
    private readonly ocs: OcsClient,
    private readonly users: UsersService,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  onApplicationBootstrap(): void {
    const cron = this.config.get<string>('SYNC_CRON');
    if (!cron || !this.ocs.configured) {
      this.logger.warn('Directory sync disabled (SYNC_CRON or NC_* credentials not set)');
      return;
    }
    const job = new CronJob(cron, () => {
      this.run().catch((err) => this.logger.error(`Scheduled sync failed: ${err.message}`));
    });
    this.scheduler.addCronJob('nextcloud-directory-sync', job);
    job.start();
    this.logger.log(`Directory sync scheduled: ${cron}`);
  }

  async run(): Promise<SyncResultDto> {
    if (this.running) throw new Error('Sync already in progress');
    this.running = true;
    const startedAt = new Date();
    try {
      const groups = await this.ocs.listGroups();
      const displayNames = new Map(groups.map((g) => [g.id, g.displayName]));
      await this.users.ensureGroups(
        groups.map((g) => g.id),
        displayNames,
      );

      const userIds = await this.ocs.listUserIds();
      let synced = 0;
      for (const id of userIds) {
        const ocsUser = await this.ocs.getUser(id);
        let user = await this.userRepo.findOne({
          where: { ncUid: ocsUser.id },
          relations: { groups: true },
        });
        if (!user) user = this.userRepo.create({ ncUid: ocsUser.id, groups: [] });
        user.displayName = ocsUser.displayName;
        user.email = ocsUser.email;
        user.active = ocsUser.enabled;
        user.groups = await this.users.ensureGroups(ocsUser.groups, displayNames);
        await this.userRepo.save(user);
        synced += 1;
      }

      // Users no longer present in Nextcloud are deactivated (never deleted).
      let deactivated = 0;
      if (userIds.length > 0) {
        const res = await this.userRepo.update(
          { ncUid: Not(In(userIds)), active: true },
          { active: false },
        );
        deactivated = res.affected ?? 0;
      }

      this.lastResult = {
        users: synced,
        groups: groups.length,
        deactivated,
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
      };
      this.logger.log(
        `Directory sync done: ${synced} users, ${groups.length} groups, ${deactivated} deactivated`,
      );
      return this.lastResult;
    } finally {
      this.running = false;
    }
  }
}
