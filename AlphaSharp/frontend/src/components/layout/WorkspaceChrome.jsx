import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Activity, ArrowUpRight, BarChart3, ChevronRight, Command, LayoutDashboard, LogOut, Menu, Search, Settings2, Sparkles, Wallet, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { stockService } from '../../services/stockService';

const destinations = [
  { label: 'Overview', path: '/dashboard', icon: LayoutDashboard, description: 'Market state and cross-asset context' },
  { label: 'Risk lab', path: '/market', icon: Activity, description: 'Scenarios, historical replay and evaluation' },
  { label: 'Company research', path: '/stock/AAPL', icon: BarChart3, description: 'Prices, fundamentals and saved companies' },
  { label: 'Portfolio', path: '/portfolio', icon: Wallet, description: 'Holdings and unrealized returns' },
  { label: 'AI assistant', path: '/agent', icon: Sparkles, description: 'Ask a question about the market' },
];

export default function WorkspaceChrome({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation(), navigate = useNavigate();
  const [mobile, setMobile] = useState(false);
  const [query, setQuery] = useState(''), [results, setResults] = useState([]), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const dialog = useRef(null);
  const current = destinations.find(item => location.pathname.startsWith(item.path.split('/').slice(0, 2).join('/'))) || { label: 'Workspace settings' };
  const close = () => { dialog.current?.close(); setQuery(''); setResults([]); setError(''); };
  const go = path => { close(); navigate(path); };
  useEffect(() => { setMobile(false); close(); }, [location.pathname]);
  useEffect(() => {
    const handler = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); dialog.current?.showModal(); }
      if (event.key === 'Escape') setMobile(false);
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, []);
  const search = async event => {
    event.preventDefault(); if (!query.trim()) return;
    setBusy(true); setError('');
    try { const result = await stockService.searchTicker(query.trim()); setResults((result.data ?? result).results || []); }
    catch { setError('Search is unavailable. Try again.'); }
    finally { setBusy(false); }
  };
  return <div className="workspace-frame">
    <a className="skip-link" href="#workspace-main">Skip to content</a>
    {mobile && <button className="sidebar-scrim" aria-label="Close navigation" onClick={() => setMobile(false)} />}
    <aside className={`workspace-sidebar ${mobile ? 'is-open' : ''}`}>
      <Link className="brand workspace-brand" to="/dashboard"><img className="brand-mark" src="/alphasharp-mark.svg" alt="" />AlphaSharp</Link>
      <div className="workspace-switch"><span className="workspace-avatar">{user?.name?.slice(0, 1)?.toUpperCase() || 'A'}</span><span><strong>Personal workspace</strong><small>Market intelligence</small></span><ChevronRight size={14} /></div>
      <span className="nav-section-title">Workspace</span>
      <nav aria-label="Main navigation">{destinations.map(({ label, path, icon: Icon }) => <NavLink key={path} to={path} className={({ isActive }) => `workspace-nav-item ${isActive || (path.startsWith('/stock/') && location.pathname.startsWith('/stock/')) ? 'active' : ''}`}><Icon size={18} strokeWidth={1.7} /><span>{label}</span>{label === 'AI assistant' && <span className="nav-ai-tag">AI</span>}</NavLink>)}</nav>
      <div className="sidebar-context"><div><Activity size={16} /><strong>Understand the range.</strong></div><p>Compare market scenarios with what happened next.</p><Link to="/market">Explore the risk lab <ArrowUpRight size={14} /></Link></div>
      <div className="sidebar-bottom"><NavLink to="/profile" className="workspace-nav-item"><Settings2 size={18} /> Workspace settings</NavLink><div className="sidebar-person"><Link to="/profile" className="person-link"><span className="profile-chip">{user?.name?.slice(0, 1)?.toUpperCase() || 'A'}</span><span><strong>{user?.name || 'Your profile'}</strong><small>{user?.email}</small></span></Link><button className="icon-button" title="Sign out and clear local data" aria-label="Sign out and clear local data" onClick={logout}><LogOut size={17} /></button></div></div>
    </aside>
    <div className="workspace-body"><header className="workspace-topbar"><div className="workspace-breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" aria-expanded={mobile} onClick={() => setMobile(true)}><Menu size={20} /></button><span>Workspace</span><ChevronRight size={14} /><strong>{current.label}</strong></div><button className="command-trigger" onClick={() => dialog.current?.showModal()}><Search size={15} /><span>Search or jump to...</span><kbd>Ctrl / Cmd K</kbd></button><span className="topbar-mode"><span /> Daily market data</span></header>
      <main id="workspace-main" className="page-container">{children}</main><footer className="workspace-footer"><span>AlphaSharp</span><span>Prices may be delayed. Scenarios describe uncertainty.</span></footer>
    </div>
    <dialog className="command-dialog" ref={dialog} onClick={event => { if (event.target === dialog.current) close(); }}><form onSubmit={search}><Search size={19} /><input autoFocus aria-label="Search companies or navigate" placeholder="Search a company or jump to a page" value={query} onChange={event => { setQuery(event.target.value); setResults([]); }} /><button type="submit" disabled={busy}>{busy ? 'Searching...' : 'Search'}</button><button className="icon-button" type="button" onClick={close} aria-label="Close search"><X size={17} /></button></form><div className="command-results">{error && <p role="alert">{error}</p>}{results.map(item => <button key={item.symbol} onClick={() => go(`/stock/${encodeURIComponent(item.symbol)}`)}><BarChart3 size={17} /><span><strong>{item.symbol}</strong><small>{item.name}</small></span><ArrowUpRight size={15} /></button>)}{!results.length && destinations.filter(item => `${item.label} ${item.description}`.toLowerCase().includes(query.toLowerCase())).map(({ label, path, icon: Icon, description }) => <button key={path} onClick={() => go(path)}><Icon size={18} /><span><strong>{label}</strong><small>{description}</small></span><ChevronRight size={15} /></button>)}</div><div className="command-footer"><Command size={13} /> Navigate with Tab, select with Enter <kbd>Esc to close</kbd></div></dialog>
  </div>;
}
