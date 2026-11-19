import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowUpRight, RefreshCw, Search, Star } from 'lucide-react';
import { marketService } from '../services/marketService';
import RegimeHistoryChart from '../components/charts/RegimeHistoryChart';
import MacroPulse from '../components/dashboard/MacroPulse';
import TickerSearch from '../components/stock/TickerSearch';
import { number, percent, unwrap } from '../utils/marketData';

export default function DashboardPage() {
  const [condition, setCondition] = useState(null), [history, setHistory] = useState([]);
  const [period, setPeriod] = useState(63), [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [watchlist, setWatchlist] = useState([]);
  useEffect(() => {
    let active = true; setLoading(true); setError('');
    Promise.allSettled([marketService.getMarketCondition(), marketService.getRegimeHistory(period)]).then(([state, series]) => {
      if (!active) return;
      if (state.status === 'fulfilled') setCondition(unwrap(state.value)); else setError('Market data could not be refreshed. Please try again.');
      if (series.status === 'fulfilled') setHistory(unwrap(series.value)?.history || []);
      try { setWatchlist(JSON.parse(localStorage.getItem('user_watchlist') || '[]')); } catch { setWatchlist([]); }
      setLoading(false);
    });
    return () => { active = false; };
  }, [period, refresh]);
  const regime = condition?.regime;
  return <div className="workspace-page overview-page"><div className="workspace-intro"><div><h1>Market overview</h1><p>A connected view of market conditions and the risk ahead.</p></div><button className="outline-button" disabled={loading} onClick={() => setRefresh(value => value + 1)}><RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Refresh data</button></div>
    {error && <div className="notice" role="alert">{error}</div>}
    <div className="overview-meta"><span className="observation-label"><span className="status-dot" />{condition?.date ? `Observation as of ${condition.date}` : 'Connecting to market data'}</span><span>S&P 500 / US equities</span></div>
    <section className="overview-stats" aria-label="Market summary"><article><span>S&P 500 index</span><strong>{number(condition?.market_data?.spx_price)}</strong><small>Daily closing level</small></article><article><span>VIX index</span><strong>{number(condition?.market_data?.vix)}</strong><small>Implied volatility</small></article><article><span>Market regime</span><strong className="regime-stat" style={{ color: regime?.color }}>{regime?.label || 'Loading…'}</strong><small>Explicit-duration HSMM</small></article><article><span>Estimated state age</span><strong>{number(regime?.estimated_age ?? regime?.days_in_regime)}<em>sessions</em></strong><small>Accounts for elapsed duration</small></article></section>
    <div className="overview-analysis"><section className="overview-chart">{history.length ? <RegimeHistoryChart data={history} title="Market trajectory" initialPeriod={period} onPeriodChange={setPeriod} /> : <div className="panel empty-copy" role="status">{loading ? 'Loading market history…' : 'Market history is unavailable.'}</div>}</section><aside className="regime-insight"><div className="insight-title"><Activity size={17} /><span>Regime intelligence</span></div><h2>{regime?.label || 'Reading the market'}</h2><p>How the model currently weighs the three volatility environments.</p><div className="insight-probabilities">{condition?.states?.map(state => <div className="state-probability" key={state.id}><div><span><i style={{ background: state.color }} />{state.label}</span><strong>{percent(state.probability)}</strong></div><meter min="0" max="1" value={state.probability} style={{ accentColor: state.color }}>{percent(state.probability)}</meter></div>)}</div><p className="insight-footnote">Model probabilities describe the fitted model, not classification accuracy.</p><Link className="primary-button" to="/market">Explore risk scenarios <ArrowUpRight size={16} /></Link><details className="insight-model"><summary>Model details</summary><p>{condition?.model_info?.model_id}<br />Trained {condition?.model_info?.training_start} to {condition?.model_info?.training_end}</p></details></aside></div>
    <MacroPulse />
    <div className="dashboard-grid"><section className="panel search-panel"><div className="panel-heading"><div><h2>Company research</h2><p>Start with a ticker or company name.</p></div><Search size={19} /></div><TickerSearch /><div className="quick-tickers">Quick access <Link to="/stock/AAPL">AAPL</Link><Link to="/stock/MSFT">MSFT</Link><Link to="/stock/NVDA">NVDA</Link></div></section><section className="panel watchlist-panel"><div className="panel-heading"><div><h2>Your watchlist</h2><p>Companies saved in this workspace.</p></div><Star size={19} /></div>{watchlist.length ? <div className="watchlist-items">{watchlist.map(stock => <Link key={stock.ticker} to={`/stock/${stock.ticker}`}><strong>{stock.ticker}</strong><span>{stock.company_name || 'View company'}</span><ArrowUpRight size={15} /></Link>)}</div> : <div className="watchlist-empty"><Star size={22} /><div><strong>Keep the companies that matter.</strong><p>Open a company and select Save company to add it here.</p></div></div>}<Link className="text-link" to="/portfolio">View your portfolio <ArrowUpRight size={14} /></Link></section></div>
  </div>;
}



