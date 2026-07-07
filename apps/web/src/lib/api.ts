import type {
  AssetObjectDto,
  AssetObjectSummaryDto,
  AttachmentDto,
  AutomationRuleDto,
  AutomationRunResultDto,
  CategoryAdminDto,
  CategoryDto,
  CommentDto,
  CreateCategoryDto,
  CreateTicketDto,
  DashboardDto,
  FormField,
  FormValues,
  GroupDto,
  LocationDto,
  NotificationListDto,
  MaintenancePlanDto,
  NotificationPrefsDto,
  ObjectByTokenDto,
  ObjectFamilyDto,
  ObjectHistoryDto,
  PermissionGrantDto,
  ProblemDto,
  ServiceLogEntryDto,
  RoleMappingDto,
  SyncResultDto,
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
  setCategory: (id: string, categoryId: string) =>
    api<TicketDetailDto>(`/api/tickets/${id}/category`, {
      method: 'PATCH',
      body: JSON.stringify({ categoryId }),
    }),
  setObject: (id: string, objectId: string | null) =>
    api<TicketDetailDto>(`/api/tickets/${id}/object`, {
      method: 'PATCH',
      body: JSON.stringify({ objectId }),
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

export const ProblemsApi = {
  list: (familyId?: string, all = false) => {
    const search = new URLSearchParams();
    if (familyId) search.set('familyId', familyId);
    if (all) search.set('all', '1');
    const qs = search.toString();
    return api<ProblemDto[]>(`/api/problems${qs ? `?${qs}` : ''}`);
  },
  save: (id: string | null, dto: Partial<ProblemDto>) =>
    api<ProblemDto>(id ? `/api/problems/${id}` : '/api/problems', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(dto),
    }),
};

export const MaintenanceApi = {
  list: () => api<MaintenancePlanDto[]>('/api/admin/maintenance'),
  save: (id: string | null, dto: Partial<MaintenancePlanDto>) =>
    api<MaintenancePlanDto>(id ? `/api/admin/maintenance/${id}` : '/api/admin/maintenance', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(dto),
    }),
  run: (id: string) =>
    api<{ created: number; plan: MaintenancePlanDto }>(`/api/admin/maintenance/${id}/run`, {
      method: 'POST',
    }),
};

export const AssetsApi = {
  locations: (all = false) => api<LocationDto[]>(`/api/locations${all ? '?all=1' : ''}`),
  saveLocation: (id: string | null, dto: Partial<LocationDto>) =>
    api<LocationDto>(id ? `/api/locations/${id}` : '/api/locations', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(dto),
    }),
  families: () => api<ObjectFamilyDto[]>('/api/object-families'),
  saveFamily: (
    id: string | null,
    dto: {
      name?: string;
      description?: string;
      fields?: FormField[];
      defaultCategoryId?: string | null;
    },
  ) =>
    api<ObjectFamilyDto>(id ? `/api/object-families/${id}` : '/api/object-families', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(dto),
    }),
  objects: (filters: { familyId?: string; locationId?: string; q?: string; all?: boolean } = {}) => {
    const search = new URLSearchParams();
    if (filters.familyId) search.set('familyId', filters.familyId);
    if (filters.locationId) search.set('locationId', filters.locationId);
    if (filters.q) search.set('q', filters.q);
    if (filters.all) search.set('all', '1');
    const qs = search.toString();
    return api<AssetObjectSummaryDto[]>(`/api/objects${qs ? `?${qs}` : ''}`);
  },
  object: (id: string) => api<AssetObjectDto>(`/api/objects/${id}`),
  objectByToken: (token: string) =>
    api<ObjectByTokenDto>(`/api/objects/by-token/${encodeURIComponent(token)}`),
  saveObject: (
    id: string | null,
    dto: {
      name?: string;
      familyId?: string;
      locationId?: string | null;
      serialNo?: string;
      inventoryNo?: string;
      fields?: FormValues;
      active?: boolean;
    },
  ) =>
    api<AssetObjectDto>(id ? `/api/objects/${id}` : '/api/objects', {
      method: id ? 'PATCH' : 'POST',
      body: JSON.stringify(dto),
    }),
  history: (id: string) => api<ObjectHistoryDto>(`/api/objects/${id}/history`),
  addServiceEntry: (
    id: string,
    dto: { date?: string; description: string; performedBy?: string; cost?: number },
  ) =>
    api<ServiceLogEntryDto>(`/api/objects/${id}/service-log`, {
      method: 'POST',
      body: JSON.stringify(dto),
    }),
};

export const AdminApi = {
  groups: () => api<GroupDto[]>('/api/admin/groups'),
  roleMappings: () => api<RoleMappingDto[]>('/api/admin/role-mappings'),
  saveRoleMappings: (mappings: RoleMappingDto[]) =>
    api<RoleMappingDto[]>('/api/admin/role-mappings', {
      method: 'PUT',
      body: JSON.stringify(mappings),
    }),
  permissionGrants: () => api<PermissionGrantDto[]>('/api/admin/permission-grants'),
  savePermissionGrants: (grants: PermissionGrantDto[]) =>
    api<PermissionGrantDto[]>('/api/admin/permission-grants', {
      method: 'PUT',
      body: JSON.stringify(grants),
    }),
  lastSync: () => api<SyncResultDto | null>('/api/admin/sync'),
  runSync: () => api<SyncResultDto>('/api/admin/sync', { method: 'POST' }),
  automationRules: () => api<AutomationRuleDto[]>('/api/admin/automation'),
  saveAutomationRules: (rules: AutomationRuleDto[]) =>
    api<AutomationRuleDto[]>('/api/admin/automation', {
      method: 'PUT',
      body: JSON.stringify(rules),
    }),
  runAutomation: () =>
    api<AutomationRunResultDto>('/api/admin/automation/run', { method: 'POST' }),
};

export const NotificationsApi = {
  list: (limit = 20) => api<NotificationListDto>(`/api/notifications?limit=${limit}`),
  markRead: (ids?: string[]) =>
    api<{ unreadCount: number }>('/api/notifications/read', {
      method: 'POST',
      body: JSON.stringify(ids ? { ids } : {}),
    }),
};

export const PushApi = {
  key: () => api<{ key: string }>('/api/push/key'),
  status: () => api<{ subscribed: boolean }>('/api/push/status'),
  subscribe: (subscription: unknown) =>
    api<{ ok: true }>('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify(subscription),
    }),
  unsubscribe: (endpoint: string) =>
    api<{ ok: true }>('/api/push/unsubscribe', {
      method: 'POST',
      body: JSON.stringify({ endpoint }),
    }),
};

export const PreferencesApi = {
  get: () => api<NotificationPrefsDto>('/api/notification-preferences'),
  put: (prefs: NotificationPrefsDto['prefs']) =>
    api<NotificationPrefsDto>('/api/notification-preferences', {
      method: 'PUT',
      body: JSON.stringify({ prefs }),
    }),
};
