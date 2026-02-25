import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, timeEntriesApi } from '../api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, ResponsiveContainer, Legend } from 'recharts';
import { formatCurrency } from '../utils/currency';
import { formatHours } from '../utils/duration';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { format, subMonths } from 'date-fns';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#3b82f6'];

export function Reports() {
  const [from, setFrom] = useState(format(subMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [to,   setTo]   = useState(format(new Date(), 'yyyy-MM-dd'));

  const fromMs = new Date(from).getTime();
  const toMs   = new Date(to + 'T23:59:59').getTime();

  const { data: summaryData, isLoading } = useQuery({
    queryKey: ['reports', 'summary', from, to],
    queryFn: () => reportsApi.summary(fromMs, toMs),
  });

  const { data: byWeekData } = useQuery({
    queryKey: ['reports', 'by-week', from, to],
    queryFn: () => reportsApi.byWeek(fromMs, toMs),
  });

  const { data: byClientData } = useQuery({
    queryKey: ['reports', 'by-client', from, to],
    queryFn: () => reportsApi.byClient(fromMs, toMs),
  });

  const { data: byProjectData } = useQuery({
    queryKey: ['reports', 'by-project', from, to],
    queryFn: () => reportsApi.byProject(fromMs, toMs),
  });

  const summary    = (summaryData?.data    as any) ?? {};
  const weeklyData = (byWeekData?.data     as any[]) ?? [];
  const clientData = (byClientData?.data   as any[]) ?? [];
  const projectData = (byProjectData?.data as any[]) ?? [];

  const billablePct = summary.totalSecs > 0
    ? Math.round((summary.billableSecs / summary.totalSecs) * 100)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Reports</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">From</label>
            <input className="input w-36" type="date" value={from} onChange={e => setFrom(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-500">To</label>
            <input className="input w-36" type="date" value={to} onChange={e => setTo(e.target.value)} />
          </div>
          <button
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
              { label: 'Total Hours',    value: formatHours(summary.totalSecs    ?? 0) },
              { label: 'Billable Hours', value: formatHours(summary.billableSecs ?? 0) },
              { label: 'Billable %',     value: `${billablePct}%` },
              { label: 'Revenue',        value: formatCurrency(summary.revenue   ?? 0) },
            ].map(s => (
              <div key={s.label} className="card p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{s.label}</p>
                <p className="mt-1 text-2xl font-bold">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Weekly bar chart */}
          {weeklyData.length > 0 && (
            <div className="card p-5">
              <h2 className="font-semibold mb-4">Hours by Week</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={weeklyData.map(w => ({
                  week: w.week,
                  Total: parseFloat((w.totalSecs / 3600).toFixed(2)),
                  Billable: parseFloat((w.billableSecs / 3600).toFixed(2)),
                }))}>
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis unit="h" tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => `${v}h`} />
                  <Legend />
                  <Bar dataKey="Total"    fill="#c7d2fe" radius={[3,3,0,0]} />
                  <Bar dataKey="Billable" fill="#6366f1" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Client + Project breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {clientData.length > 0 && (
              <div className="card p-5">
                <h2 className="font-semibold mb-4">By Client</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={clientData.map(c => ({ name: c.clientName ?? 'Unassigned', value: parseFloat((c.totalSecs / 3600).toFixed(2)) }))}
                      dataKey="value"
                      nameKey="name"
                      cx="50%" cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`}
                      labelLine={false}
                    >
                      {clientData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: any) => `${v}h`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}

            {projectData.length > 0 && (
              <div className="card p-5">
                <h2 className="font-semibold mb-4">By Project</h2>
                <div className="space-y-2">
                  {projectData.slice(0, 8).map((p: any, i) => {
                    const total = projectData.reduce((s: number, x: any) => s + x.totalSecs, 0);
                    const pct   = total > 0 ? (p.totalSecs / total) * 100 : 0;
                    return (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium truncate">{p.projectName ?? 'Unassigned'}</span>
                          <span className="text-gray-500 ml-2">{formatHours(p.totalSecs)}</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div className="h-full bg-brand-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
