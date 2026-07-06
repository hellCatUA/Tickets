import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Group } from '../entities/group.entity';
import { User } from '../entities/user.entity';
import { MeController } from './me.controller';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Group])],
  controllers: [MeController, UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
