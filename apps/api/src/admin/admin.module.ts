import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionGrant } from '../entities/permission-grant.entity';
import { RoleMapping } from '../entities/role-mapping.entity';
import { NextcloudModule } from '../nextcloud/nextcloud.module';
import { UsersModule } from '../users/users.module';
import { AdminController } from './admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RoleMapping, PermissionGrant]), UsersModule, NextcloudModule],
  controllers: [AdminController],
})
export class AdminModule {}
