import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TimerWidget } from '../timer/TimerWidget';
import { useUiStore } from '../../store/uiStore';

export function AppShell() {
  const toggleSidebar = useUiStore(s => s.toggleSidebar);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0 gap-4">
          <button
            onClick={toggleSidebar}
            className="btn-ghost btn-sm p-2 rounded-lg"
            title="Toggle sidebar"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <div className="flex-1" />
          <TimerWidget />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
