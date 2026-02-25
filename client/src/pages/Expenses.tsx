import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { clientsApi, expensesApi, projectsApi, settingsApi } from '../api';
import type { Expense, Project, Client } from '../types';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Modal } from '../components/ui/Modal';
import { CURRENCIES, formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/dates';

// ─── Form ────────────────────────────────────────────────────────────────────

interface ExpenseFormValues {
  description: string;
  amount:      string;
  currency:    string;
  date:        string;
  projectId:   string;
  clientId:    string;
  isBillable:  boolean;
}

function ExpenseForm({
  expense,
  defaultCurrency,
  onClose,
}: {
  expense?: Expense;
  defaultCurrency: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { data: projectsData } = useQuery({ queryKey: ['projects', {}], queryFn: () => projectsApi.list() });
  const { data: clientsData }  = useQuery({ queryKey: ['clients'],     queryFn: () => clientsApi.list() });

  const { register, handleSubmit, formState: { errors } } = useForm<ExpenseFormValues>({
    defaultValues: {
      description: expense?.description ?? '',
      amount:      expense ? String(expense.amount) : '',
      currency:    expense?.currency ?? defaultCurrency,
      date:        expense
        ? format(new Date(expense.date), 'yyyy-MM-dd')
        : format(new Date(), 'yyyy-MM-dd'),
      projectId:   String(expense?.projectId ?? ''),
      clientId:    String(expense?.clientId  ?? ''),
      isBillable:  expense?.isBillable ?? true,
    },
  });

  const mutation = useMutation({
    mutationFn: (vals: ExpenseFormValues) => {
      const [y, m, d] = vals.date.split('-').map(Number);
      const payload = {
        description: vals.description,
        amount:      parseFloat(vals.amount),
        currency:    vals.currency,
        date:        new Date(y, m - 1, d).getTime(),
        projectId:   vals.projectId ? parseInt(vals.projectId, 10) : null,
        clientId:    vals.clientId  ? parseInt(vals.clientId,  10) : null,
        isBillable:  vals.isBillable,
      };
      return expense
        ? expensesApi.update(expense.id, payload)
        : expensesApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['expenses'] });
      toast.success(expense ? 'Expense updated.' : 'Expense added.');
      onClose();
    },
  });

  const projects = projectsData?.data ?? [];
  const clients  = clientsData?.data  ?? [];

  return (
    <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="space-y-4">
      <div>
        <label htmlFor="exp-desc" className="label">Description</label>
        <input
          id="exp-desc"
          className="input"
          placeholder="What was this expense for?"
          {...register('description', { required: true })}
        />
        {errors.description && <p className="text-xs text-red-500 mt-1">Description is required</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="exp-amount" className="label">Amount</label>
          <input
            id="exp-amount"
            className="input"
            type="number"
            step="0.01"
            min="0.01"
            placeholder="0.00"
            {...register('amount', { required: true, min: 0.01 })}
          />
          {errors.amount && <p className="text-xs text-red-500 mt-1">Enter a valid amount</p>}
        </div>
        <div>
          <label htmlFor="exp-currency" className="label">Currency</label>
          <select id="exp-currency" className="input" {...register('currency')}>
            {CURRENCIES.map(c => (
              <option key={c.code} value={c.code}>{c.code} — {c.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="exp-date" className="label">Date</label>
        <input
          id="exp-date"
          className="input"
          type="date"
          {...register('date', { required: true })}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="exp-project" className="label">Project</label>
          <select id="exp-project" className="input" {...register('projectId')}>
            <option value="">No project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="exp-client" className="label">Client</label>
          <select id="exp-client" className="input" {...register('clientId')}>
            <option value="">No client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="exp-billable"
          type="checkbox"
          className="w-4 h-4 rounded accent-brand-500"
          {...register('isBillable')}
        />
        <label htmlFor="exp-billable" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer select-none">
          Billable
        </label>
      </div>

      <div className="flex gap-3 justify-end pt-1">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : expense ? 'Update' : 'Add Expense'}
        </button>
      </div>
    </form>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function Expenses() {
  const qc = useQueryClient();
  const [showForm,    setShowForm]    = useState(false);
  const [editExpense, setEditExpense] = useState<Expense | undefined>();
  const [deleteId,    setDeleteId]    = useState<number | undefined>();

  const now = new Date();
  const [fromDate,       setFromDate]       = useState(format(new Date(now.getFullYear(), now.getMonth(), 1), 'yyyy-MM-dd'));
  const [toDate,         setToDate]         = useState(format(now, 'yyyy-MM-dd'));
  const [filterClient,   setFilterClient]   = useState('');
  const [filterBillable, setFilterBillable] = useState<'' | 'true' | 'false'>('');

  const { data: settingsData } = useQuery({ queryKey: ['settings'], queryFn: () => settingsApi.get() });
  const { data: clientsData }  = useQuery({ queryKey: ['clients'],  queryFn: () => clientsApi.list() });
  const { data: projectsData } = useQuery({ queryKey: ['projects', {}], queryFn: () => projectsApi.list() });

  const { data, isLoading } = useQuery({
    queryKey: ['expenses', { clientId: filterClient || undefined }],
    queryFn:  () => expensesApi.list({
      clientId: filterClient ? parseInt(filterClient, 10) : undefined,
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => expensesApi.delete(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['expenses'] }); toast.success('Expense deleted.'); },
  });

  const defaultCurrency = settingsData?.data?.defaultCurrency ?? 'USD';
  const clients  = clientsData?.data  ?? [];
  const projects = projectsData?.data ?? [];

  // Lookup maps for joined display
  const projectMap = new Map<number, Project>(projects.map(p => [p.id, p]));
  const clientMap  = new Map<number, Client>(clients.map(c => [c.id, c]));

  // Client-side filtering by date and billable
  const from = new Date(fromDate).getTime();
  const to   = new Date(`${toDate}T23:59:59`).getTime();

  const allExpenses = data?.data ?? [];
  const expenses = allExpenses.filter(e => {
    if (e.date < from || e.date > to) return false;
    if (filterBillable === 'true'  && !e.isBillable) return false;
    if (filterBillable === 'false' &&  e.isBillable) return false;
    return true;
  });

  // Totals grouped by currency
  const totals = expenses.reduce<Record<string, { total: number; billable: number }>>((acc, e) => {
    if (!acc[e.currency]) acc[e.currency] = { total: 0, billable: 0 };
    acc[e.currency].total += e.amount;
    if (e.isBillable) acc[e.currency].billable += e.amount;
    return acc;
  }, {});

  const openAdd  = () => { setEditExpense(undefined); setShowForm(true); };
  const openEdit = (e: Expense) => { setEditExpense(e); setShowForm(true); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Expenses</h1>
        <button type="button" className="btn-primary" onClick={openAdd}>+ Add Expense</button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">From</label>
          <input
            className="input w-36"
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">To</label>
          <input
            className="input w-36"
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
          />
        </div>
        <select
          className="input w-40"
          value={filterClient}
          onChange={e => setFilterClient(e.target.value)}
        >
          <option value="">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select
          className="input w-36"
          value={filterBillable}
          onChange={e => setFilterBillable(e.target.value as '' | 'true' | 'false')}
        >
          <option value="">All expenses</option>
          <option value="true">Billable only</option>
          <option value="false">Non-billable</option>
        </select>
      </div>

      {/* Summary chips */}
      {expenses.length > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="card px-4 py-3 text-sm">
            <span className="text-gray-500 dark:text-gray-400">Total</span>
            <span className="font-semibold ml-2">
              {expenses.length} expense{expenses.length !== 1 ? 's' : ''}
            </span>
          </div>
          {Object.entries(totals).map(([currency, { total, billable }]) => (
            <div key={currency} className="card px-4 py-3 text-sm flex items-center gap-3">
              <span className="font-semibold">{formatCurrency(total, currency)}</span>
              {billable < total && (
                <span className="text-gray-400 dark:text-gray-500 text-xs">
                  {formatCurrency(billable, currency)} billable
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {isLoading ? <LoadingSpinner /> : expenses.length === 0 ? (
        <EmptyState
          title="No expenses"
          description="Track out-of-pocket costs like software subscriptions, travel, and materials."
          action={<button type="button" className="btn-primary" onClick={openAdd}>Add Expense</button>}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Description</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Project / Client</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Amount</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Billable</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {expenses.map(e => {
                const project = e.projectId ? projectMap.get(e.projectId) : undefined;
                const client  = e.clientId  ? clientMap.get(e.clientId)   : undefined;
                return (
                  <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(e.date)}</td>
                    <td className="px-4 py-3 font-medium">{e.description}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {project ? (
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project.color }} />
                          <span>{project.name}</span>
                        </div>
                      ) : client ? (
                        <span>{client.name}</span>
                      ) : (
                        <span className="text-gray-300 dark:text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-mono font-medium">
                      {formatCurrency(e.amount, e.currency)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {e.isBillable
                        ? <span className="badge badge-green">Yes</span>
                        : <span className="badge badge-gray">No</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {e.invoiceId
                        ? <span className="badge badge-green">Invoiced</span>
                        : <span className="badge badge-gray">Pending</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          type="button"
                          className="btn-ghost btn-sm p-1.5"
                          onClick={() => openEdit(e)}
                          title="Edit"
                          disabled={!!e.invoiceId}
                        >
                          <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                          </svg>
                          <span className="sr-only">Edit</span>
                        </button>
                        <button
                          type="button"
                          className="btn-ghost btn-sm p-1.5 text-red-400"
                          onClick={() => setDeleteId(e.id)}
                          title="Delete"
                          disabled={!!e.invoiceId}
                        >
                          <svg aria-hidden="true" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                          </svg>
                          <span className="sr-only">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editExpense ? 'Edit Expense' : 'New Expense'}
        size="lg"
      >
        <ExpenseForm
          expense={editExpense}
          defaultCurrency={defaultCurrency}
          onClose={() => setShowForm(false)}
        />
      </Modal>

      <ConfirmDialog
        open={deleteId !== undefined}
        onClose={() => setDeleteId(undefined)}
        onConfirm={() => { if (deleteId !== undefined) deleteMutation.mutate(deleteId); }}
        title="Delete Expense"
        message="Are you sure you want to delete this expense? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
