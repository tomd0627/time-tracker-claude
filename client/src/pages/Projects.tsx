import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, clientsApi } from '../api';
import { Project } from '../types';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

const PROJECT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f97316',
  '#eab308', '#22c55e', '#14b8a6', '#3b82f6', '#0ea5e9',
];

const statusLabels: Record<string, string> = {
  active: 'Active', paused: 'Paused', completed: 'Completed', archived: 'Archived',
};
const statusBadge: Record<string, string> = {
  active: 'badge-green', paused: 'badge-yellow', completed: 'badge-blue', archived: 'badge-gray',
};

interface ProjectFormValues {
  name: string; clientId: string; color: string;
  status: string; hourlyRate: string; budgetHours: string; notes: string;
}

function ProjectForm({ project, onClose }: { project?: Project; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: clientsData } = useQuery({ queryKey: ['clients'], queryFn: () => clientsApi.list() });
  const [color, setColor] = useState(project?.color ?? '#6366f1');

  const { register, handleSubmit } = useForm<ProjectFormValues>({
    defaultValues: {
      name:        project?.name        ?? '',
      clientId:    String(project?.clientId ?? ''),
      color:       project?.color       ?? '#6366f1',
      status:      project?.status      ?? 'active',
      hourlyRate:  String(project?.hourlyRate ?? ''),
      budgetHours: String(project?.budgetHours ?? ''),
      notes:       project?.notes       ?? '',
    },
  });

  const mutation = useMutation({
    mutationFn: (vals: ProjectFormValues) => {
      const payload = {
        ...vals,
        color,
        status:      vals.status as Project['status'],
        clientId:    vals.clientId    ? parseInt(vals.clientId)    : null,
        hourlyRate:  vals.hourlyRate  ? parseFloat(vals.hourlyRate)  : null,
        budgetHours: vals.budgetHours ? parseFloat(vals.budgetHours) : null,
        notes:       vals.notes || null,
      };
      return project ? projectsApi.update(project.id, payload) : projectsApi.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success(project ? 'Project updated.' : 'Project created.'); onClose(); },
  });

  const clients = clientsData?.data ?? [];

  return (
    <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="space-y-4">
      <div>
        <label className="label">Name *</label>
        <input className="input" placeholder="My Project" {...register('name', { required: true })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Client</label>
          <select className="input" {...register('clientId')}>
            <option value="">No client</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" {...register('status')}>
            {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="label">Color</label>
        <div className="flex gap-2 flex-wrap">
          {PROJECT_COLORS.map(c => (
            <button
              key={c}
              type="button"
              className="w-7 h-7 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-brand-400"
              style={{
                backgroundColor: c,
                boxShadow: color === c ? `0 0 0 3px white, 0 0 0 5px ${c}` : undefined,
              }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Hourly Rate</label>
          <input className="input" type="number" step="0.01" placeholder="0.00" {...register('hourlyRate')} />
        </div>
        <div>
          <label className="label">Budget (hours)</label>
          <input className="input" type="number" step="0.5" placeholder="e.g. 100" {...register('budgetHours')} />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} {...register('notes')} />
      </div>
      <div className="flex gap-3 justify-end pt-1">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : project ? 'Update' : 'Create Project'}
        </button>
      </div>
    </form>
  );
}

export function Projects() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editProject, setEditProject] = useState<Project | undefined>();
  const [deleteId, setDeleteId] = useState<number | undefined>();

  const { data, isLoading } = useQuery({ queryKey: ['projects', {}], queryFn: () => projectsApi.list() });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => projectsApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['projects'] }); toast.success('Project archived.'); },
  });

  const projects = (data?.data ?? []).filter(p => p.status !== 'archived');

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button className="btn-primary" onClick={() => { setEditProject(undefined); setShowForm(true); }}>
          + New Project
        </button>
      </div>

      {isLoading ? <LoadingSpinner /> : projects.length === 0 ? (
        <EmptyState
          title="No projects yet"
          description="Create a project to organize your time entries."
          action={<button className="btn-primary" onClick={() => setShowForm(true)}>Create Project</button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => (
            <div key={p.id} className="card p-5 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: p.color }} />
                  <h3 className="font-semibold truncate">{p.name}</h3>
                </div>
                <span className={statusBadge[p.status] ?? 'badge-gray'}>{statusLabels[p.status]}</span>
              </div>

              {p.budgetHours && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>{(p.hoursSpent ?? 0).toFixed(1)}h spent</span>
                    <span>{p.budgetHours}h budget</span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, ((p.hoursSpent ?? 0) / p.budgetHours) * 100)}%`,
                        backgroundColor: p.color,
                      }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button className="btn-secondary btn-sm flex-1" onClick={() => { setEditProject(p); setShowForm(true); }}>Edit</button>
                <button className="btn-ghost btn-sm text-red-400" onClick={() => setDeleteId(p.id)}>Archive</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editProject ? 'Edit Project' : 'New Project'} size="lg">
        <ProjectForm project={editProject} onClose={() => setShowForm(false)} />
      </Modal>

      <ConfirmDialog
        open={deleteId !== undefined}
        onClose={() => setDeleteId(undefined)}
        onConfirm={() => deleteId !== undefined && deleteMutation.mutate(deleteId)}
        title="Archive Project"
        message="Archive this project? It will be hidden but its time entries are preserved."
        confirmLabel="Archive"
        variant="danger"
      />
    </div>
  );
}
