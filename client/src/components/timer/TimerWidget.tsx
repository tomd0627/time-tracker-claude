import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeEntriesApi, projectsApi, tagsApi } from '../../api';
import { useTimerStore } from '../../store/timerStore';
import { TimerDisplay } from './TimerDisplay';
import { cn } from '../../utils/cn';

export function TimerWidget() {
  const qc = useQueryClient();
  const { startTick, stopTick } = useTimerStore();
  const [description,    setDescription]    = useState('');
  const [projectId,      setProjectId]      = useState<number | undefined>();
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [showTagPicker,  setShowTagPicker]  = useState(false);
  const tagPickerRef = useRef<HTMLDivElement>(null);

  const { data: runningData } = useQuery({
    queryKey: ['time-entries', 'running'],
    queryFn: () => timeEntriesApi.running(),
    refetchInterval: 30_000,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects', {}],
    queryFn: () => projectsApi.list({ status: 'active' }),
  });

  const { data: tagsData } = useQuery({
    queryKey: ['tags'],
    queryFn: () => tagsApi.list(),
  });

  const running  = runningData?.data ?? null;
  const projects = projectsData?.data ?? [];
  const tags     = tagsData?.data     ?? [];

  // Sync widget state with running entry
  useEffect(() => {
    if (running) {
      const elapsed = Math.floor((Date.now() - running.startedAt) / 1000);
      startTick(elapsed);
      setDescription(running.description ?? '');
      setProjectId(running.projectId ?? undefined);
      setSelectedTagIds(running.tags.map(t => t.id));
    } else {
      stopTick();
    }
  }, [running]);

  // Close tag picker on outside click
  useEffect(() => {
    if (!showTagPicker) return;
    function onMouseDown(e: MouseEvent) {
      if (tagPickerRef.current && !tagPickerRef.current.contains(e.target as Node)) {
        setShowTagPicker(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [showTagPicker]);

  const startMutation = useMutation({
    mutationFn: () => timeEntriesApi.start({
      description: description || undefined,
      projectId,
      tagIds: selectedTagIds,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries'] });
      setShowTagPicker(false);
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => timeEntriesApi.stop(running!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries'] });
      stopTick();
      setSelectedTagIds([]);
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => timeEntriesApi.pause(running!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries'] });
      stopTick();
      setSelectedTagIds([]);
    },
  });

  const toggleTag = (id: number) =>
    setSelectedTagIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const isLoading = startMutation.isPending || stopMutation.isPending || pauseMutation.isPending;

  return (
    <div className="flex items-center gap-3">
      {/* Description input */}
      <input
        className={cn(
          'input w-56 text-sm',
          running && 'border-brand-400 ring-1 ring-brand-400'
        )}
        placeholder="What are you working on?"
        value={description}
        onChange={e => setDescription(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !running) startMutation.mutate(); }}
        disabled={!!running}
      />

      {/* Project selector */}
      <select
        className="input w-36 text-sm"
        value={projectId ?? ''}
        onChange={e => setProjectId(e.target.value ? parseInt(e.target.value, 10) : undefined)}
        disabled={!!running}
      >
        <option value="">No project</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {/* Tag picker (not running) or tag pills (running) */}
      {!running && tags.length > 0 && (
        <div className="relative" ref={tagPickerRef}>
          <button
            type="button"
            className={cn(
              'btn-secondary btn-sm flex items-center gap-1.5',
              selectedTagIds.length > 0 && 'border-brand-400 text-brand-600 dark:text-brand-400'
            )}
            onClick={() => setShowTagPicker(v => !v)}
            title="Tags"
          >
            {/* tag icon */}
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5a1.99 1.99 0 011.414.586l7 7a2 2 0 010 2.828l-5 5a2 2 0 01-2.828 0l-7-7A2 2 0 013 10V5a2 2 0 012-2z"/>
            </svg>
            {selectedTagIds.length > 0 && (
              <span className="text-xs font-semibold">{selectedTagIds.length}</span>
            )}
          </button>

          {showTagPicker && (
            <div className="absolute top-full left-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3 z-50 min-w-[180px]">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {tags.map(t => {
                  const active = selectedTagIds.includes(t.id);
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => toggleTag(t.id)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all"
                      style={{
                        backgroundColor: active ? t.color : 'transparent',
                        color:           active ? '#fff'  : t.color,
                        border:          `1.5px solid ${t.color}`,
                      }}
                    >
                      {t.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Running tag pills */}
      {running && selectedTagIds.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.filter(t => selectedTagIds.includes(t.id)).map(t => (
            <span
              key={t.id}
              className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: t.color }}
            >
              {t.name}
            </span>
          ))}
        </div>
      )}

      {/* Timer display (only when running) */}
      {running && <TimerDisplay />}

      {/* Controls */}
      {running ? (
        <div className="flex gap-1">
          <button
            type="button"
            className="btn-secondary btn-sm"
            onClick={() => pauseMutation.mutate()}
            disabled={isLoading}
            title="Pause"
          >
            <svg className="w-4 h-4" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          </button>
          <button
            type="button"
            className="btn-danger btn-sm"
            onClick={() => stopMutation.mutate()}
            disabled={isLoading}
            title="Stop"
          >
            <svg className="w-4 h-4" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z"/>
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={() => startMutation.mutate()}
          disabled={isLoading}
        >
          <svg className="w-4 h-4" aria-hidden="true" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
          Start
        </button>
      )}
    </div>
  );
}
