import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { settingsApi } from '../api';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useSettingsStore } from '../store/settingsStore';
import type { Settings as SettingsType } from '../types';
import { CURRENCIES } from '../utils/currency';

export function Settings() {
  const qc = useQueryClient();
  const { setDarkMode } = useSettingsStore();
  const { data, isLoading } = useQuery({ queryKey: ['settings'], queryFn: () => settingsApi.get() });

  const { register, handleSubmit, reset } = useForm<Partial<SettingsType>>();

  useEffect(() => {
    if (data?.data) reset(data.data);
  }, [data, reset]);

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="s-name" className="label">Name</label>
              <input id="s-name" className="input" placeholder="Your name or business" {...register('myName')} />
            </div>
            <div>
              <label htmlFor="s-email" className="label">Email</label>
              <input id="s-email" className="input" type="email" {...register('myEmail')} />
            </div>
          </div>
          <div>
            <label htmlFor="s-phone" className="label">Phone</label>
            <input id="s-phone" className="input" {...register('myPhone')} />
          </div>
          <div>
            <label htmlFor="s-address" className="label">Address</label>
            <textarea id="s-address" className="input" rows={2} {...register('myAddress')} />
          </div>
        </div>

        {/* Invoice settings */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">Invoice Settings</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label htmlFor="s-inv-prefix" className="label">Invoice Prefix</label>
              <input id="s-inv-prefix" className="input" placeholder="INV" {...register('invoicePrefix')} />
            </div>
            <div>
              <label htmlFor="s-inv-num" className="label">Next Number</label>
              <input id="s-inv-num" className="input" type="number" {...register('invoiceNextNumber', { valueAsNumber: true })} />
            </div>
            <div>
              <label htmlFor="s-tax" className="label">Default Tax %</label>
              <input id="s-tax" className="input" type="number" step="0.1" {...register('defaultTaxRate', { valueAsNumber: true })} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="s-currency" className="label">Default Currency</label>
              <select id="s-currency" className="input" {...register('defaultCurrency')}>
                {CURRENCIES.map(c => <option key={c.code} value={c.code}>{c.code} – {c.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="s-terms" className="label">Payment Terms (days)</label>
              <input id="s-terms" className="input" type="number" {...register('defaultPaymentTerms', { valueAsNumber: true })} />
            </div>
          </div>
          <div>
            <label htmlFor="s-footer" className="label">Invoice Footer Notes</label>
            <textarea id="s-footer" className="input" rows={2} placeholder="Thank you for your business!" {...register('invoiceFooterNotes')} />
          </div>
        </div>

        {/* Time tracking */}
        <div className="card p-5 space-y-4">
          <h2 className="font-semibold">Time Tracking</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="s-rounding" className="label">Time Rounding</label>
              <select id="s-rounding" className="input" {...register('timeRoundingMins', { valueAsNumber: true })}>
                <option value={0}>No rounding</option>
                <option value={6}>6 minutes</option>
                <option value={15}>15 minutes</option>
                <option value={30}>30 minutes</option>
              </select>
            </div>
            <div>
              <label htmlFor="s-rounding-dir" className="label">Rounding Direction</label>
              <select id="s-rounding-dir" className="input" {...register('roundingDirection')}>
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
