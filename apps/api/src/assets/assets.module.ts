import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssetObject } from '../entities/asset-object.entity';
import { Category } from '../entities/category.entity';
import { Location } from '../entities/location.entity';
import { ObjectFamily } from '../entities/object-family.entity';
import { Problem } from '../entities/problem.entity';
import { ServiceLogEntry } from '../entities/service-log-entry.entity';
import { Ticket } from '../entities/ticket.entity';
import { User } from '../entities/user.entity';
import {
  FamiliesController,
  LocationsController,
  ObjectsController,
  ProblemsController,
} from './assets.controller';
import { AssetsService } from './assets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Location,
      ObjectFamily,
      AssetObject,
      ServiceLogEntry,
      Ticket,
      User,
      Problem,
      Category,
    ]),
  ],
  controllers: [LocationsController, FamiliesController, ProblemsController, ObjectsController],
  providers: [AssetsService],
  exports: [AssetsService],
})
export class AssetsModule {}
