import type { FormField, FormValues } from './forms';
import type { TicketPriority, TicketStatus } from './tickets';

export interface UserRefDto {
  id: string;
  displayName: string;
}

/** "If form field <field> equals <equals> → set <priority>". First match wins. */
export interface PriorityRule {
  field: string;
  equals: string | number | boolean;
  priority: TicketPriority;
}

export interface CategoryDto {
  id: string;
  name: string;
  description: string;
  parentId: string | null;
  defaultPriority: TicketPriority;
  /** When false (default), requesters cannot pick a priority — rules/default apply. */
  allowRequesterPriority: boolean;
  active: boolean;
  formFields: FormField[];
}

export interface CategoryAdminDto extends CategoryDto {
  agentGroups: string[];
  priorityRules: PriorityRule[];
  formVersion: number;
  sortOrder: number;
}

export interface CreateCategoryDto {
  name: string;
  description?: string;
  parentId?: string | null;
  agentGroups?: string[];
  defaultPriority?: TicketPriority;
  allowRequesterPriority?: boolean;
  priorityRules?: PriorityRule[];
}

export interface CreateTicketDto {
  categoryId: string;
  title: string;
  description?: string;
  priority?: TicketPriority;
  formValues?: FormValues;
}

export interface TicketSummaryDto {
  id: string;
  ticketNo: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  categoryId: string;
  categoryName: string;
  requester: UserRefDto;
  assignee: UserRefDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface TicketListDto {
  items: TicketSummaryDto[];
  total: number;
  page: number;
  pageSize: number;
}

export interface TicketEventDto {
  id: string;
  type: string;
  actor: UserRefDto | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface CommentDto {
  id: string;
  author: UserRefDto;
  body: string;
  internal: boolean;
  createdAt: string;
}

export interface AttachmentDto {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  uploader: UserRefDto;
  createdAt: string;
}

export interface DashboardAlertDto {
  kind: 'unassigned' | 'critical_open' | 'stale' | 'waiting_on_you';
  count: number;
}

export interface DashboardDto {
  /** Viewer works tickets (manager or agent of at least one category). */
  staff: boolean;
  openTotal: number;
  openByStatus: Partial<Record<TicketStatus, number>>;
  myAssignedOpen: number;
  myRequestedOpen: number;
  alerts: DashboardAlertDto[];
  /** Most recently updated open tickets in the viewer's scope. */
  recent: TicketSummaryDto[];
}

export interface TicketDetailDto extends TicketSummaryDto {
  description: string;
  formFields: FormField[];
  formValues: FormValues;
  events: TicketEventDto[];
  comments: CommentDto[];
  attachments: AttachmentDto[];
  /** Current viewer capabilities, resolved server-side. */
  canManage: boolean;
  canComment: boolean;
  canInternal: boolean;
  canCancel: boolean;
}
