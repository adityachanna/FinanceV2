import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { ArrowUpRight, LogOut } from 'lucide-react';

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  return <header className="site-header"><div className="site-header-inner"><Link to="/" className="brand" aria-label="AlphaSharp home"><img className="brand-mark" src="/alphasharp-mark.svg" alt="" /><span>AlphaSharp</span></Link><nav className="landing-nav" aria-label="Explore AlphaSharp"><a href="#market">Markets</a><a href="#risk">Risk scenarios</a><a href="#research">Research tools</a></nav><div className="site-header-actions">{isAuthenticated ? <><Link className="primary-button" to="/dashboard">Your workspace <ArrowUpRight size={16} /></Link><button type="button" className="quiet-button" onClick={logout} title={`Clear ${user?.name || 'your'} local profile and sign out`} aria-label="Sign out and clear local data"><LogOut size={17} /></button></> : <a className="primary-button" href="#workspace">Get started <ArrowUpRight size={16} /></a>}</div></div></header>;
}


