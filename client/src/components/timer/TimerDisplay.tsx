import { useTimerStore } from '../../store/timerStore';
import { formatDuration } from '../../utils/duration';

export function TimerDisplay({ className }: { className?: string }) {
  const elapsed = useTimerStore(s => s.elapsedSeconds);
  return (
    <span className={className ?? 'font-mono text-xl font-bold tabular-nums text-brand-600 dark:text-brand-400'}>
      {formatDuration(elapsed)}
    </span>
  );
}
