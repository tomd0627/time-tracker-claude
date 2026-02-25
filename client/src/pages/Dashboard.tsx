import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { reportsApi, timeEntriesApi, projectsApi } from '../api';
import { formatDuration, formatHours } from '../utils/duration';
import { formatCurrency } from '../utils/currency';
import { formatDate } from '../utils/dates';
import { todayRange, thisWeekRange } from '../utils/dates';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
    </div>
  );
}

export function Dashboard() {
  const today    = todayRange();
  const thisWeek = thisWeekRange();

  const { data: todayData, isLoading: todayLoading } = useQuery({
    queryKey: ['reports', 'summary', 'today'],
    queryFn: () => reportsApi.summary(today.from, today.to),
  });

  const { data: weekData, isLoading: weekLoading } = useQuery({
    queryKey: ['reports', 'summary', 'week'],
    queryFn: () => reportsApi.summary(thisWeek.from, thisWeek.to),
  });

  const { data: recentData } = useQuery({
    queryKey: ['time-entries', { limit: 8 }],
    queryFn: () => timeEntriesApi.list({ limit: 8 }),
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects', {}],
    queryFn: () => projectsApi.list({ status: 'active' }),
  });

  const todaySummary = todayData?.data;
  const weekSummary  = weekData?.data;
  const recent = recentData?.data ?? [];
  const projects = (projectsData?.data ?? []).slice(0, 5);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      {todayLoading || weekLoading ? <LoadingSpinner /> : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Today" value={formatDuration(todaySummary?.totalSecs ?? 0)} sub="total" />
          <StatCard label="Billable today" value={formatDuration(todaySummary?.billableSecs ?? 0)} />
          <StatCard label="This week" value={formatHours(weekSummary?.totalSecs ?? 0)} sub={`${weekSummary?.entryCount ?? 0} entries`} />
          <StatCard label="Revenue (week)" value={formatCurrency(weekSummary?.revenue ?? 0)} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent entries */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4">Recent Entries</h2>
          {recent.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-gray-400 mb-3">No entries yet. Start the timer above!</p>
              <Link to="/time" className="btn-secondary btn-sm">Add Entry</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map((e) => (
                <div key={e.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{e.description || '(no description)'}</p>
                    <p className="text-xs text-gray-400">{e.projectName ?? 'No project'} · {formatDate(e.startedAt)}</p>
                  </div>
                  <span className="text-sm font-mono font-medium text-gray-600 dark:text-gray-300 flex-shrink-0 ml-4">
                    {e.durationSecs ? formatDuration(e.durationSecs) : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Active projects */}
        <div className="card p-5">
          <h2 className="font-semibold mb-4">Active Projects</h2>
          {projects.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-gray-400 mb-3">No projects yet.</p>
              <Link to="/projects" className="btn-secondary btn-sm">Create Project</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {projects.map((p) => (
                <div key={p.id} className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    {p.budgetHours && (
                      <div className="mt-1">
                        <div className="flex justify-between text-xs text-gray-400 mb-0.5">
                          <span>{(p.hoursSpent ?? 0).toFixed(1)}h spent</span>
                          <span>{p.budgetHours}h budget</span>
                        </div>
                        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, ((p.hoursSpent ?? 0) / p.budgetHours) * 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">{(p.hoursSpent ?? 0).toFixed(1)}h</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
