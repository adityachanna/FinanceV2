import RichText from '../common/RichText';
import { useEffect, useState } from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { marketService } from '../../services/marketService';
import { agentService } from '../../services/agentService';

const unwrap = (response) => response?.data ?? response;
const pct = (value) => typeof value === 'number' ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%` : '—';
const price = (value) => typeof value === 'number' ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'Unavailable';

export default function MacroPulse() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [pulse, setPulse] = useState(null);
  const [regime, setRegime] = useState(null);
  const [brief, setBrief] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [aiEnabled, setAiEnabled] = useState('built-in');

  useEffect(() => {
    let active = true;
    Promise.allSettled([marketService.getMacroPulse(), marketService.getMarketCondition(), agentService.getStatus()]).then(([pulseResult, regimeResult, aiResult]) => {
      if (!active) return;
      if (pulseResult.status === 'fulfilled') setPulse(unwrap(pulseResult.value));
      else setError('Cross-asset prices are unavailable. Check the Express data service.');
      if (regimeResult.status === 'fulfilled') setRegime(unwrap(regimeResult.value));
      if (aiResult.status === 'fulfilled') setAiEnabled(unwrap(aiResult.value)?.configured ? 'ai' : 'built-in');
    });
    return () => { active = false; };
  }, [refreshKey]);

  const explain = async () => {
    if (!pulse || !regime || !aiEnabled) return;
    setBusy(true);
    try { setBrief(unwrap(await agentService.queryMarketBrief(pulse, regime, []))?.brief || 'No explanation returned.'); }
    catch { setBrief('The brief could not be written. The market figures above are unaffected; try again in a moment.'); }
    finally { setBusy(false); }
  };

  return <section className="macro-section"><div className="section-heading"><div><p className="section-kicker">Market instruments</p><h2>Macro pulse</h2></div><p>Daily equities, volatility and commodities, with an observation date for each instrument.</p></div>{error && <div className="notice">{error}</div>}<div className="macro-grid">{(pulse?.instruments || [null, null, null, null]).map((item, index) => <article className="macro-card" key={item?.ticker || index}><div className="macro-card-top"><span>{item?.name || 'Loading market…'}</span><ArrowUpRight size={17} /></div><div className="macro-value">{item ? price(item.price) : '—'}</div><div className="macro-unit">{item?.unit || 'Market data'}{item?.asOf ? ` · ${item.asOf}` : ''}</div><div className="macro-changes"><span>5 days <strong className={item?.change5dPct >= 0 ? 'positive' : 'negative'}>{pct(item?.change5dPct)}</strong></span><span>1 month <strong className={item?.change1mPct >= 0 ? 'positive' : 'negative'}>{pct(item?.change1mPct)}</strong></span></div></article>)}</div><div className="macro-footer"><span>Yahoo Finance · Gold and crude are context, not HSMM inputs.</span><button className="outline-button" onClick={() => setRefreshKey(value => value + 1)}>Refresh prices</button><button type="button" className="outline-button" onClick={explain} disabled={!aiEnabled || !pulse || !regime || busy}><Sparkles size={16} />{busy ? 'Writing brief…' : 'Explain these signals'}</button></div>{aiEnabled !== 'ai' && <p className="ai-note">Written by the built-in analyst from these figures. Add an OpenRouter key for an AI-written brief.</p>}{brief && <RichText className="brief-output" text={brief} />}</section>;
}

