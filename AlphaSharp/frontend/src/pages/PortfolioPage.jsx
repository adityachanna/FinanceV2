import { useCallback, useEffect, useState } from 'react';
import { Download, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import yahooFinanceService from '../services/yahooFinanceService';
import { number, percent, quoteData } from '../utils/marketData';

const storageKey = 'portfolio_positions';
function readPositions() {
  try { const value = JSON.parse(localStorage.getItem(storageKey) || '[]'); return Array.isArray(value) ? value : []; }
  catch { return []; }
}
export default function PortfolioPage() {
  const [positions, setPositions] = useState(readPositions);
  const [form, setForm] = useState({ ticker: '', shares: '', avgPrice: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [updated, setUpdated] = useState(null);
  useEffect(() => { localStorage.setItem(storageKey, JSON.stringify(positions)); }, [positions]);
  const tickers = [...new Set(positions.map(position => position.ticker))].sort().join(',');
  const refresh = useCallback(async () => {
    if (!tickers) return;
    setBusy(true); setError('');
    try {
      const results = await yahooFinanceService.getQuotes(tickers.split(','));
      const quotes = new Map(results.filter(item => item.data).map(item => [item.ticker, quoteData(item.data)]));
      setPositions(previous => previous.map(position => {
        const quote = quotes.get(position.ticker);
        return Number.isFinite(quote?.price) ? { ...position, currentPrice: quote.price, quoteAsOf: quote.asOf, currency: quote.currency || 'USD', stale: false } : { ...position, stale: true };
      }));
      if (quotes.size !== tickers.split(',').length) setError('Some quotes could not be refreshed. Their last known values are marked stale.');
      setUpdated(new Date().toLocaleTimeString());
    } catch { setError('Quotes are unavailable. Last known values are retained.'); }
    finally { setBusy(false); }
  }, [tickers]);
  useEffect(() => { refresh(); const timer = setInterval(refresh, 60000); return () => clearInterval(timer); }, [refresh]);
  const add = async event => {
    event.preventDefault(); setError(''); setBusy(true);
    try {
      const ticker = form.ticker.trim().toUpperCase();
      const shares = Number(form.shares), avgPrice = Number(form.avgPrice);
      if (!ticker || shares <= 0 || avgPrice <= 0) throw new Error('Enter a symbol, positive shares and positive average cost.');
      const quote = quoteData(await yahooFinanceService.getQuote(ticker));
      if (!Number.isFinite(quote?.price)) throw new Error('A valid market quote is required to add a position.');
      if (quote.currency && quote.currency !== 'USD') throw new Error('This portfolio currently supports USD securities only.');
      setPositions(previous => [...previous, { id: crypto.randomUUID(), ticker, shares, avgPrice, currentPrice: quote.price,
        currency: quote.currency || 'USD', quoteAsOf: quote.asOf, addedAt: new Date().toISOString() }]);
      setForm({ ticker: '', shares: '', avgPrice: '' });
    } catch (caught) { setError(caught.message || 'The position could not be added.'); }
    finally { setBusy(false); }
  };
  const cost = positions.reduce((sum, position) => sum + position.shares * position.avgPrice, 0);
  const value = positions.reduce((sum, position) => sum + position.shares * position.currentPrice, 0);
  const exportCSV = () => {
    const rows = [['Ticker', 'Shares', 'Average cost', 'Last price', 'Quote date', 'Currency'], ...positions.map(position => [position.ticker, position.shares, position.avgPrice, position.currentPrice, position.quoteAsOf || '', position.currency || 'USD'])];
    const url = URL.createObjectURL(new Blob([rows.map(row => row.map(cell => '"' + String(cell).replaceAll('"', '""') + '"').join(',')).join('\n')], { type: 'text/csv' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'alphasharp-positions.csv'; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return <div className="workspace-page"><div className="workspace-intro"><div><h1>Portfolio</h1><p>Current holdings and cost-based profit or loss. Saved only in this browser.</p></div><button className="outline-button" disabled={busy || !positions.length} onClick={refresh}><RefreshCw size={16} /> Refresh quotes</button></div>
    {error && <div className="notice" role="alert">{error}</div>}
    <div className="risk-metrics"><article><span>Current value</span><strong>${number(value)}</strong></article><article><span>Total cost</span><strong>${number(cost)}</strong></article><article><span>Unrealized profit / loss</span><strong className={value >= cost ? 'positive' : 'negative'}>${number(value-cost)}</strong></article><article><span>Return on cost</span><strong>{cost ? percent((value-cost)/cost) : '—'}</strong></article></div>
    <form onSubmit={add} className="position-form"><label>Symbol<input value={form.ticker} onChange={event => setForm({ ...form, ticker: event.target.value })} maxLength={15} required /></label><label>Shares<input type="number" min="0.000001" step="any" value={form.shares} onChange={event => setForm({ ...form, shares: event.target.value })} required /></label><label>Average cost in USD<input type="number" min="0.01" step="any" value={form.avgPrice} onChange={event => setForm({ ...form, avgPrice: event.target.value })} required /></label><button className="primary-button" disabled={busy}><Plus size={16} /> Add position</button></form>
    {positions.length ? <div className="table-scroll"><table className="research-table"><thead><tr><th>Holding</th><th>Shares</th><th>Average cost</th><th>Last price</th><th>Value</th><th>P/L</th><th>Weight</th><th /></tr></thead><tbody>{positions.map(position => <tr key={position.id}><td><Link to={'/stock/' + position.ticker}>{position.ticker}</Link>{position.stale && ' · Stale'}</td><td>{number(position.shares)}</td><td>${number(position.avgPrice)}</td><td>${number(position.currentPrice)}</td><td>${number(position.shares*position.currentPrice)}</td><td>${number(position.shares*(position.currentPrice-position.avgPrice))}</td><td>{value ? percent(position.shares*position.currentPrice/value) : '—'}</td><td><button className="quiet-button" title={'Remove ' + position.ticker} onClick={() => setPositions(previous => previous.filter(item => item.id !== position.id))}><Trash2 size={15} /></button></td></tr>)}</tbody></table></div> : <div className="panel empty-copy">Add a USD holding to see its market value and unrealized return.</div>}
    <div className="macro-footer"><span>{updated ? 'Last refresh ' + updated + '. ' : ''}Quotes may be delayed. P/L excludes fees, dividends and taxes. Signing out removes these positions.</span><button className="outline-button" onClick={exportCSV} disabled={!positions.length}><Download size={16} /> Export positions</button></div>
    <p className="method-note">The Risk lab models S&P 500 index exposure. It does not estimate this portfolio's risk.</p>
  </div>;
}
