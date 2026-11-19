import { Routes, Route } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Layout from './components/layout/Layout';

import HomePage from './pages/HomePage';
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const StockDetailsPage = lazy(() => import('./pages/StockResearchPage'));
const MarketOverviewPage = lazy(() => import('./pages/RiskLabPage'));
const AgentPage = lazy(() => import('./pages/AgentPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const PortfolioPage = lazy(() => import('./pages/PortfolioPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function App() {
  return (
    <Suspense fallback={<div className="page-container empty-copy" role="status">Loading workspace…</div>}><Routes>
      <Route path="/" element={<HomePage />} />
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/stock/:ticker" element={<StockDetailsPage />} />
        <Route path="/market" element={<MarketOverviewPage />} />
        <Route path="/agent" element={<AgentPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes></Suspense>
  );
}

export default App;
