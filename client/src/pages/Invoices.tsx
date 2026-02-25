import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoicesApi, clientsApi, timeEntriesApi, settingsApi } from '../api';
import { Invoice, TimeEntry } from '../types';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/dates';
import { formatDuration } from '../utils/duration';
import { format } from 'date-fns';

const STATUS_BADGE: Record<string, string> = {
  draft: 'badge-gray', sent: 'badge-blue', paid: 'badge-green', overdue: 'badge-red',
};

// ─── Invoice form ────────────────────────────────────────────────────────────

function InvoiceForm({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const [clientId, setClientId] = useState<number | undefined>();
  const [currency, setCurrency] = useState('USD');
  const [issueDate, setIssueDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [dueDate, setDueDate] = useState(format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd'));
  const [taxRate, setTaxRate] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<number>>(new Set());
  const [customLines, setCustomLines] = useState<Array<{ description: string; quantity: number; unitPrice: number }>>([]);

  const { data: clientsData } = useQuery({ queryKey: ['clients'], queryFn: () => clientsApi.list() });
  const { data: settingsData } = useQuery({ queryKey: ['settings'], queryFn: () => settingsApi.get() });
  const { data: unbilledData } = useQuery({
    queryKey: ['unbilled-entries', clientId],
    queryFn:  () => timeEntriesApi.unbilledEntries(clientId),
    enabled: !!clientId,
  });

  const clients      = clientsData?.data  ?? [];
  const unbilled     = unbilledData?.data ?? [];
  const defaultTax   = settingsData?.data?.defaultTaxRate ?? 0;

  const toggleEntry = (id: number) => {
    setSelectedEntryIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedEntries = unbilled.filter(e => selectedEntryIds.has(e.id));

  const entryLines = selectedEntries.map(e => ({
    timeEntryId: e.id,
    description: e.description ?? `Work on ${formatDate(e.startedAt)}`,
    quantity:    Math.round((e.durationSecs ?? 0) / 3600 * 100) / 100,
    unitPrice:   (e as any).hourlyRate ?? (e as any).projectRate ?? (e as any).clientRate ?? 0,
  }));

  const allLines = [...entryLines, ...customLines.filter(l => l.description && l.quantity && l.unitPrice)];
  const subtotal = allLines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const discounted = Math.max(0, subtotal - discountAmount);
  const tax = discounted * (taxRate / 100);
  const total = discounted + tax;

  const mutation = useMutation({
    mutationFn: () => invoicesApi.create({
      clientId,
      currency,
      issueDate: new Date(issueDate).getTime(),
      dueDate:   dueDate ? new Date(dueDate).getTime() : null,
      taxRate,
      discountAmount,
      notes: notes || null,
      lineItems: allLines,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['invoices'] }); onClose(); },
  });

  return (
    <div className="space-y-5">
      {/* Client & dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Client *</label>
          <select className="input" value={clientId ?? ''} onChange={e => setClientId(e.target.value ? parseInt(e.target.value) : undefined)}>
            <option value="">Select client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Currency</label>
          <input className="input" value={currency} onChange={e => setCurrency(e.target.value.toUpperCase().slice(0, 3))} placeholder="USD" maxLength={3} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Issue Date</label>
          <input className="input" type="date" value={issueDate} onChange={e => setIssueDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Due Date</label>
          <input className="input" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
        </div>
      </div>

      {/* Unbilled time entries */}
      {clientId && unbilled.length > 0 && (
        <div>
          <label className="label">Add Unbilled Time Entries</label>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
            {unbilled.map(e => {
              const hours = ((e.durationSecs ?? 0) / 3600).toFixed(2);
              const rate  = (e as any).hourlyRate ?? (e as any).projectRate ?? (e as any).clientRate ?? 0;
              return (
                <label key={e.id} className="flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <input type="checkbox" className="accent-brand-500" checked={selectedEntryIds.has(e.id)} onChange={() => toggleEntry(e.id)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{e.description || '(no description)'}</p>
                    <p className="text-xs text-gray-400">{formatDate(e.startedAt)} · {hours}h @ ${rate}/hr</p>
                  </div>
                  <span className="text-sm font-mono">{formatCurrency(parseFloat(hours) * rate, currency)}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom lines */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Custom Line Items</label>
          <button type="button" className="btn-ghost btn-sm text-brand-600" onClick={() => setCustomLines(l => [...l, { description: '', quantity: 1, unitPrice: 0 }])}>
            + Add line
          </button>
        </div>
        {customLines.map((line, i) => (
          <div key={i} className="grid grid-cols-5 gap-2 mb-2">
            <input className="input col-span-2" placeholder="Description" value={line.description} onChange={e => setCustomLines(l => l.map((x, j) => j === i ? { ...x, description: e.target.value } : x))} />
            <input className="input" type="number" placeholder="Qty" value={line.quantity} onChange={e => setCustomLines(l => l.map((x, j) => j === i ? { ...x, quantity: parseFloat(e.target.value) || 0 } : x))} />
            <input className="input" type="number" placeholder="Rate" value={line.unitPrice} onChange={e => setCustomLines(l => l.map((x, j) => j === i ? { ...x, unitPrice: parseFloat(e.target.value) || 0 } : x))} />
            <button type="button" className="btn-ghost btn-sm text-red-400" onClick={() => setCustomLines(l => l.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
      </div>

      {/* Totals */}
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(subtotal, currency)}</span></div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 w-24">Discount</span>
          <input className="input w-24 text-right" type="number" value={discountAmount} onChange={e => setDiscountAmount(parseFloat(e.target.value) || 0)} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500 w-24">Tax %</span>
          <input className="input w-24 text-right" type="number" value={taxRate} onChange={e => setTaxRate(parseFloat(e.target.value) || 0)} />
        </div>
        <div className="flex justify-between font-bold pt-1 border-t border-gray-200 dark:border-gray-700">
          <span>Total</span><span>{formatCurrency(total, currency)}</span>
        </div>
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} placeholder="Thank you for your business!" value={notes} onChange={e => setNotes(e.target.value)} />
      </div>

      <div className="flex gap-3 justify-end pt-1">
        <button className="btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn-primary" disabled={mutation.isPending || !clientId || allLines.length === 0} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'Creating...' : 'Create Invoice'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Invoices page ───────────────────────────────────────────────────────

export function Invoices() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [deleteId, setDeleteId] = useState<number | undefined>();

  const { data, isLoading } = useQuery({ queryKey: ['invoices'], queryFn: () => invoicesApi.list() });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => invoicesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const sendMutation = useMutation({
    mutationFn: (id: number) => invoicesApi.send(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const paidMutation = useMutation({
    mutationFn: (id: number) => invoicesApi.markPaid(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invoices'] }),
  });

  const invoices = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Invoices</h1>
        <button className="btn-primary" onClick={() => setShowForm(true)}>+ New Invoice</button>
      </div>

      {isLoading ? <LoadingSpinner /> : invoices.length === 0 ? (
        <EmptyState
          title="No invoices yet"
          description="Create your first invoice from your billable time entries."
          action={<button className="btn-primary" onClick={() => setShowForm(true)}>Create Invoice</button>}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Invoice #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Client</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Issue Date</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Due Date</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Total</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {invoices.map((inv: any) => (
                <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">{inv.clientName ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{formatDate(inv.issueDate)}</td>
                  <td className="px-4 py-3 text-gray-500">{inv.dueDate ? formatDate(inv.dueDate) : '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold">{formatCurrency(inv.total, inv.currency)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={STATUS_BADGE[inv.status] ?? 'badge-gray'}>{inv.status}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {inv.status === 'draft' && (
                        <button className="btn-secondary btn-sm" onClick={() => sendMutation.mutate(inv.id)}>Mark Sent</button>
                      )}
                      {(inv.status === 'sent' || inv.status === 'overdue') && (
                        <button className="btn-primary btn-sm" onClick={() => paidMutation.mutate(inv.id)}>Mark Paid</button>
                      )}
                      <a
                        href={invoicesApi.pdfUrl(inv.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-ghost btn-sm p-1.5"
                        title="Download PDF"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                      </a>
                      {inv.status === 'draft' && (
                        <button className="btn-ghost btn-sm p-1.5 text-red-400" onClick={() => setDeleteId(inv.id)} title="Delete">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title="New Invoice" size="xl">
        <InvoiceForm onClose={() => setShowForm(false)} />
      </Modal>

      <ConfirmDialog
        open={deleteId !== undefined}
        onClose={() => setDeleteId(undefined)}
        onConfirm={() => deleteId !== undefined && deleteMutation.mutate(deleteId)}
        title="Delete Invoice"
        message="Delete this draft invoice? This cannot be undone. Time entries will be unlocked."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
