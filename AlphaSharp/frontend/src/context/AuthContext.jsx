import { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/authService';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const authenticated = authService.isAuthenticated();
    setUser(authenticated ? authService.getStoredUser() : null);
    setIsAuthenticated(authenticated);
    setLoading(false);
  }, []);

  const enterDemo = async (email, password, name = '') => {
    const nextUser = authService.hasProfile()
      ? await authService.loginDemo(email, password)
      : await authService.createDemoProfile(email, password, name);
    setUser(nextUser);
    setIsAuthenticated(true);
    toast.success('Workspace ready');
    navigate('/dashboard');
  };

  const logout = () => {
    authService.clearAllLocalData();
    setUser(null);
    setIsAuthenticated(false);
    toast.success('Local data cleared');
    navigate('/');
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, enterDemo, logout, handleAuthSuccess: enterDemo }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

