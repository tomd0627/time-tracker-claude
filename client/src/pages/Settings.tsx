import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { settingsApi } from '../api';
import { useSettingsStore } from '../store/settingsStore';
import { useForm } from 'react-hook-form';
import { Settings as SettingsType } from '../types';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { CURRENCIES } from '../utils/currency';
import { useEffect } from 'react';

export function Settings() {
  const qc = useQueryClient();
  const { setDarkMode, darkMode } = useSettingsStore();
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: () => settingsApi.get() });

  const { register, handleSubmit, reset } = useForm<Partial<SettingsType>>();

  useEffect(() => {
    if (data?.data) reset(data.data);
  }, [data]);

  const mutation = useMutation({
    mutationFn: (vals: Partial<SettingsType>) => {
      if (vals.darkMode !== undefined) setDarkMode(Boolean(vals.darkMode));
      return settingsApi.update(vals);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['settings'] }); toast.success('Settings saved.'); },
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold">Settings</h1>

      <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="space-y-6">
        {/* Your info */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">Your Information</h2>
          <p className="text-sm text-gray-500">This appears on invoices as the biller/service provider.</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Name</label>
              <input className="input" placeholder="Your name or business" {...register('myName')} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" {...register('myEmail')} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Phone</label>
              <input className="input" {...register('myPhone')} />
            </div>
          </div>
          <div>
            <label className="label">Address</label>
            <textarea className="input" rows={2} {...register('myAddress')} />
          </div>
        </div>

        {/* Invoice settings */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">Invoice Settings</h2>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Invoice Prefix</label>
              <input className="input" placeholder="INV" {...register('invoicePrefix')} />
            </div>
            <div>
              <label className="label">Next Number</label>
              <input className="input" type="number" {...register('invoiceNextNumber', { valueAsNumber: true })} />
            </div>
            <div>
              <label className="label">Default Tax %</label>
              <input className="input" type="number" step="0.1" {...register('defaultTaxRate', { valueAsNumber: true })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Default Currency</label>
              <select className="input" {...register('defaultCurrency')}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Payment Terms (days)</label>
              <input className="input" type="number" {...register('defaultPaymentTerms', { valueAsNumber: true })} />
            </div>
          </div>
          <div>
            <label className="label">Invoice Footer Notes</label>
            <textarea className="input" rows={2} placeholder="Thank you for your business!" {...register('invoiceFooterNotes')} />
          </div>
        </div>

        {/* Time tracking */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">Time Tracking</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Time Rounding</label>
              <select className="input" {...register('timeRoundingMins', { valueAsNumber: true })}>
                <option value={0}>No rounding</option>
                <option value={6}>6 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
              </select>
            </div>
            <div>
              <label className="label">Rounding Direction</label>
              <select className="input" {...register('roundingDirection')}>
                <option value="nearest">Nearest</option>
                <option value="up">Always up</option>
                <option value="down">Always down</option>
              </select>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="card p-5 space-y-3">
          <h2 className="font-semibold">Appearance</h2>
          <label className="flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 rounded accent-brand-500" {...register('darkMode')} />
            <span className="text-sm font-medium">Dark mode</span>
          </label>
        </div>

        <div className="flex justify-end">
          <button type="submit" className="btn-primary" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
