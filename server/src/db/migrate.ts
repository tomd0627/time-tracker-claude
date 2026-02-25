import { client } from './connection';

export async function runMigrations() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS clients (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      name         TEXT    NOT NULL,
      email        TEXT,
      phone        TEXT,
      address      TEXT,
      city         TEXT,
      country      TEXT,
      currency     TEXT    NOT NULL DEFAULT 'USD',
      default_rate REAL,
      notes        TEXT,
      is_archived  INTEGER NOT NULL DEFAULT 0,
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS projects (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id    INTEGER REFERENCES clients(id) ON DELETE SET NULL,
      name         TEXT    NOT NULL,
      color        TEXT    NOT NULL DEFAULT '#6366f1',
      status       TEXT    NOT NULL DEFAULT 'active',
      hourly_rate  REAL,
      budget_hours REAL,
      notes        TEXT,
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS tags (
      id    INTEGER PRIMARY KEY AUTOINCREMENT,
      name  TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#94a3b8'
    )`,
    `CREATE TABLE IF NOT EXISTS time_entries (
      id                    INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id            INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      client_id             INTEGER REFERENCES clients(id)  ON DELETE SET NULL,
      description           TEXT,
      started_at            INTEGER NOT NULL,
      ended_at              INTEGER,
      duration_secs         INTEGER,
      is_billable           INTEGER NOT NULL DEFAULT 1,
      hourly_rate           REAL,
      is_running            INTEGER NOT NULL DEFAULT 0,
      rounded_duration_secs INTEGER,
      invoice_id            INTEGER,
      created_at            INTEGER NOT NULL,
      updated_at            INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS time_entry_tags (
      time_entry_id INTEGER NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
      tag_id        INTEGER NOT NULL REFERENCES tags(id)         ON DELETE CASCADE,
      PRIMARY KEY (time_entry_id, tag_id)
    )`,
    `CREATE TABLE IF NOT EXISTS expenses (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id   INTEGER REFERENCES projects(id) ON DELETE SET NULL,
      client_id    INTEGER REFERENCES clients(id)  ON DELETE SET NULL,
      invoice_id   INTEGER,
      description  TEXT    NOT NULL,
      amount       REAL    NOT NULL,
      currency     TEXT    NOT NULL DEFAULT 'USD',
      date         INTEGER NOT NULL,
      is_billable  INTEGER NOT NULL DEFAULT 1,
      receipt_path TEXT,
      created_at   INTEGER NOT NULL,
      updated_at   INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS invoices (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id       INTEGER NOT NULL REFERENCES clients(id),
      invoice_number  TEXT    NOT NULL UNIQUE,
      status          TEXT    NOT NULL DEFAULT 'draft',
      issue_date      INTEGER NOT NULL,
      due_date        INTEGER,
      currency        TEXT    NOT NULL DEFAULT 'USD',
      subtotal        REAL    NOT NULL DEFAULT 0,
      tax_rate        REAL    NOT NULL DEFAULT 0,
      tax_amount      REAL    NOT NULL DEFAULT 0,
      discount_amount REAL    NOT NULL DEFAULT 0,
      total           REAL    NOT NULL DEFAULT 0,
      notes           TEXT,
      pdf_path        TEXT,
      sent_at         INTEGER,
      paid_at         INTEGER,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS invoice_line_items (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      invoice_id    INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
      time_entry_id INTEGER REFERENCES time_entries(id) ON DELETE SET NULL,
      expense_id    INTEGER REFERENCES expenses(id)     ON DELETE SET NULL,
      description   TEXT    NOT NULL,
      quantity      REAL    NOT NULL DEFAULT 1,
      unit_price    REAL    NOT NULL,
      amount        REAL    NOT NULL,
      sort_order    INTEGER NOT NULL DEFAULT 0
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      id                    INTEGER PRIMARY KEY DEFAULT 1 CHECK(id = 1),
      invoice_prefix        TEXT    NOT NULL DEFAULT 'INV',
      invoice_next_number   INTEGER NOT NULL DEFAULT 1,
      default_currency      TEXT    NOT NULL DEFAULT 'USD',
      default_tax_rate      REAL    NOT NULL DEFAULT 0,
      time_rounding_mins    INTEGER NOT NULL DEFAULT 0,
      rounding_direction    TEXT    NOT NULL DEFAULT 'nearest',
      default_payment_terms INTEGER NOT NULL DEFAULT 30,
      invoice_footer_notes  TEXT,
      dark_mode             INTEGER NOT NULL DEFAULT 0,
      my_name               TEXT,
      my_email              TEXT,
      my_address            TEXT,
      my_phone              TEXT
    )`,
    `CREATE INDEX IF NOT EXISTS idx_time_entries_project    ON time_entries(project_id)`,
    `CREATE INDEX IF NOT EXISTS idx_time_entries_client     ON time_entries(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_time_entries_started_at ON time_entries(started_at)`,
    `CREATE INDEX IF NOT EXISTS idx_time_entries_is_running ON time_entries(is_running)`,
    `CREATE INDEX IF NOT EXISTS idx_time_entries_invoice    ON time_entries(invoice_id)`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_client         ON invoices(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_invoices_status         ON invoices(status)`,
    `CREATE INDEX IF NOT EXISTS idx_projects_client         ON projects(client_id)`,
    `CREATE INDEX IF NOT EXISTS idx_expenses_project        ON expenses(project_id)`,
    `INSERT OR IGNORE INTO settings (id) VALUES (1)`,
  ];

  for (const sql of statements) {
    await client.execute(sql);
  }

  console.log('✓ Database migrations complete');
}
