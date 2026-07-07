import type { FormField, FormValues } from './forms';
import type { TicketSummaryDto, UserRefDto } from './tickets-dto';

export interface LocationDto {
  id: string;
  name: string;
  parentId: string | null;
  active: boolean;
}

export interface ObjectFamilyDto {
  id: string;
  name: string;
  description: string;
  fields: FormField[];
  /** Category pre-selected when a device of this family is scanned via QR. */
  defaultCategoryId: string | null;
}

export interface AssetObjectSummaryDto {
  id: string;
  name: string;
  serialNo: string;
  inventoryNo: string;
  familyId: string;
  familyName: string;
  locationId: string | null;
  locationName: string | null;
  active: boolean;
}

export interface AssetObjectDto extends AssetObjectSummaryDto {
  fields: FormValues;
  familyFields: FormField[];
  qrToken: string;
}

export interface ServiceLogEntryDto {
  id: string;
  date: string;
  description: string;
  performedBy: string;
  cost: number;
  createdBy: UserRefDto | null;
  createdAt: string;
}

export interface ObjectHistoryDto {
  tickets: TicketSummaryDto[];
  entries: ServiceLogEntryDto[];
  totals: { tickets: number; services: number; totalCost: number };
}

/** Minimal info resolved from a QR token for the new-ticket prefill. */
export interface ObjectByTokenDto {
  id: string;
  name: string;
  serialNo: string;
  familyId: string;
  familyName: string;
  defaultCategoryId: string | null;
  locationId: string | null;
  locationName: string | null;
}
