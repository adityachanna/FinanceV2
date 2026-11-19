import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Check, ShieldCheck } from 'lucide-react';
import Navbar from '../components/layout/Navbar';
import MarketLandscape from '../components/home/MarketLandscape';
import QuoteRibbon from '../components/home/QuoteRibbon';
import RiskExplorer from '../components/home/RiskExplorer';
import SignalCanvas from '../components/dashboard/SignalCanvas';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/authService';

const tools = [
  { title: 'Company research', copy: 'Prices, fundamentals and performance, brought into one view.', to: '/stock/AAPL', icon: 'research', tags: ['Company fundamentals', 'Price history', 'Watchlists'] },
  { title: 'Historical replay', copy: 'Go back to a market turning point. Explore the forecast before revealing what followed.', to: '/market', icon: 'replay', tags: ['2008 financial crisis', '2020 sell-off', '2022 tightening'] },
  { title: 'Your portfolio', copy: 'Keep track of your positions, cost basis and market value in a workspace of your own.', to: '/portfolio', icon: 'portfolio', tags: ['Position tracking', 'Cost basis', 'Local storage'] },
];

function ToolArtwork({ kind }) {
  if (kind === 'research') return <div className="tool-art tool-art-research"><span className="company-symbol">A</span><div><strong>Company overview</strong><small>Price. Performance. Fundamentals.</small></div><svg viewBox="0 0 230 75" aria-hidden="true"><path d="M0 58 12 52 23 60 34 40 49 45 63 23 76 37 90 33 103 41 118 24 131 30 146 14 159 24 173 9 188 18 204 4 219 11 230 2" fill="none" stroke="#76b59e" strokeWidth="2" /></svg></div>;
  if (kind === 'replay') return <div className="tool-art tool-art-replay"><div className="replay-art-date"><span>March</span><strong>2020</strong></div><div className="replay-art-track"><i /><span /><span /><span /><span /><b /></div><span className="art-play">▶</span><small>Revisit the moment. Reveal the outcome.</small></div>;
  return <div className="tool-art tool-art-portfolio"><div className="portfolio-art-ring"><span>Portfolio</span></div><div><span><i /> Positions</span><span><i /> Cost basis</span><span><i /> Market value</span></div></div>;
}

export default function HomePage() {
  const { isAuthenticated, enterDemo } = useAuth();
  const hasProfile = authService.hasProfile();
  const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [name, setName] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const action = isAuthenticated ? '/market' : '#workspace';
  const submit = async event => {
    event.preventDefault(); setError(''); setBusy(true);
    try { await enterDemo(email, password, name); }
    catch (caught) { setError(caught.message || 'Could not open your workspace.'); }
    finally { setBusy(false); }
  };
  return <div className="site-home landing-v2"><Navbar /><main>
    <section className="landing-hero"><div className="page-container"><QuoteRibbon /><div className="landing-hero-copy"><h1>Make sense of the market.</h1><p>Stocks, market regimes and risk scenarios.<br />One connected place to research your next move.</p><div className="landing-hero-actions">{isAuthenticated ? <Link className="primary-button" to="/dashboard">Open workspace <ArrowUpRight size={19} /></Link> : <a className="primary-button" href="#workspace">Start researching <ArrowUpRight size={19} /></a>}<a href="#market" className="hero-secondary">Explore the market</a></div></div></div><MarketLandscape /></section>
    <SignalCanvas />
    <RiskExplorer action={action} />
    <section className="landing-tools page-container" id="research"><div className="landing-section-heading"><div><h2>Follow your curiosity.</h2><p>From one company to the wider market. Keep your research in one place.</p></div></div><div className="landing-tool-grid">{tools.map(tool => <article key={tool.title}><ToolArtwork kind={tool.icon} /><h3>{tool.title}</h3><p>{tool.copy}</p><ul>{tool.tags.map(tag => <li key={tag}><Check size={14} />{tag}</li>)}</ul>{isAuthenticated ? <Link to={tool.to} className="landing-text-action">Explore {tool.title.toLowerCase()} <ArrowUpRight size={16} /></Link> : <a href="#workspace" className="landing-text-action">Explore {tool.title.toLowerCase()} <ArrowUpRight size={16} /></a>}</article>)}</div></section>
    <section className="landing-method page-container"><div><h2>Keep the evidence<br />in view.</h2><p>Every market view has a source, an observation date and a model behind it. Inspect them as you research.</p></div><div className="method-facts"><article><strong>Daily market data</strong><p>S&P 500 and VIX closing observations, with gold and crude futures for wider context.</p></article><article><strong>Measured against simpler methods</strong><p>Compare the regime model with HMM, EWMA and Gaussian forecasts. Inspect the results in the risk lab.</p></article><article><strong>AI when you need it</strong><p>Ask for an explanation of a snapshot or company. The underlying charts and calculations work independently.</p></article></div></section>
    <section className="entry-section" id="workspace"><div className="page-container entry-grid"><div className="entry-copy"><img src="/alphasharp-mark.svg" alt="" width="48" height="48" /><h2>A fresh perspective<br />starts here.</h2><p>Your companies. Your positions. Your research.<br />Bring them together in your own workspace.</p><div className="privacy-note"><ShieldCheck size={18} /><span>Saved on this device. Signing out clears your local data.</span></div></div>{isAuthenticated ? <div className="return-workspace"><h3>Your workspace is ready.</h3><Link className="primary-button" to="/dashboard">Open workspace <ArrowUpRight size={18} /></Link></div> : <form className="entry-form" onSubmit={submit}><h3>{hasProfile ? 'Welcome back' : 'Create your workspace'}</h3>{!hasProfile && <label>Name<input autoComplete="name" value={name} onChange={event => setName(event.target.value)} placeholder="Your name" required /></label>}<label>Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required /></label><label>Password<input type="password" autoComplete={hasProfile ? 'current-password' : 'new-password'} value={password} onChange={event => setPassword(event.target.value)} minLength={hasProfile ? undefined : 6} placeholder={hasProfile ? 'Your password' : 'At least 6 characters'} required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="primary-button" disabled={busy}>{busy ? 'Opening…' : hasProfile ? 'Open workspace' : 'Create workspace'} <ArrowUpRight size={17} /></button><p className="entry-disclosure">Local profile on this device. No online account is created.</p></form>}</div></section>
  </main><footer className="home-footer page-container"><Link to="/" className="brand"><img className="brand-mark" src="/alphasharp-mark.svg" alt="" />AlphaSharp</Link><span>Research with perspective.</span><a href="#market">Back to the market <ArrowUpRight size={14} /></a></footer></div>;
}


