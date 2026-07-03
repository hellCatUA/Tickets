import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';
import { UsersModule } from '../users/users.module';
import { OcsClient } from './ocs.client';
import { SyncService } from './sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), UsersModule],
  providers: [OcsClient, SyncService],
  exports: [SyncService],
})
export class NextcloudModule {}
