import RichText from '../components/common/RichText';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Sparkles, Star } from 'lucide-react';
import { stockService } from '../services/stockService';
import { agentService } from '../services/agentService';
import { compact, normalizeHistory, number, percent, unwrap } from '../utils/marketData';
import StockPriceChart from '../components/charts/StockPriceChart';
import NewsCard from '../components/stock/NewsCard';

export default function StockResearchPage() {
  const { ticker } = useParams();
  const symbol = ticker.toUpperCase();
  const [stock, setStock] = useState(null), [history, setHistory] = useState([]), [news, setNews] = useState([]);
  const [saved, setSaved] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [ai, setAi] = useState('built-in'), [brief, setBrief] = useState(''), [writing, setWriting] = useState(false);
  const [newsLoading, setNewsLoading] = useState(true), [newsError, setNewsError] = useState('');
  const [newsRefresh, setNewsRefresh] = useState(0), [newsSource, setNewsSource] = useState('Yahoo Finance');
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setBrief(''); setStock(null); setHistory([]); setNews([]);
    try { setSaved(JSON.parse(localStorage.getItem('user_watchlist') || '[]').some(item => item.ticker === symbol)); } catch { setSaved(false); }
    stockService.getStockAnalysis(symbol).then(result => { if (active) setStock(unwrap(result)?.raw_details ?? unwrap(result)); })
      .catch(caught => { if (active) setError(caught.response?.data?.message || 'Company data is unavailable.'); })
      .finally(() => { if (active) setLoading(false); });
    stockService.getHistoricalPrices(symbol).then(result => { if (active) setHistory(normalizeHistory(result)); }).catch(() => {});
    agentService.getStatus().then(result => { if (active) setAi(unwrap(result)?.configured ? 'ai' : 'built-in'); }).catch(() => {});
    return () => { active = false; };
  }, [symbol]);
  useEffect(() => {
    let active = true;
    setNewsLoading(true); setNewsError(''); setNews([]);
    stockService.getStockNews(symbol, 5, newsRefresh > 0)
      .then(result => { if (active) { const value = unwrap(result); setNews(value?.news_data || []); setNewsSource(value?.source || 'Yahoo Finance'); } })
      .catch(caught => { if (active) setNewsError(caught.response?.data?.message || 'Company news could not be loaded. Try refreshing.'); })
      .finally(() => { if (active) setNewsLoading(false); });
    return () => { active = false; };
  }, [symbol, newsRefresh]);
  const toggle = () => {
    let list; try { list = JSON.parse(localStorage.getItem('user_watchlist') || '[]'); } catch { list = []; }
    list = saved ? list.filter(item => item.ticker !== symbol) : [...list.filter(item => item.ticker !== symbol), { ticker: symbol, company_name: stock?.company_name }];
    localStorage.setItem('user_watchlist', JSON.stringify(list)); setSaved(!saved);
  };
  const explain = async () => {
    setWriting(true);
    try { setBrief(unwrap(await stockService.explain(symbol)).explanation); }
    catch (caught) { setBrief(caught.response?.data?.message || 'The explanation is unavailable.'); }
    finally { setWriting(false); }
  };
  return <div className="workspace-page"><Link className="text-link" to="/dashboard"><ArrowLeft size={15} /> Overview</Link>
    <div className="stock-heading"><div><h1>{symbol}</h1><p>{stock?.company_name || (loading ? 'Loading company…' : 'Company research')}</p></div><div className="stock-price">{stock?.currency || 'USD'} {number(stock?.current_price)}<div><button className="quiet-button" onClick={toggle}><Star size={17} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved to watchlist' : 'Save company'}</button></div></div></div>
    {error && <div className="notice" role="alert">{error}</div>}
    {stock && <><p className="method-note">{stock.sector} · {stock.industry}. Yahoo Finance. Retrieved {stock.timestamp ? new Date(stock.timestamp).toLocaleString() : 'on this request'}.</p><div className="stock-metric-grid">{[
      ['Market capitalization', compact(stock.market_cap)], ['Trailing P/E', number(stock.pe_ratio_trailing)], ['Trailing EPS', number(stock.eps_trailing)], ['Beta', number(stock.beta)],
      ['Revenue growth', percent(stock.revenue_growth / 100)], ['Profit margin', percent(stock.profit_margin / 100)], ['52-week high', number(stock['52_week_high'])], ['52-week low', number(stock['52_week_low'])],
    ].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></>}
    <StockPriceChart data={history} title="Daily price history" />
    <div className="research-brief"><button className="outline-button" onClick={explain} disabled={!ai || writing || !stock}><Sparkles size={16} />{writing ? 'Preparing explanation…' : 'Explain company metrics'}</button><span>{ai === 'ai' ? 'AI explanation. Check it against the figures above.' : 'The built-in analyst compares valuation and financials with peers.'}</span></div>{brief && <RichText className="brief-output" text={brief} />}
    <div style={{ marginTop: 30 }}><NewsCard articles={news} loading={newsLoading} error={newsError} source={newsSource} onRefresh={() => setNewsRefresh(value => value + 1)} /></div>
  </div>;
}
