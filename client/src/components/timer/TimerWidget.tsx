import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeEntriesApi, projectsApi } from '../../api';
import { useTimerStore } from '../../store/timerStore';
import { TimerDisplay } from './TimerDisplay';
import { cn } from '../../utils/cn';

export function TimerWidget() {
  const qc = useQueryClient();
  const { startTick, stopTick } = useTimerStore();
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState<number | undefined>();

  const { data: runningData } = useQuery({
    queryKey: ['time-entries', 'running'],
    queryFn: () => timeEntriesApi.running(),
    refetchInterval: 30_000,
  });

  const { data: projectsData } = useQuery({
    queryKey: ['projects', {}],
    queryFn: () => projectsApi.list({ status: 'active' }),
  });

  const running = runningData?.data ?? null;
  const projects = projectsData?.data ?? [];

  // Sync timer tick with running entry
  useEffect(() => {
    if (running) {
      const elapsed = Math.floor((Date.now() - running.startedAt) / 1000);
      startTick(elapsed);
      setDescription(running.description ?? '');
      setProjectId(running.projectId ?? undefined);
    } else {
      stopTick();
    }
  }, [running?.id]);

  const startMutation = useMutation({
    mutationFn: () => timeEntriesApi.start({ description: description || undefined, projectId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries'] });
    },
  });

  const stopMutation = useMutation({
    mutationFn: () => timeEntriesApi.stop(running!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries'] });
      stopTick();
    },
  });

  const pauseMutation = useMutation({
    mutationFn: () => timeEntriesApi.pause(running!.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['time-entries'] });
      stopTick();
    },
  });

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
        onChange={e => setProjectId(e.target.value ? parseInt(e.target.value) : undefined)}
        disabled={!!running}
      >
        <option value="">No project</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>

      {/* Timer display (only when running) */}
      {running && <TimerDisplay />}

      {/* Controls */}
      {running ? (
        <div className="flex gap-1">
          <button
            className="btn-secondary btn-sm"
            onClick={() => pauseMutation.mutate()}
            disabled={isLoading}
            title="Pause"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
            </svg>
          </button>
          <button
            className="btn-danger btn-sm"
            onClick={() => stopMutation.mutate()}
            disabled={isLoading}
            title="Stop"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 6h12v12H6z"/>
            </svg>
          </button>
        </div>
      ) : (
        <button
          className="btn-primary btn-sm"
          onClick={() => startMutation.mutate()}
          disabled={isLoading}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z"/>
          </svg>
          Start
        </button>
      )}
    </div>
  );
}
