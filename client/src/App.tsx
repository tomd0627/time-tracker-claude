import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AppShell } from './components/layout/AppShell';
import { Clients }     from './pages/Clients';
import { Dashboard }   from './pages/Dashboard';
import { Expenses }    from './pages/Expenses';
import { Invoices }    from './pages/Invoices';
import { Projects }    from './pages/Projects';
import { Reports }     from './pages/Reports';
import { Settings }    from './pages/Settings';
import { Tags }        from './pages/Tags';
import { TimeEntries } from './pages/TimeEntries';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster richColors position="bottom-right" />
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/"         element={<Dashboard />} />
          <Route path="/time"     element={<TimeEntries />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/clients"  element={<Clients />} />
          <Route path="/expenses" element={<Expenses />} />
          <Route path="/tags"     element={<Tags />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/reports"  element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
