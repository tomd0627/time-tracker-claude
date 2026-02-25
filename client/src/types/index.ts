// ─── Core domain types ─────────────────────────────────────────────────────

export interface Client {
  id:          number;
  name:        string;
  email:       string | null;
  phone:       string | null;
  address:     string | null;
  city:        string | null;
  country:     string | null;
  currency:    string;
  defaultRate: number | null;
  notes:       string | null;
  isArchived:  boolean;
  createdAt:   number;
  updatedAt:   number;
}

export interface Project {
  id:          number;
  clientId:    number | null;
  name:        string;
  color:       string;
  status:      'active' | 'paused' | 'completed' | 'archived';
  hourlyRate:  number | null;
  budgetHours: number | null;
  notes:       string | null;
  hoursSpent?: number;
  createdAt:   number;
  updatedAt:   number;
}

export interface Tag {
  id:    number;
  name:  string;
  color: string;
}

export interface TimeEntry {
  id:                  number;
  projectId:           number | null;
  clientId:            number | null;
  description:         string | null;
  startedAt:           number;
  endedAt:             number | null;
  durationSecs:        number | null;
  roundedDurationSecs: number | null;
  isBillable:          boolean;
  hourlyRate:          number | null;
  isRunning:           boolean;
  invoiceId:           number | null;
  projectName?:        string | null;
  projectColor?:       string | null;
  clientName?:         string | null;
  tags:                Tag[];
  createdAt:           number;
  updatedAt:           number;
}

export interface InvoiceLineItem {
  id:           number;
  invoiceId:    number;
  timeEntryId:  number | null;
  expenseId:    number | null;
  description:  string;
  quantity:     number;
  unitPrice:    number;
  amount:       number;
  sortOrder:    number;
}

export interface Invoice {
  id:             number;
  clientId:       number;
  invoiceNumber:  string;
  status:         'draft' | 'sent' | 'paid' | 'overdue';
  issueDate:      number;
  dueDate:        number | null;
  currency:       string;
  subtotal:       number;
  taxRate:        number;
  taxAmount:      number;
  discountAmount: number;
  total:          number;
  notes:          string | null;
  pdfPath:        string | null;
  sentAt:         number | null;
  paidAt:         number | null;
  clientName?:    string | null;
  lineItems?:     InvoiceLineItem[];
  client?:        Client | null;
  createdAt:      number;
  updatedAt:      number;
}

export interface Expense {
  id:          number;
  projectId:   number | null;
  clientId:    number | null;
  invoiceId:   number | null;
  description: string;
  amount:      number;
  currency:    string;
  date:        number;
  isBillable:  boolean;
  receiptPath: string | null;
  createdAt:   number;
  updatedAt:   number;
}

export interface Settings {
  id:                  number;
  invoicePrefix:       string;
  invoiceNextNumber:   number;
  defaultCurrency:     string;
  defaultTaxRate:      number;
  timeRoundingMins:    0 | 6 | 15 | 30;
  roundingDirection:   'up' | 'down' | 'nearest';
  defaultPaymentTerms: number;
  invoiceFooterNotes:  string | null;
  darkMode:            boolean;
  myName:              string | null;
  myEmail:             string | null;
  myAddress:           string | null;
  myPhone:             string | null;
}

// ─── Unbilled time entry (enriched with rate fallback chain) ─────────────

export interface UnbilledTimeEntry extends TimeEntry {
  projectRate: number | null;
  clientRate:  number | null;
}

// ─── Report shapes ──────────────────────────────────────────────────────────

export interface ReportSummary {
  totalSecs:    number;
  billableSecs: number;
  entryCount:   number;
  revenue:      number;
}

export interface ReportByClient {
  clientId:     number | null;
  clientName:   string | null;
  totalSecs:    number;
  billableSecs: number;
  revenue:      number;
  entryCount:   number;
}

export interface ReportByProject {
  projectId:    number | null;
  projectName:  string | null;
  projectColor: string | null;
  clientId:     number | null;
  clientName:   string | null;
  totalSecs:    number;
  billableSecs: number;
  revenue:      number;
  entryCount:   number;
}

export interface ReportByWeek {
  week:         string;
  totalSecs:    number;
  billableSecs: number;
  entryCount:   number;
}

export interface ReportByMonth {
  month:        string;
  totalSecs:    number;
  billableSecs: number;
  revenue:      number;
  entryCount:   number;
}

export interface ReportExpenseByCurrency {
  currency: string;
  total:    number;
  billable: number;
  count:    number;
}

export interface ReportExpenses {
  byCurrency: ReportExpenseByCurrency[];
}

// ─── Invoice input types ────────────────────────────────────────────────────

export interface InvoiceLineItemInput {
  timeEntryId?: number | null;
  expenseId?:   number | null;
  description:  string;
  quantity:     number;
  unitPrice:    number;
}

export interface InvoiceCreateInput {
  clientId:       number | undefined;
  currency:       string;
  issueDate:      number;
  dueDate:        number | null;
  taxRate:        number;
  discountAmount: number;
  notes:          string | null;
  lineItems:      InvoiceLineItemInput[];
}

// ─── API response wrapper ──────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  meta?: { total: number; limit: number; offset: number };
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}
