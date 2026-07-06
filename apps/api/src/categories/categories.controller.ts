import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import {
  CategoryAdminDto,
  CategoryDto,
  CreateCategoryDto,
  FormField,
  Role,
} from '@tickets/shared';
import { RequireRoles } from '../access/decorators';
import { CategoriesService } from './categories.service';

@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  /** Active categories with current forms — any authenticated user (new-ticket flow). */
  @Get()
  list(): Promise<CategoryDto[]> {
    return this.categories.listActive();
  }
}

@Controller('api/admin/categories')
@RequireRoles(Role.Admin)
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  listAll(): Promise<CategoryAdminDto[]> {
    return this.categories.listAll();
  }

  @Post()
  create(@Body() dto: CreateCategoryDto): Promise<CategoryAdminDto> {
    return this.categories.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() patch: Partial<CreateCategoryDto> & { active?: boolean; sortOrder?: number },
  ): Promise<CategoryAdminDto> {
    return this.categories.update(id, patch);
  }

  @Put(':id/form')
  updateForm(@Param('id') id: string, @Body() fields: FormField[]): Promise<CategoryAdminDto> {
    return this.categories.updateForm(id, fields);
  }
}
