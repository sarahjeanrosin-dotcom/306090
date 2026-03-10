import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Goals from './pages/Goals';
import Tasks from './pages/Tasks';
import Deliverables from './pages/Deliverables';
import WeeklyUpdate from './pages/WeeklyUpdate';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/goals" element={<Goals />} />
          <Route path="/goals/:id" element={<Goals />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/deliverables" element={<Deliverables />} />
          <Route path="/updates" element={<WeeklyUpdate />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
