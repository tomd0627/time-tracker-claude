import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeEntriesApi, projectsApi, clientsApi, tagsApi } from '../api';
import { TimeEntry } from '../types';
import { formatDuration, formatDurationInput, parseDurationInput } from '../utils/duration';
import { formatDate, formatTime } from '../utils/dates';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';

interface EntryFormValues {
  description: string;
  projectId: string;
  clientId: string;
  date: string;
  startTime: string;
  endTime: string;
  isBillable: boolean;
  hourlyRate: string;
}

function EntryForm({ entry, onClose }: { entry?: TimeEntry; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: projectsData } = useQuery({ queryKey: ['projects', {}], queryFn: () => projectsApi.list() });
  const { data: clientsData }  = useQuery({ queryKey: ['clients'],     queryFn: () => clientsApi.list() });

  const startDate = entry ? new Date(entry.startedAt) : new Date();
  const endDate   = entry?.endedAt ? new Date(entry.endedAt) : new Date();

  const { register, handleSubmit, formState: { errors } } = useForm<EntryFormValues>({
    defaultValues: {
      description: entry?.description ?? '',
      projectId:   String(entry?.projectId ?? ''),
      clientId:    String(entry?.clientId ?? ''),
      date:        format(startDate, 'yyyy-MM-dd'),
      startTime:   format(startDate, 'HH:mm'),
      endTime:     entry?.endedAt ? format(endDate, 'HH:mm') : '',
      isBillable:  entry?.isBillable ?? true,
      hourlyRate:  String(entry?.hourlyRate ?? ''),
    },
  });

  const mutation = useMutation({
    mutationFn: (vals: EntryFormValues) => {
      const dateBase = new Date(vals.date);
      const [sh, sm] = vals.startTime.split(':').map(Number);
      const startedAt = new Date(dateBase).setHours(sh, sm, 0, 0);
      let endedAt: number | undefined;
      if (vals.endTime) {
        const [eh, em] = vals.endTime.split(':').map(Number);
        endedAt = new Date(dateBase).setHours(eh, em, 0, 0);
      }
      const payload = {
        description: vals.description || null,
        projectId:   vals.projectId   ? parseInt(vals.projectId) : null,
        clientId:    vals.clientId    ? parseInt(vals.clientId)  : null,
        startedAt,
        endedAt,
        isBillable:  vals.isBillable,
        hourlyRate:  vals.hourlyRate  ? parseFloat(vals.hourlyRate) : null,
      };
      return entry
        ? timeEntriesApi.update(entry.id, payload)
        : timeEntriesApi.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries'] });
      onClose();
    },
  });

  const projects = projectsData?.data ?? [];
  const clients  = clientsData?.data  ?? [];

  return (
    <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="space-y-4">
      <div>
        <label className="label">Description</label>
        <input className="input" placeholder="What did you work on?" {...register('description')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Project</label>
          <select className="input" {...register('projectId')}>
            <option value="">No project</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Client</label>
          <select className="input" {...register('clientId')}>
            <option value="">No client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" {...register('date', { required: true })} />
        </div>
        <div>
          <label className="label">Start</label>
          <input className="input" type="time" {...register('startTime', { required: true })} />
        </div>
        <div>
          <label className="label">End</label>
          <input className="input" type="time" {...register('endTime')} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Hourly Rate</label>
          <input className="input" type="number" step="0.01" placeholder="0.00" {...register('hourlyRate')} />
        </div>
        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" className="w-4 h-4 rounded accent-brand-500" {...register('isBillable')} />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Billable</span>
          </label>
        </div>
      </div>
      <div className="flex gap-3 justify-end pt-1">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : entry ? 'Update' : 'Add Entry'}
        </button>
      </div>
    </form>
  );
}

export function TimeEntries() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState<TimeEntry | undefined>();
  const [deleteId, setDeleteId] = useState<number | undefined>();
  const [fromDate, setFromDate] = useState(format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd'));
  const [toDate,   setToDate]   = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data, isLoading } = useQuery({
    queryKey: ['time-entries', { from: fromDate, to: toDate }],
    queryFn: () => timeEntriesApi.list({
      from: new Date(fromDate).getTime(),
      to:   new Date(toDate  + 'T23:59:59').getTime(),
    }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => timeEntriesApi.delete(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['time-entries'] }),
  });

  const resumeMutation = useMutation({
    mutationFn: (id: number) => timeEntriesApi.resume(id),
    onSuccess:  () => qc.invalidateQueries({ queryKey: ['time-entries'] }),
  });

  const entries = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Time Entries</h1>
        <button className="btn-primary" onClick={() => { setEditEntry(undefined); setShowForm(true); }}>
          + New Entry
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">From</label>
          <input className="input w-36" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-600 dark:text-gray-400">To</label>
          <input className="input w-36" type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
        </div>
        <button
          className="btn-secondary btn-sm ml-auto"
          onClick={() => timeEntriesApi.exportCsv({ from: new Date(fromDate).getTime(), to: new Date(toDate + 'T23:59:59').getTime() })}
        >
          Export CSV
        </button>
      </div>

      {isLoading ? <LoadingSpinner /> : entries.length === 0 ? (
        <EmptyState
          title="No entries in this range"
          description="Use the timer above or add a manual entry."
          action={<button className="btn-primary" onClick={() => setShowForm(true)}>Add Entry</button>}
        />
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800/50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Description</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Project</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Date</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Duration</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 dark:text-gray-400">Billable</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {entries.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="font-medium">{e.description || <span className="text-gray-400">—</span>}</div>
                    {e.isRunning && <span className="badge badge-brand mt-0.5">Running</span>}
                    {e.invoiceId && <span className="badge badge-green mt-0.5">Invoiced</span>}
                  </td>
                  <td className="px-4 py-3">
                    {e.projectName ? (
                      <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.projectColor ?? '#6366f1' }} />
                        <span>{e.projectName}</span>
                      </div>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatDate(e.startedAt)}
                    <br />
                    <span className="text-xs">{formatTime(e.startedAt)}{e.endedAt ? ` – ${formatTime(e.endedAt)}` : ''}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-medium">
                    {e.isRunning ? (
                      <span className="text-brand-500">Running</span>
                    ) : e.durationSecs ? formatDuration(e.durationSecs) : '—'}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {e.isBillable ? (
                      <span className="badge badge-green">Yes</span>
                    ) : (
                      <span className="badge badge-gray">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {!e.isRunning && !e.endedAt && (
                        <button className="btn-ghost btn-sm p-1.5" onClick={() => resumeMutation.mutate(e.id)} title="Resume">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                        </button>
                      )}
                      <button className="btn-ghost btn-sm p-1.5" onClick={() => { setEditEntry(e); setShowForm(true); }} title="Edit" disabled={!!e.invoiceId}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                      </button>
                      <button className="btn-ghost btn-sm p-1.5 text-red-400" onClick={() => setDeleteId(e.id)} title="Delete" disabled={!!e.invoiceId}>
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editEntry ? 'Edit Entry' : 'New Time Entry'} size="lg">
        <EntryForm entry={editEntry} onClose={() => setShowForm(false)} />
      </Modal>

      <ConfirmDialog
        open={deleteId !== undefined}
        onClose={() => setDeleteId(undefined)}
        onConfirm={() => deleteId !== undefined && deleteMutation.mutate(deleteId)}
        title="Delete Entry"
        message="Are you sure you want to delete this time entry? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
