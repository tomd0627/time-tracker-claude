import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { clientsApi } from '../api';
import { Client } from '../types';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { CURRENCIES } from '../utils/currency';

interface ClientFormValues {
  name: string; email: string; phone: string;
  address: string; city: string; country: string;
  currency: string; defaultRate: string; notes: string;
}

function ClientForm({ client, onClose }: { client?: Client; onClose: () => void }) {
  const qc = useQueryClient();
  const { register, handleSubmit } = useForm<ClientFormValues>({
    defaultValues: {
      name:        client?.name        ?? '',
      email:       client?.email       ?? '',
      phone:       client?.phone       ?? '',
      address:     client?.address     ?? '',
      city:        client?.city        ?? '',
      country:     client?.country     ?? '',
      currency:    client?.currency    ?? 'USD',
      defaultRate: String(client?.defaultRate ?? ''),
      notes:       client?.notes       ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (vals: ClientFormValues) => {
      const payload = {
        ...vals,
        defaultRate: vals.defaultRate ? parseFloat(vals.defaultRate) : null,
        email:   vals.email   || null,
        phone:   vals.phone   || null,
        address: vals.address || null,
        city:    vals.city    || null,
        country: vals.country || null,
        notes:   vals.notes   || null,
      };
      return client ? clientsApi.update(client.id, payload) : clientsApi.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success(client ? 'Client updated.' : 'Client added.'); onClose(); },
  });

  return (
    <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="space-y-4">
      <div>
        <label className="label">Name *</label>
        <input className="input" placeholder="Acme Corp" {...register('name', { required: true })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" {...register('email')} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" {...register('phone')} />
        </div>
      </div>
      <div>
        <label className="label">Address</label>
        <textarea className="input" rows={2} {...register('address')} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">City</label>
          <input className="input" {...register('city')} />
        </div>
        <div>
          <label className="label">Country</label>
          <input className="input" {...register('country')} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Currency</label>
          <select className="input" {...register('currency')}>
            {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Default Hourly Rate</label>
          <input className="input" type="number" step="0.01" placeholder="0.00" {...register('defaultRate')} />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} {...register('notes')} />
      </div>
      <div className="flex gap-3 justify-end pt-1">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : client ? 'Update' : 'Add Client'}
        </button>
      </div>
    </form>
  );
}

export function Clients() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editClient, setEditClient] = useState<Client | undefined>();
  const [deleteId, setDeleteId] = useState<number | undefined>();

  const { data, isLoading } = useQuery({ queryKey: ['clients'], queryFn: () => clientsApi.list() });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => clientsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['clients'] }); toast.success('Client archived.'); },
  });

  const clients = data?.data ?? [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <button className="btn-primary" onClick={() => { setEditClient(undefined); setShowForm(true); }}>
          + New Client
        </button>
      </div>

      {isLoading ? <LoadingSpinner /> : clients.length === 0 ? (
        <EmptyState
          title="No clients yet"
          description="Add your first client to start tracking time for them."
          action={<button className="btn-primary" onClick={() => setShowForm(true)}>Add Client</button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map(c => (
            <div key={c.id} className="card p-5 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white">{c.name}</h3>
                  {c.email && <p className="text-sm text-gray-500">{c.email}</p>}
                  {c.city  && <p className="text-sm text-gray-500">{c.city}{c.country ? `, ${c.country}` : ''}</p>}
                </div>
                <span className="badge badge-gray">{c.currency}</span>
              </div>
              {c.defaultRate && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Rate: <span className="font-medium">${c.defaultRate}/hr</span>
                </p>
              )}
              <div className="flex gap-2 pt-1">
                <button className="btn-secondary btn-sm flex-1" onClick={() => { setEditClient(c); setShowForm(true); }}>Edit</button>
                <button className="btn-ghost btn-sm text-red-400" onClick={() => setDeleteId(c.id)}>Archive</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editClient ? 'Edit Client' : 'New Client'} size="lg">
        <ClientForm client={editClient} onClose={() => setShowForm(false)} />
      </Modal>

      <ConfirmDialog
        open={deleteId !== undefined}
        onClose={() => setDeleteId(undefined)}
        onConfirm={() => deleteId !== undefined && deleteMutation.mutate(deleteId)}
        title="Archive Client"
        message="Archive this client? They will be hidden from lists but their data is preserved."
        confirmLabel="Archive"
        variant="danger"
      />
    </div>
  );
}
