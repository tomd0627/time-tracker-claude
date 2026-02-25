# Time Tracker

A full-stack personal time-tracking and invoicing web app built with React, Node.js, and SQLite.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18-green.svg)

---

## Features

### Time Tracking
- **Live timer** — start, stop, pause, and resume with a single click
- **Manual entries** — log past work with custom start/end times
- **Time rounding** — configurable rounding (6, 15, or 30 min) in up/down/nearest direction
- **Tags** — categorize entries with color-coded tags
- **CSV export** — download filtered time entries as a spreadsheet

### Projects & Clients
- Manage clients with contact info, default currency, and hourly rate
- Organize projects per client with status tracking (active / paused / completed / archived)
- Per-project color coding and budget hours
- Soft-delete (archive) keeps historical data intact

### Invoicing
- Auto-numbered invoices with configurable prefix and counter
- Build invoices from unbilled time entries and expenses
- **Double-billing guard** — entries are locked once added to an invoice
- Invoice workflow: Draft → Sent → Paid (or Overdue)
- Tax rate, discount, and custom line items
- **On-demand PDF generation** — professional A4 layout via `pdf-lib` (no headless browser)

### Expenses
- Log billable expenses per project/client
- Attach expenses to invoices alongside time entries

### Reports & Analytics
- Summary stats: total hours, billable hours, entry count, revenue
- Breakdown by client, project, week, or month
- Charts powered by Recharts

### Settings
- Invoice prefix, default tax rate, default payment terms
- Time rounding preferences
- Biller info (name, email, address, phone) used in PDF output
- Dark mode toggle

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Routing | React Router v6 |
| Server state | TanStack Query v5 |
| UI state | Zustand |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Backend | Node.js, Express, TypeScript |
| ORM | Drizzle ORM |
| Database | SQLite via `@libsql/client` |
| Validation | Zod |
| PDF | pdf-lib |
| Monorepo | npm workspaces |

---

## Project Structure

```
time-tracker/
├── package.json          # Root — npm workspaces + concurrently
├── client/               # React frontend (port 5173)
│   └── src/
│       ├── pages/        # Dashboard, TimeEntries, Projects, Clients,
│       │                 #   Invoices, Reports, Settings
│       ├── components/   # AppShell, Sidebar, TimerWidget, Modal, …
│       ├── store/        # Zustand stores (timer, ui, settings)
│       ├── api/          # Typed fetch wrappers for every endpoint
│       ├── types/        # Domain types (inferred from Drizzle schema)
│       └── utils/        # duration, dates, currency, cn helpers
└── server/               # Express API (port 3001)
    └── src/
        ├── routes/       # timeEntries, invoices, clients, projects,
        │                 #   tags, expenses, reports, settings
        ├── services/     # invoiceService, pdfService
        ├── db/           # schema.ts, migrate.ts, connection.ts
        └── middleware/   # error handler, Zod validation
```

---

## Getting Started

### Prerequisites

- Node.js ≥ 18
- npm ≥ 9

### Install

```bash
git clone https://github.com/tomd0627/time-tracker-claude.git
cd time-tracker-claude
npm install
```

### Run (development)

```bash
npm run dev
```

This starts both servers concurrently:

| Service | URL |
|---|---|
| Frontend | http://localhost:5173 |
| Backend API | http://localhost:3001 |

The Vite dev server proxies `/api` requests to the backend automatically.

### Build (production)

```bash
npm run build
```

Compiles TypeScript and bundles the frontend into `client/dist/`.

---

## API Reference

All endpoints are prefixed with `/api`.

### Clients — `/api/clients`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List all clients (`?archived=true` to include archived) |
| GET | `/:id` | Get client with projects and stats |
| POST | `/` | Create client |
| PUT | `/:id` | Update client |
| DELETE | `/:id` | Archive client (soft delete) |

