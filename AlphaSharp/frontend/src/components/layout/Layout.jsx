import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import WorkspaceChrome from './WorkspaceChrome';

export default function Layout() {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="app-shell" />;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  return (
    <div className="app-shell">
      <WorkspaceChrome><Outlet /></WorkspaceChrome>
    </div>
  );
}

