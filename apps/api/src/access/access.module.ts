import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PermissionGrant } from '../entities/permission-grant.entity';
import { RoleMapping } from '../entities/role-mapping.entity';
import { User } from '../entities/user.entity';
import { AccessService } from './access.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User, RoleMapping, PermissionGrant])],
  providers: [AccessService],
  exports: [AccessService, TypeOrmModule],
})
export class AccessModule {}
