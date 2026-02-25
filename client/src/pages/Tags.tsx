import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { tagsApi } from '../api';
import type { Tag } from '../types';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Modal } from '../components/ui/Modal';

// ─── Color palette ────────────────────────────────────────────────────────────

const PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e',
  '#14b8a6', '#3b82f6', '#8b5cf6', '#ec4899', '#94a3b8',
];

// ─── Form ─────────────────────────────────────────────────────────────────────

interface TagFormValues {
  name:  string;
  color: string;
}

function TagForm({ tag, onClose }: { tag?: Tag; onClose: () => void }) {
  const qc = useQueryClient();

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<TagFormValues>({
    defaultValues: {
      name:  tag?.name  ?? '',
      color: tag?.color ?? '#94a3b8',
    },
  });

  const currentColor = watch('color');
  const currentName  = watch('name');

  const mutation = useMutation({
    mutationFn: (vals: TagFormValues) =>
      tag ? tagsApi.update(tag.id, vals) : tagsApi.create(vals),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tags'] });
      toast.success(tag ? 'Tag updated.' : 'Tag created.');
      onClose();
    },
  });

  return (
    <form onSubmit={handleSubmit(v => mutation.mutate(v))} className="space-y-4">
      {/* Live preview */}
      <div className="flex justify-center py-1">
        <span
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium text-white select-none"
          style={{ backgroundColor: /^#[0-9a-fA-F]{6}$/.test(currentColor) ? currentColor : '#94a3b8' }}
        >
          {currentName.trim() || 'Preview'}
        </span>
      </div>

      <div>
        <label htmlFor="tag-name" className="label">Name</label>
        <input
          id="tag-name"
          className="input"
          placeholder="e.g. Design, Dev, Admin"
          {...register('name', { required: true })}
        />
        {errors.name && <p className="text-xs text-red-500 mt-1">Name is required</p>}
      </div>

      <div>
        <label className="label mb-2 block">Color</label>
        {/* Preset palette */}
        <div className="flex flex-wrap gap-2 mb-3">
          {PALETTE.map(color => (
            <button
              key={color}
              type="button"
              className="w-7 h-7 rounded-full flex items-center justify-center transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-500"
              style={{ backgroundColor: color }}
              onClick={() => setValue('color', color, { shouldValidate: true })}
              title={color}
            >
              {currentColor === color && (
                <svg aria-hidden="true" className="w-4 h-4 text-white drop-shadow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
        {/* Custom hex input */}
        <input
          className="input font-mono text-sm"
          placeholder="#94a3b8"
          {...register('color', {
            required: true,
            pattern: {
              value:   /^#[0-9a-fA-F]{6}$/,
              message: 'Must be a valid hex color (e.g. #94a3b8)',
            },
          })}
        />
        {errors.color && <p className="text-xs text-red-500 mt-1">{errors.color.message ?? 'Invalid color'}</p>}
      </div>

      <div className="flex gap-3 justify-end pt-1">
        <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
        <button type="submit" className="btn-primary" disabled={mutation.isPending}>
          {mutation.isPending ? 'Saving...' : tag ? 'Update' : 'Create Tag'}
        </button>
      </div>
    </form>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function Tags() {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editTag,  setEditTag]  = useState<Tag | undefined>();
  const [deleteId, setDeleteId] = useState<number | undefined>();

  const { data, isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn:  () => tagsApi.list(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tagsApi.delete(id),
    onSuccess:  () => { qc.invalidateQueries({ queryKey: ['tags'] }); toast.success('Tag deleted.'); },
  });

  const tags = data?.data ?? [];

  const openAdd  = () => { setEditTag(undefined); setShowForm(true); };
  const openEdit = (t: Tag) => { setEditTag(t); setShowForm(true); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tags</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Categorize time entries with colored labels.
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={openAdd}>+ New Tag</button>
      </div>

      {isLoading ? <LoadingSpinner /> : tags.length === 0 ? (
        <EmptyState
          title="No tags yet"
          description="Use tags to categorize and filter your time entries across projects and clients."
          action={<button type="button" className="btn-primary" onClick={openAdd}>Create your first tag</button>}
        />
      ) : (
        <div className="card p-6">
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">{tags.length} tag{tags.length !== 1 ? 's' : ''} — hover to edit or delete</p>
          <div className="flex flex-wrap gap-3">
            {tags.map(t => (
              <div
                key={t.id}
                className="group flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full text-sm font-medium text-white transition-shadow hover:shadow-md"
                style={{ backgroundColor: t.color }}
              >
                <span>{t.name}</span>
                <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    className="w-5 h-5 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition-colors"
                    onClick={() => openEdit(t)}
                    title={`Edit ${t.name}`}
                  >
                    <svg aria-hidden="true" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                    </svg>
                    <span className="sr-only">Edit {t.name}</span>
                  </button>
                  <button
                    type="button"
                    className="w-5 h-5 rounded-full bg-white/20 hover:bg-red-500/70 flex items-center justify-center transition-colors"
                    onClick={() => setDeleteId(t.id)}
                    title={`Delete ${t.name}`}
                  >
                    <svg aria-hidden="true" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                    <span className="sr-only">Delete {t.name}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Modal
        open={showForm}
        onClose={() => setShowForm(false)}
        title={editTag ? 'Edit Tag' : 'New Tag'}
        size="sm"
      >
        <TagForm tag={editTag} onClose={() => setShowForm(false)} />
      </Modal>

      <ConfirmDialog
        open={deleteId !== undefined}
        onClose={() => setDeleteId(undefined)}
        onConfirm={() => { if (deleteId !== undefined) deleteMutation.mutate(deleteId); }}
        title="Delete Tag"
        message="Are you sure you want to delete this tag? It will be removed from all time entries that use it."
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}
