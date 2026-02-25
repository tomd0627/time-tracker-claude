import { create } from 'zustand';

interface TimerState {
  elapsedSeconds: number;
  intervalId: ReturnType<typeof setInterval> | null;
  startTick: (initialSecs: number) => void;
  stopTick: () => void;
  setElapsed: (secs: number) => void;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  elapsedSeconds: 0,
  intervalId: null,

  startTick: (initialSecs: number) => {
    const { intervalId } = get();
    if (intervalId) clearInterval(intervalId);

    set({ elapsedSeconds: initialSecs });

    const id = setInterval(() => {
      set(state => ({ elapsedSeconds: state.elapsedSeconds + 1 }));
    }, 1000);

    set({ intervalId: id });
  },

  stopTick: () => {
    const { intervalId } = get();
    if (intervalId) clearInterval(intervalId);
    set({ intervalId: null, elapsedSeconds: 0 });
  },

  setElapsed: (secs: number) => set({ elapsedSeconds: secs }),
}));
