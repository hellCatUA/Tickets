import { Body, Controller, Get, Param, Patch, Post, Query, Req } from '@nestjs/common';
import {
  AssetObjectDto,
  AssetObjectSummaryDto,
  FormField,
  FormValues,
  LocationDto,
  ObjectByTokenDto,
  ObjectFamilyDto,
  ObjectHistoryDto,
  Permission,
  Role,
  ServiceLogEntryDto,
} from '@tickets/shared';
import type { Request } from 'express';
import { RequirePermissions, RequireRoles } from '../access/decorators';
import { AssetsService } from './assets.service';

@Controller('api/locations')
export class LocationsController {
  constructor(private readonly assets: AssetsService) {}

  /** Any authenticated user — needed by pickers. */
  @Get()
  list(@Query('all') all?: string): Promise<LocationDto[]> {
    return this.assets.listLocations(all === '1');
  }

  @Post()
  @RequirePermissions(Permission.ManageLocations)
  create(@Body() dto: { name: string; parentId?: string | null }): Promise<LocationDto> {
    return this.assets.saveLocation(null, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.ManageLocations)
  update(
    @Param('id') id: string,
    @Body() dto: { name?: string; parentId?: string | null; active?: boolean },
  ): Promise<LocationDto> {
    return this.assets.saveLocation(id, dto);
  }
}

@Controller('api/object-families')
export class FamiliesController {
  constructor(private readonly assets: AssetsService) {}

  @Get()
  list(): Promise<ObjectFamilyDto[]> {
    return this.assets.listFamilies();
  }

  @Post()
  @RequirePermissions(Permission.ManageObjects)
  create(
    @Body() dto: { name: string; description?: string; fields?: FormField[] },
  ): Promise<ObjectFamilyDto> {
    return this.assets.saveFamily(null, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.ManageObjects)
  update(
    @Param('id') id: string,
    @Body() dto: { name?: string; description?: string; fields?: FormField[] },
  ): Promise<ObjectFamilyDto> {
    return this.assets.saveFamily(id, dto);
  }
}

@Controller('api/objects')
export class ObjectsController {
  constructor(private readonly assets: AssetsService) {}

  /** Any authenticated user — the new-ticket picker needs it. */
  @Get()
  list(
    @Query('familyId') familyId?: string,
    @Query('locationId') locationId?: string,
    @Query('q') q?: string,
    @Query('all') all?: string,
  ): Promise<AssetObjectSummaryDto[]> {
    return this.assets.listObjects({ familyId, locationId, q, includeInactive: all === '1' });
  }

  @Get('by-token/:token')
  byToken(@Param('token') token: string): Promise<ObjectByTokenDto> {
    return this.assets.getObjectByToken(token);
  }

  /** Object card with fields, QR and history — staff and asset managers. */
  @Get(':id')
  @RequireRoles(Role.Agent)
  get(@Param('id') id: string): Promise<AssetObjectDto> {
    return this.assets.getObject(id);
  }

  @Get(':id/history')
  @RequireRoles(Role.Agent)
  history(@Param('id') id: string): Promise<ObjectHistoryDto> {
    return this.assets.getHistory(id);
  }

  @Post()
  @RequirePermissions(Permission.ManageObjects)
  create(
    @Body()
    dto: {
      name: string;
      familyId: string;
      locationId?: string | null;
      serialNo?: string;
      inventoryNo?: string;
      fields?: FormValues;
    },
  ): Promise<AssetObjectDto> {
    return this.assets.saveObject(null, dto);
  }

  @Patch(':id')
  @RequirePermissions(Permission.ManageObjects)
  update(@Param('id') id: string, @Body() dto: Record<string, unknown>): Promise<AssetObjectDto> {
    return this.assets.saveObject(id, dto);
  }

  @Post(':id/service-log')
  @RequirePermissions(Permission.ManageObjects)
  addEntry(
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: { date?: string; description?: string; performedBy?: string; cost?: number },
  ): Promise<ServiceLogEntryDto> {
    return this.assets.addServiceEntry(id, req.session.userId as string, dto);
  }
}
