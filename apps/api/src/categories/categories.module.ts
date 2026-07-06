import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../entities/category.entity';
import { FormSchema } from '../entities/form-schema.entity';
import { AdminCategoriesController, CategoriesController } from './categories.controller';
import { CategoriesService } from './categories.service';

@Module({
  imports: [TypeOrmModule.forFeature([Category, FormSchema])],
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [CategoriesService],
  exports: [CategoriesService],
})
export class CategoriesModule {}
