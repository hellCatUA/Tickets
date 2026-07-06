import type { FormField, FormValues } from './forms';
import type { TicketPriority, TicketStatus } from './tickets';

export interface UserRefDto {
  id: string;
  displayName: string;
}

export interface CategoryDto {
  id: string;
  name: string;
  description: string;
  parentId: string | null;
  defaultPriority: TicketPriority;
  active: boolean;
  formFields: FormField[];
}

export interface CategoryAdminDto extends CategoryDto {
  agentGroups: string[];
  formVersion: number;
  sortOrder: number;
}

export interface CreateCategoryDto {
  name: string;
  description?: string;
  parentId?: string | null;
  agentGroups?: string[];
  defaultPriority?: TicketPriority;
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