### Projects — `/api/projects`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List (`?clientId`, `?status` filters) with hours spent |
| GET | `/:id` | Get with client info and stats |
| POST | `/` | Create project |
| PUT | `/:id` | Update project |
| DELETE | `/:id` | Archive project |

### Time Entries — `/api/time-entries`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List with filters: `?from`, `?to`, `?projectId`, `?clientId`, `?billable`, `?invoiced`, `?limit`, `?offset` |
| GET | `/running` | Get the currently active timer |
| GET | `/unbilled-entries` | Billable entries not yet on an invoice (`?clientId`) |
| GET | `/export/csv` | Download entries as CSV |
| GET | `/:id` | Get single entry with tags |
| POST | `/` | Create manual entry |
| POST | `/start` | Start a new timer (auto-stops any running timer) |
| POST | `/:id/stop` | Stop a running timer |
| POST | `/:id/pause` | Pause a running timer |
| POST | `/:id/resume` | Resume a paused timer |
| PUT | `/:id` | Update entry |
| DELETE | `/:id` | Delete entry (blocked if invoiced) |

### Invoices — `/api/invoices`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List (`?clientId`, `?status` filters) |
| GET | `/:id` | Get with line items and client |
| POST | `/` | Create invoice (locks linked entries/expenses) |
| PUT | `/:id` | Update draft invoice |
| DELETE | `/:id` | Delete draft invoice (unlocks entries) |
| POST | `/:id/send` | Mark as sent |
| POST | `/:id/mark-paid` | Mark as paid |
| GET | `/:id/pdf` | Stream PDF inline |

### Tags — `/api/tags`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List all tags |
| POST | `/` | Create tag |
| PUT | `/:id` | Update tag |
| DELETE | `/:id` | Delete tag |

### Expenses — `/api/expenses`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List (`?projectId`, `?clientId`, `?invoiced=false`) |
| POST | `/` | Create expense |
| PUT | `/:id` | Update expense |
| DELETE | `/:id` | Delete expense |

### Reports — `/api/reports`
| Method | Path | Description |
|---|---|---|
| GET | `/summary` | Total hours, billable hours, revenue (`?from`, `?to`) |
| GET | `/by-client` | Stats grouped by client |
| GET | `/by-project` | Stats grouped by project |
| GET | `/by-week` | Time-series grouped by ISO week |
| GET | `/by-month` | Time-series grouped by month |

### Settings — `/api/settings`
| Method | Path | Description |
|---|---|---|
| GET | `/` | Fetch app settings |
| PUT | `/` | Update settings |

---

## Database Schema

Nine SQLite tables managed by Drizzle ORM with `IF NOT EXISTS` migrations that run automatically on server startup.

| Table | Purpose |
|---|---|
| `clients` | Client contact info, currency, default rate |
| `projects` | Projects linked to clients, status, budget |
| `tags` | Color-coded labels for time entries |
| `time_entries` | Core timer data — start/end, duration, billable flag |
| `time_entry_tags` | Many-to-many join for tags |
| `expenses` | Billable expenses per project/client |
| `invoices` | Invoice header — number, status, totals, dates |
| `invoice_line_items` | Line items (time entries, expenses, or custom) |
| `settings` | Singleton row for global app configuration |

---

## Key Design Decisions

**libsql over better-sqlite3** — avoids native compilation / Visual Studio C++ requirements on Windows.

**Server owns timer state** — the active timer lives in the database. The Zustand store only drives the live second-by-second UI tick.

**Double-billing guard** — `time_entries.invoice_id` is set when an entry is added to an invoice; the delete endpoint rejects any attempt to remove an invoiced entry, and the update endpoint prevents double-adding.

**PDF without a browser** — `pdf-lib` renders the invoice PDF server-side with no Puppeteer/Playwright dependency.

**Type-first** — frontend TypeScript types are inferred directly from the Drizzle schema, keeping client and server in sync without a code-generation step.

---

## License

MIT
