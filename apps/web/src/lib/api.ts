import type {
  AttachmentDto,
  CategoryAdminDto,
  CategoryDto,
  CommentDto,
  CreateCategoryDto,
  CreateTicketDto,
  DashboardDto,
  FormField,
  GroupDto,
  TicketDetailDto,
  TicketListDto,
  TicketPriority,
  TicketStatus,
  UserRefDto,
} from '@tickets/shared';
import { api } from './http';

export const CategoriesApi = {
  list: () => api<CategoryDto[]>('/api/categories'),
  adminList: () => api<CategoryAdminDto[]>('/api/admin/categories'),
  create: (dto: CreateCategoryDto) =>
    api<CategoryAdminDto>('/api/admin/categories', { method: 'POST', body: JSON.stringify(dto) }),
  update: (id: string, patch: Partial<CreateCategoryDto> & { active?: boolean }) =>
    api<CategoryAdminDto>(`/api/admin/categories/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  updateForm: (id: string, fields: FormField[]) =>
    api<CategoryAdminDto>(`/api/admin/categories/${id}/form`, {
      method: 'PUT',
      body: JSON.stringify(fields),
    }),
};

export interface TicketListParams {
  status?: TicketStatus | '';
  categoryId?: string;
  q?: string;
  page?: number;
}

export const TicketsApi = {
  list: (params: TicketListParams = {}) => {
    const search = new URLSearchParams();
    if (params.status) search.set('status', params.status);
    if (params.categoryId) search.set('categoryId', params.categoryId);
    if (params.q) search.set('q', params.q);
    if (params.page) search.set('page', String(params.page));
    const qs = search.toString();
    return api<TicketListDto>(`/api/tickets${qs ? `?${qs}` : ''}`);
  },
  create: (dto: CreateTicketDto) =>
    api<TicketDetailDto>('/api/tickets', { method: 'POST', body: JSON.stringify(dto) }),
  detail: (id: string) => api<TicketDetailDto>(`/api/tickets/${id}`),
  setStatus: (id: string, status: TicketStatus) =>
    api<TicketDetailDto>(`/api/tickets/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  assign: (id: string, assigneeId: string | null) =>
    api<TicketDetailDto>(`/api/tickets/${id}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ assigneeId }),
    }),
  setPriority: (id: string, priority: TicketPriority) =>
    api<TicketDetailDto>(`/api/tickets/${id}/priority`, {
      method: 'PATCH',
      body: JSON.stringify({ priority }),
    }),
  comment: (id: string, body: string, internal: boolean) =>
    api<CommentDto>(`/api/tickets/${id}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body, internal }),
    }),
  upload: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api<AttachmentDto>(`/api/tickets/${id}/attachments`, { method: 'POST', body: form });
  },
};

export const UsersApi = {
  list: () => api<UserRefDto[]>('/api/users'),
};

export const DashboardApi = {
  get: () => api<DashboardDto>('/api/dashboard'),
};

export const AdminApi = {
  groups: () => api<GroupDto[]>('/api/admin/groups'),
};
