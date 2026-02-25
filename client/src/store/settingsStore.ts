import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsState {
  darkMode: boolean;
  defaultCurrency: string;
  toggleDarkMode: () => void;
  setDarkMode: (dark: boolean) => void;
  setDefaultCurrency: (currency: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      darkMode: false,
      defaultCurrency: 'USD',
      toggleDarkMode: () =>
        set(s => {
          const next = !s.darkMode;
          document.documentElement.classList.toggle('dark', next);
          return { darkMode: next };
        }),
      setDarkMode: (dark: boolean) => {
        document.documentElement.classList.toggle('dark', dark);
        set({ darkMode: dark });
      },
      setDefaultCurrency: (currency: string) => set({ defaultCurrency: currency }),
    }),
    {
      name: 'tt-settings',
      onRehydrateStorage: () => (state) => {
        if (state?.darkMode) {
          document.documentElement.classList.add('dark');
        }
      },
    }
  )
);
