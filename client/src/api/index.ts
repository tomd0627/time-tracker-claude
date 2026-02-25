import { get, post, put, del } from './client';
import type {
  ApiResponse, Client, Project, Tag, TimeEntry,
  Invoice, Expense, Settings
} from '../types';

// ─── Clients ────────────────────────────────────────────────────────────────
export const clientsApi = {
  list: (archived?: boolean) =>
    get<ApiResponse<Client[]>>('/clients', { archived }),
  get: (id: number) =>
    get<ApiResponse<Client & { projects: Project[]; stats: unknown }>>(`/clients/${id}`),
  create: (data: Partial<Client>) =>
    post<ApiResponse<Client>>('/clients', data),
  update: (id: number, data: Partial<Client>) =>
    put<ApiResponse<Client>>(`/clients/${id}`, data),
  delete: (id: number) =>
    del(`/clients/${id}`),
};

// ─── Projects ───────────────────────────────────────────────────────────────
export const projectsApi = {
  list: (params?: { clientId?: number; status?: string }) =>
    get<ApiResponse<Project[]>>('/projects', params),
  get: (id: number) =>
    get<ApiResponse<Project & { client: Client | null; stats: unknown }>>(`/projects/${id}`),
  create: (data: Partial<Project>) =>
    post<ApiResponse<Project>>('/projects', data),
  update: (id: number, data: Partial<Project>) =>
    put<ApiResponse<Project>>(`/projects/${id}`, data),
  delete: (id: number) =>
    del(`/projects/${id}`),
};

// ─── Tags ────────────────────────────────────────────────────────────────────
export const tagsApi = {
  list: () => get<ApiResponse<Tag[]>>('/tags'),
  create: (data: { name: string; color?: string }) =>
    post<ApiResponse<Tag>>('/tags', data),
  update: (id: number, data: Partial<Tag>) =>
    put<ApiResponse<Tag>>(`/tags/${id}`, data),
  delete: (id: number) =>
    del(`/tags/${id}`),
};

// ─── Time Entries ────────────────────────────────────────────────────────────
export type TimeEntryFilters = {
  from?: number; to?: number; projectId?: number; clientId?: number;
  billable?: boolean; invoiced?: boolean; limit?: number; offset?: number;
};

export const timeEntriesApi = {
  list: (filters?: TimeEntryFilters) =>
    get<ApiResponse<TimeEntry[]>>('/time-entries', filters as any),
  get: (id: number) =>
    get<ApiResponse<TimeEntry>>(`/time-entries/${id}`),
  running: () =>
    get<ApiResponse<TimeEntry | null>>('/time-entries/running'),
  unbilledEntries: (clientId?: number) =>
    get<ApiResponse<TimeEntry[]>>('/time-entries/unbilled-entries', { clientId }),
  create: (data: Partial<TimeEntry> & { tagIds?: number[] }) =>
    post<ApiResponse<TimeEntry>>('/time-entries', data),
  start: (data: { projectId?: number; clientId?: number; description?: string; isBillable?: boolean; hourlyRate?: number; tagIds?: number[] }) =>
    post<ApiResponse<TimeEntry>>('/time-entries/start', data),
  stop: (id: number) =>
    post<ApiResponse<TimeEntry>>(`/time-entries/${id}/stop`),
  pause: (id: number) =>
    post<ApiResponse<TimeEntry>>(`/time-entries/${id}/pause`),
  resume: (id: number) =>
    post<ApiResponse<TimeEntry>>(`/time-entries/${id}/resume`),
  update: (id: number, data: Partial<TimeEntry> & { tagIds?: number[] }) =>
    put<ApiResponse<TimeEntry>>(`/time-entries/${id}`, data),
  delete: (id: number) =>
    del(`/time-entries/${id}`),
  exportCsv: (filters?: TimeEntryFilters) => {
    const params = new URLSearchParams(
      Object.fromEntries(
        Object.entries(filters ?? {})
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      )
    );
    window.location.href = `/api/time-entries/export/csv?${params}`;
  },
};

// ─── Invoices ────────────────────────────────────────────────────────────────
export const invoicesApi = {
  list: (params?: { clientId?: number; status?: string }) =>
    get<ApiResponse<Invoice[]>>('/invoices', params),
  get: (id: number) =>
    get<ApiResponse<Invoice>>(`/invoices/${id}`),
  create: (data: unknown) =>
    post<ApiResponse<Invoice>>('/invoices', data),
  update: (id: number, data: unknown) =>
    put<ApiResponse<Invoice>>(`/invoices/${id}`, data),
  delete: (id: number) =>
    del(`/invoices/${id}`),
  send: (id: number) =>
    post<ApiResponse<Invoice>>(`/invoices/${id}/send`),
  markPaid: (id: number) =>
    post<ApiResponse<Invoice>>(`/invoices/${id}/mark-paid`),
  pdfUrl: (id: number) => `/api/invoices/${id}/pdf`,
};

// ─── Expenses ────────────────────────────────────────────────────────────────
export const expensesApi = {
  list: (params?: { projectId?: number; clientId?: number; invoiced?: boolean }) =>
    get<ApiResponse<Expense[]>>('/expenses', params as any),
  create: (data: Partial<Expense>) =>
    post<ApiResponse<Expense>>('/expenses', data),
  update: (id: number, data: Partial<Expense>) =>
    put<ApiResponse<Expense>>(`/expenses/${id}`, data),
  delete: (id: number) =>
    del(`/expenses/${id}`),
};

// ─── Reports ─────────────────────────────────────────────────────────────────
export const reportsApi = {
  summary:   (from?: number, to?: number) => get<ApiResponse<unknown>>('/reports/summary', { from, to }),
  byClient:  (from?: number, to?: number) => get<ApiResponse<unknown[]>>('/reports/by-client', { from, to }),
  byProject: (from?: number, to?: number) => get<ApiResponse<unknown[]>>('/reports/by-project', { from, to }),
  byWeek:    (from?: number, to?: number) => get<ApiResponse<unknown[]>>('/reports/by-week', { from, to }),
  byMonth:   (from?: number, to?: number) => get<ApiResponse<unknown[]>>('/reports/by-month', { from, to }),
};

// ─── Settings ────────────────────────────────────────────────────────────────
export const settingsApi = {
  get: () => get<ApiResponse<Settings>>('/settings'),
  update: (data: Partial<Settings>) => put<ApiResponse<Settings>>('/settings', data),
};
