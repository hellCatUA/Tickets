import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  CategoryAdminDto,
  CategoryDto,
  CreateCategoryDto,
  FormField,
  PriorityRule,
  TicketPriority,
  validateFormFields,
} from '@tickets/shared';
import { In, Repository } from 'typeorm';
import { Category } from '../entities/category.entity';
import { FormSchema } from '../entities/form-schema.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category) private readonly categories: Repository<Category>,
    @InjectRepository(FormSchema) private readonly schemas: Repository<FormSchema>,
  ) {}

  private async currentFields(categories: Category[]): Promise<Map<string, FormField[]>> {
    if (categories.length === 0) return new Map();
    const rows = await this.schemas.find({
      where: categories.map((c) => ({ categoryId: c.id, version: c.formVersion })),
    });
    return new Map(rows.map((r) => [r.categoryId, r.fields]));
  }

  /** Active categories with their current form fields — for the new-ticket flow. */
  async listActive(): Promise<CategoryDto[]> {
    const cats = await this.categories.find({
      where: { active: true },
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    const fields = await this.currentFields(cats);
    return cats.map((c) => this.toDto(c, fields.get(c.id) ?? []));
  }

  async listAll(): Promise<CategoryAdminDto[]> {
    const cats = await this.categories.find({ order: { sortOrder: 'ASC', name: 'ASC' } });
    const fields = await this.currentFields(cats);
    return cats.map((c) => this.toAdminDto(c, fields.get(c.id) ?? []));
  }

  async getCategoryWithSchema(
    categoryId: string,
  ): Promise<{ category: Category; schema: FormSchema }> {
    const category = await this.categories.findOne({ where: { id: categoryId } });
    if (!category) throw new NotFoundException('Category not found');
    const schema = await this.schemas.findOne({
      where: { categoryId, version: category.formVersion },
    });
    if (!schema) throw new NotFoundException('Form schema missing for category');
    return { category, schema };
  }

  async getSchemasByIds(ids: string[]): Promise<Map<string, FormSchema>> {
    if (ids.length === 0) return new Map();
    const rows = await this.schemas.find({ where: { id: In(ids) } });
    return new Map(rows.map((r) => [r.id, r]));
  }

  /** Keeps only well-formed rules and coerces `equals` to a primitive. */
  private sanitizeRules(rules: PriorityRule[] | undefined): PriorityRule[] {
    if (!Array.isArray(rules)) return [];
    return rules
      .filter(
        (r) =>
          r &&
          typeof r.field === 'string' &&
          r.field.trim() !== '' &&
          Object.values(TicketPriority).includes(r.priority),
      )
      .map((r) => ({ field: r.field.trim(), equals: String(r.equals ?? ''), priority: r.priority }));
  }

  async create(dto: CreateCategoryDto): Promise<CategoryAdminDto> {
    if (!dto.name?.trim()) throw new BadRequestException('Name is required');
    if (dto.parentId) await this.requireCategory(dto.parentId);
    const category = await this.categories.save(
      this.categories.create({
        name: dto.name.trim(),
        description: dto.description ?? '',
        parentId: dto.parentId ?? null,
        agentGroups: dto.agentGroups ?? [],
        defaultPriority: dto.defaultPriority ?? TicketPriority.Normal,
        allowRequesterPriority: dto.allowRequesterPriority ?? false,
        priorityRules: this.sanitizeRules(dto.priorityRules),
        formVersion: 1,
      }),
    );
    await this.schemas.save(
      this.schemas.create({ categoryId: category.id, version: 1, fields: [] }),
    );
    return this.toAdminDto(category, []);
  }

  async update(id: string, patch: Partial<CreateCategoryDto> & { active?: boolean; sortOrder?: number }): Promise<CategoryAdminDto> {
    const category = await this.requireCategory(id);
    if (patch.parentId !== undefined && patch.parentId !== null) {
      if (patch.parentId === id) throw new BadRequestException('Category cannot be its own parent');
      await this.requireCategory(patch.parentId);
    }
    if (patch.name !== undefined) category.name = patch.name.trim() || category.name;
    if (patch.description !== undefined) category.description = patch.description;
    if (patch.parentId !== undefined) category.parentId = patch.parentId;
    if (patch.agentGroups !== undefined) category.agentGroups = patch.agentGroups;
    if (patch.defaultPriority !== undefined) category.defaultPriority = patch.defaultPriority;
    if (patch.allowRequesterPriority !== undefined) {
      category.allowRequesterPriority = patch.allowRequesterPriority;
    }
    if (patch.priorityRules !== undefined) {
      category.priorityRules = this.sanitizeRules(patch.priorityRules);
    }
    if (patch.active !== undefined) category.active = patch.active;
    if (patch.sortOrder !== undefined) category.sortOrder = patch.sortOrder;
    const saved = await this.categories.save(category);
    const schema = await this.schemas.findOne({
      where: { categoryId: id, version: saved.formVersion },
    });
    return this.toAdminDto(saved, schema?.fields ?? []);
  }

  /** Replaces the form definition by publishing a new immutable schema version. */
  async updateForm(id: string, fields: FormField[]): Promise<CategoryAdminDto> {
    const category = await this.requireCategory(id);
    if (!Array.isArray(fields)) throw new BadRequestException('Expected a field array');
    // Defensive normalization: drop blank/whitespace-only options the editor
    // may leave behind mid-edit.
    for (const field of fields) {
      if (field.options) {
        field.options = field.options.map((o) => String(o).trim()).filter(Boolean);
      }
    }
    const errors = validateFormFields(fields);
    if (errors.length > 0) throw new BadRequestException(errors.join('; '));
    category.formVersion += 1;
    await this.schemas.save(
      this.schemas.create({ categoryId: id, version: category.formVersion, fields }),
    );
    const saved = await this.categories.save(category);
    return this.toAdminDto(saved, fields);
  }

  private async requireCategory(id: string): Promise<Category> {
    const category = await this.categories.findOne({ where: { id } });
    if (!category) throw new NotFoundException('Category not found');
    return category;
  }

  private toDto(c: Category, fields: FormField[]): CategoryDto {
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      parentId: c.parentId,
      defaultPriority: c.defaultPriority,
      allowRequesterPriority: c.allowRequesterPriority,
      active: c.active,
      formFields: fields,
    };
  }

  private toAdminDto(c: Category, fields: FormField[]): CategoryAdminDto {
    return {
      ...this.toDto(c, fields),
      agentGroups: c.agentGroups,
      priorityRules: c.priorityRules,
      formVersion: c.formVersion,
      sortOrder: c.sortOrder,
    };
  }
}
