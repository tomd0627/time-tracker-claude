import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, ResponsiveContainer, Legend,
} from 'recharts';
import { format, subMonths } from 'date-fns';
import { reportsApi, timeEntriesApi } from '../api';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { formatCurrency } from '../utils/currency';
import { formatHours } from '../utils/duration';

const PIE_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6'];

// ─── Date range presets ────────────────────────────────────────────────────────

type Preset = '1m' | '3m' | '6m' | '12m';

function presetRange(p: Preset): { from: string; to: string } {
  const to   = format(new Date(), 'yyyy-MM-dd');
  const months = p === '1m' ? 1 : p === '3m' ? 3 : p === '6m' ? 6 : 12;
  const from = format(subMonths(new Date(), months), 'yyyy-MM-dd');
  return { from, to };
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Reports() {
  const [preset, setPreset]   = useState<Preset | null>('6m');
  const [from,   setFrom]     = useState(format(subMonths(new Date(), 6), 'yyyy-MM-dd'));
  const [to,     setTo]       = useState(format(new Date(), 'yyyy-MM-dd'));

  const fromMs = new Date(from).getTime();
  const toMs   = new Date(`${to}T23:59:59`).getTime();

  const applyPreset = (p: Preset) => {
    const range = presetRange(p);
    setPreset(p);
    setFrom(range.from);
    setTo(range.to);
  };

  const handleManualDate = (field: 'from' | 'to', val: string) => {
    setPreset(null);
    if (field === 'from') setFrom(val);
    else setTo(val);
  };

  const { data: summaryData,  isLoading } = useQuery({
    queryKey: ['reports', 'summary',    from, to],
    queryFn:  () => reportsApi.summary(fromMs, toMs),
  });
  const { data: byWeekData } = useQuery({
    queryKey: ['reports', 'by-week',   from, to],
    queryFn:  () => reportsApi.byWeek(fromMs, toMs),
  });
  const { data: byMonthData } = useQuery({
    queryKey: ['reports', 'by-month',  from, to],
    queryFn:  () => reportsApi.byMonth(fromMs, toMs),
  });
  const { data: byClientData } = useQuery({
    queryKey: ['reports', 'by-client', from, to],
    queryFn:  () => reportsApi.byClient(fromMs, toMs),
  });
  const { data: byProjectData } = useQuery({
    queryKey: ['reports', 'by-project', from, to],
    queryFn:  () => reportsApi.byProject(fromMs, toMs),
  });
  const { data: expensesData } = useQuery({
    queryKey: ['reports', 'expenses', from, to],
    queryFn:  () => reportsApi.expenses(fromMs, toMs),
  });

  const summary        = summaryData?.data;
  const weeklyData     = byWeekData?.data      ?? [];
  const monthlyData    = byMonthData?.data     ?? [];
  const clientData     = byClientData?.data    ?? [];
  const projectData    = byProjectData?.data   ?? [];
  const expenseByCurr  = expensesData?.data?.byCurrency ?? [];

  const billablePct = (summary?.totalSecs ?? 0) > 0
    ? Math.round(((summary?.billableSecs ?? 0) / (summary?.totalSecs ?? 1)) * 100)
    : 0;

  const projectTotal = projectData.reduce((s, p) => s + p.totalSecs, 0);

  return (
    <div className="space-y-6">
      {/* Header + controls */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset buttons */}
          {(['1m', '3m', '6m', '12m'] as Preset[]).map(p => (
            <button
              key={p}
              type="button"
              className={preset === p ? 'btn-primary btn-sm' : 'btn-secondary btn-sm'}
              onClick={() => applyPreset(p)}
            >
              {p === '1m' ? '1 mo' : p === '3m' ? '3 mo' : p === '6m' ? '6 mo' : '12 mo'}
            </button>
          ))}
          <div className="flex items-center gap-2 ml-1">
            <label className="text-sm text-gray-500">From</label>
            <input
              className="input w-36"
              type="date"
              value={from}
              onChange={e => handleManualDate('from', e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">To</label>
            <input
              className="input w-36"
              type="date"
              value={to}
              onChange={e => handleManualDate('to', e.target.value)}
            />
          </div>
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => timeEntriesApi.exportCsv({ from: fromMs, to: toMs })}
          >
            Export CSV
          </button>
        </div>
      </div>

      {isLoading ? <LoadingSpinner /> : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Hours',    value: formatHours(summary?.totalSecs    ?? 0) },
              { label: 'Billable Hours', value: formatHours(summary?.billableSecs ?? 0) },
              { label: 'Billable %',     value: `${billablePct}%` },
              { label: 'Revenue',        value: formatCurrency(summary?.revenue   ?? 0) },
            ].map(s => (
              <div key={s.label} className="card p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
                <p className="mt-1 text-2xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Empty state when no data */}
          {(summary?.entryCount ?? 0) === 0 && (
            <div className="card p-10 text-center">
              <p className="font-medium text-gray-500 dark:text-gray-400">No time entries in this period.</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Try a wider date range or log some time first.</p>
            </div>
          )}

          {/* Monthly bar chart */}
          {monthlyData.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold mb-4">Hours &amp; Revenue by Month</h2>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={monthlyData.map(m => ({
                    month:    format(new Date(`${m.month}-15`), 'MMM yyyy'),
                    Total:    parseFloat((m.totalSecs    / 3600).toFixed(2)),
                    Billable: parseFloat((m.billableSecs / 3600).toFixed(2)),
                    revenue:  m.revenue,
                  }))}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis unit="h" tick={{ fontSize: 11 }} width={40} />
                  <Tooltip
                    formatter={(value, name, props) => {
                      if (name === 'Total' || name === 'Billable') {
                        return [`${value}h`, name];
                      }
                      return [formatCurrency(props.payload.revenue), 'Revenue'];
                    }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Legend />
                  <Bar dataKey="Total"    fill="#c7d2fe" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Billable" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Weekly bar chart */}
          {weeklyData.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold mb-4">Hours by Week</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={weeklyData.map(w => ({
                    week:     w.week,
                    Total:    parseFloat((w.totalSecs    / 3600).toFixed(2)),
                    Billable: parseFloat((w.billableSecs / 3600).toFixed(2)),
                  }))}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.08} />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis unit="h" tick={{ fontSize: 11 }} width={40} />
                  <Tooltip formatter={(value) => [`${value}h`]} labelStyle={{ fontWeight: 600 }} />
                  <Legend />
                  <Bar dataKey="Total"    fill="#c7d2fe" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Billable" fill="#6366f1" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Client pie + Project breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {clientData.length > 0 && (
              <div className="card p-5">
                <h2 className="font-semibold mb-4">By Client</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={clientData.map(c => ({
                        name:  c.clientName ?? 'Unassigned',
                        value: parseFloat((c.totalSecs / 3600).toFixed(2)),
                      }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%" cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${Math.round((percent as number) * 100)}%`}
                      labelLine={false}
                    >
                      {clientData.map((c, i) => (
                        <Cell key={c.clientId ?? c.clientName ?? i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}h`]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {projectData.length > 0 && (
              <div className="card p-5">
                <h2 className="font-semibold mb-4">By Project</h2>
                <div className="space-y-3">
                  {projectData.slice(0, 8).map(p => {
                    const pct = projectTotal > 0 ? (p.totalSecs / projectTotal) * 100 : 0;
                    return (
                      <div key={p.projectId ?? p.projectName ?? 'unassigned'}>
                        <div className="flex justify-between text-sm mb-1">
                          <div className="flex items-center gap-1.5 truncate">
                            {p.projectColor && (
                              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: p.projectColor }} />
                            )}
                            <span className="font-medium truncate">{p.projectName ?? 'Unassigned'}</span>
                          </div>
                          <span className="text-gray-500 ml-2 flex-shrink-0">{formatHours(p.totalSecs)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${pct}%`,
                              backgroundColor: p.projectColor ?? '#6366f1',
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Expense summary */}
          {expenseByCurr.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold mb-4">Expenses</h2>
              <div className="flex flex-wrap gap-4">
                {expenseByCurr.map(e => (
                  <div key={e.currency} className="flex-1 min-w-[160px] bg-gray-50 dark:bg-gray-800/60 rounded-lg p-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">{e.currency}</p>
                    <p className="text-xl font-bold">{e.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {e.billable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} billable
                      &nbsp;·&nbsp;{e.count} item{e.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
