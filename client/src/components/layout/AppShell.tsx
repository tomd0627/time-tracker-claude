import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TimerWidget } from '../timer/TimerWidget';
import { useUiStore } from '../../store/uiStore';

export function AppShell() {
  const toggleSidebar       = useUiStore(s => s.toggleSidebar);
  const toggleMobileSidebar = useUiStore(s => s.toggleMobileSidebar);
  const closeMobileSidebar  = useUiStore(s => s.closeMobileSidebar);
  const mobileSidebarOpen   = useUiStore(s => s.mobileSidebarOpen);

  const hamburgerIcon = (
    <svg className="w-5 h-5" aria-hidden="true" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16"/>
    </svg>
  );

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={closeMobileSidebar}
          aria-hidden="true"
        />
      )}

      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex-shrink-0 gap-4">
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={toggleMobileSidebar}
            className="md:hidden btn-ghost btn-sm p-2 rounded-lg"
            title="Open menu"
          >
            {hamburgerIcon}
          </button>

          {/* Desktop sidebar toggle */}
          <button
            type="button"
            onClick={toggleSidebar}
            className="hidden md:block btn-ghost btn-sm p-2 rounded-lg"
            title="Toggle sidebar"
          >
            {hamburgerIcon}
          </button>

          <div className="flex-1" />
          <TimerWidget />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
