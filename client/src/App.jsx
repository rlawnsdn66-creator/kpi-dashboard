import { Routes, Route } from 'react-router-dom';
import { PeriodProvider } from './context/PeriodContext';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import KpiPage from './pages/KpiPage';

import TeamPage from './pages/TeamPage';
import SettingsPage from './pages/SettingsPage';
import ReviewPage from './pages/ReviewPage';
import ReviewDetailPage from './pages/ReviewDetailPage';

export default function App() {
  return (
    <PeriodProvider>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/kpi" element={<KpiPage />} />
          <Route path="/team" element={<TeamPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/review/:id" element={<ReviewDetailPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </PeriodProvider>
  );
}
