import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import PasswordGate from './components/PasswordGate';
import Dashboard from './pages/Dashboard';
import Goals from './pages/Goals';
import Tasks from './pages/Tasks';
import Deliverables from './pages/Deliverables';
import WeeklyUpdate from './pages/WeeklyUpdate';
import Settings from './pages/Settings';

export default function App() {
  return (
    <PasswordGate>
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/goals/:id" element={<Goals />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/deliverables" element={<Deliverables />} />
          <Route path="/updates" element={<WeeklyUpdate />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Layout>
    </BrowserRouter>
    </PasswordGate>
  );
}
