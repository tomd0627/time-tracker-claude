import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';

// ─── CLIENTS ───────────────────────────────────────────────────────────────
export const clients = sqliteTable('clients', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  name:        text('name').notNull(),
  email:       text('email'),
  phone:       text('phone'),
  address:     text('address'),
  city:        text('city'),
  country:     text('country'),
  currency:    text('currency').notNull().default('USD'),
  defaultRate: real('default_rate'),
  notes:       text('notes'),
  isArchived:  integer('is_archived', { mode: 'boolean' }).notNull().default(false),
  createdAt:   integer('created_at').notNull(),
  updatedAt:   integer('updated_at').notNull(),
});

// ─── PROJECTS ──────────────────────────────────────────────────────────────
export const projects = sqliteTable('projects', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  clientId:    integer('client_id').references(() => clients.id),
  name:        text('name').notNull(),
  color:       text('color').notNull().default('#6366f1'),
  status:      text('status').notNull().default('active'), // active | paused | completed | archived
  hourlyRate:  real('hourly_rate'),
  budgetHours: real('budget_hours'),
  notes:       text('notes'),
  createdAt:   integer('created_at').notNull(),
  updatedAt:   integer('updated_at').notNull(),
});

// ─── TAGS ──────────────────────────────────────────────────────────────────
export const tags = sqliteTable('tags', {
  id:    integer('id').primaryKey({ autoIncrement: true }),
  name:  text('name').notNull().unique(),
  color: text('color').notNull().default('#94a3b8'),
});

// ─── TIME ENTRIES ──────────────────────────────────────────────────────────
export const timeEntries = sqliteTable('time_entries', {
  id:                   integer('id').primaryKey({ autoIncrement: true }),
  projectId:            integer('project_id').references(() => projects.id),
  clientId:             integer('client_id').references(() => clients.id),
  description:          text('description'),
  startedAt:            integer('started_at').notNull(),
  endedAt:              integer('ended_at'),
  durationSecs:         integer('duration_secs'),
  isBillable:           integer('is_billable', { mode: 'boolean' }).notNull().default(true),
  hourlyRate:           real('hourly_rate'),
  isRunning:            integer('is_running', { mode: 'boolean' }).notNull().default(false),
  roundedDurationSecs:  integer('rounded_duration_secs'),
  invoiceId:            integer('invoice_id'),
  createdAt:            integer('created_at').notNull(),
  updatedAt:            integer('updated_at').notNull(),
});

export const timeEntryTags = sqliteTable('time_entry_tags', {
  timeEntryId: integer('time_entry_id').notNull().references(() => timeEntries.id, { onDelete: 'cascade' }),
  tagId:       integer('tag_id').notNull().references(() => tags.id, { onDelete: 'cascade' }),
}, (t) => ({
  pk: primaryKey({ columns: [t.timeEntryId, t.tagId] }),
}));

// ─── EXPENSES ──────────────────────────────────────────────────────────────
export const expenses = sqliteTable('expenses', {
  id:          integer('id').primaryKey({ autoIncrement: true }),
  projectId:   integer('project_id').references(() => projects.id),
  clientId:    integer('client_id').references(() => clients.id),
  invoiceId:   integer('invoice_id'),
  description: text('description').notNull(),
  amount:      real('amount').notNull(),
  currency:    text('currency').notNull().default('USD'),
  date:        integer('date').notNull(),
  isBillable:  integer('is_billable', { mode: 'boolean' }).notNull().default(true),
  receiptPath: text('receipt_path'),
  createdAt:   integer('created_at').notNull(),
  updatedAt:   integer('updated_at').notNull(),
});

// ─── INVOICES ──────────────────────────────────────────────────────────────
export const invoices = sqliteTable('invoices', {
  id:             integer('id').primaryKey({ autoIncrement: true }),
  clientId:       integer('client_id').notNull().references(() => clients.id),
  invoiceNumber:  text('invoice_number').notNull().unique(),
  status:         text('status').notNull().default('draft'), // draft | sent | paid | overdue
  issueDate:      integer('issue_date').notNull(),
  dueDate:        integer('due_date'),
  currency:       text('currency').notNull().default('USD'),
  subtotal:       real('subtotal').notNull().default(0),
  taxRate:        real('tax_rate').notNull().default(0),
  taxAmount:      real('tax_amount').notNull().default(0),
  discountAmount: real('discount_amount').notNull().default(0),
  total:          real('total').notNull().default(0),
  notes:          text('notes'),
  pdfPath:        text('pdf_path'),
  sentAt:         integer('sent_at'),
  paidAt:         integer('paid_at'),
  createdAt:      integer('created_at').notNull(),
  updatedAt:      integer('updated_at').notNull(),
});

export const invoiceLineItems = sqliteTable('invoice_line_items', {
  id:           integer('id').primaryKey({ autoIncrement: true }),
  invoiceId:    integer('invoice_id').notNull().references(() => invoices.id, { onDelete: 'cascade' }),
  timeEntryId:  integer('time_entry_id').references(() => timeEntries.id),
  expenseId:    integer('expense_id').references(() => expenses.id),
  description:  text('description').notNull(),
  quantity:     real('quantity').notNull().default(1),
  unitPrice:    real('unit_price').notNull(),
  amount:       real('amount').notNull(),
  sortOrder:    integer('sort_order').notNull().default(0),
});

// ─── SETTINGS ──────────────────────────────────────────────────────────────
export const settings = sqliteTable('settings', {
  id:                  integer('id').primaryKey().default(1),
  invoicePrefix:       text('invoice_prefix').notNull().default('INV'),
  invoiceNextNumber:   integer('invoice_next_number').notNull().default(1),
  defaultCurrency:     text('default_currency').notNull().default('USD'),
  defaultTaxRate:      real('default_tax_rate').notNull().default(0),
  timeRoundingMins:    integer('time_rounding_mins').notNull().default(0), // 0=off, 6, 15, 30
  roundingDirection:   text('rounding_direction').notNull().default('nearest'), // up | down | nearest
  defaultPaymentTerms: integer('default_payment_terms').notNull().default(30),
  invoiceFooterNotes:  text('invoice_footer_notes'),
  darkMode:            integer('dark_mode', { mode: 'boolean' }).notNull().default(false),
  myName:              text('my_name'),
  myEmail:             text('my_email'),
  myAddress:           text('my_address'),
  myPhone:             text('my_phone'),
});

// ─── INFERRED TYPES ────────────────────────────────────────────────────────
export type Client        = typeof clients.$inferSelect;
export type NewClient     = typeof clients.$inferInsert;
export type Project       = typeof projects.$inferSelect;
export type NewProject    = typeof projects.$inferInsert;
export type Tag           = typeof tags.$inferSelect;
export type NewTag        = typeof tags.$inferInsert;
export type TimeEntry     = typeof timeEntries.$inferSelect;
export type NewTimeEntry  = typeof timeEntries.$inferInsert;
export type Expense       = typeof expenses.$inferSelect;
export type NewExpense    = typeof expenses.$inferInsert;
export type Invoice       = typeof invoices.$inferSelect;
export type NewInvoice    = typeof invoices.$inferInsert;
export type InvoiceLineItem    = typeof invoiceLineItems.$inferSelect;
export type NewInvoiceLineItem = typeof invoiceLineItems.$inferInsert;
export type Settings      = typeof settings.$inferSelect;
