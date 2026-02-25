import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { Dashboard }   from './pages/Dashboard';
import { TimeEntries } from './pages/TimeEntries';
import { Projects }    from './pages/Projects';
import { Clients }     from './pages/Clients';
import { Invoices }    from './pages/Invoices';
import { Reports }     from './pages/Reports';
import { Settings }    from './pages/Settings';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/"         element={<Dashboard />} />
          <Route path="/time"     element={<TimeEntries />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/clients"  element={<Clients />} />
          <Route path="/invoices" element={<Invoices />} />
          <Route path="/reports"  element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
