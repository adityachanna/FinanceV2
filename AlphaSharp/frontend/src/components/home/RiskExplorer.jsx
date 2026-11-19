import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import { researchService } from '../../services/researchService';
import { percent, unwrap } from '../../utils/marketData';

const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

export default function RiskExplorer({ action }) {
  const [horizon, setHorizon] = useState(21);
  const [exposure, setExposure] = useState(10000);
  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['risk-snapshot', horizon], queryFn: async () => unwrap(await researchService.snapshot(horizon)), staleTime: 60_000,
  });
  const terminal = data?.fan?.at(-1);
  return <section className="landing-risk" id="risk"><div className="page-container landing-risk-layout">
    <div className="landing-section-copy"><h2>See what risk<br />means for you.</h2><p>A percentage only tells half the story. Adjust your exposure to see the model’s downside estimate in dollars.</p><a className="landing-text-action" href={action}>Open the risk lab <ArrowUpRight size={17} /></a><div className="risk-explainer"><span className="mini-distribution"><i /><i /><i /><i /><i /><i /><i /></span><p>2,000 simulated paths.<br />A range of possibilities.</p></div></div>
    <div className="exposure-calculator" aria-busy={isFetching}>
      <div className="calculator-top"><h3>Your S&amp;P 500 exposure</h3><span>USD</span></div>
      <div className="exposure-input"><span>$</span><input aria-label="Market exposure in USD" type="number" min="1000" max="100000" step="500" value={exposure} onChange={event => setExposure(Math.max(1000, Math.min(100000, Number(event.target.value) || 1000)))} /></div>
      <label className="exposure-slider"><span className="sr-only">Adjust market exposure</span><input type="range" min="1000" max="100000" step="500" value={exposure} aria-valuetext={money(exposure)} onChange={event => setExposure(Number(event.target.value))} style={{ '--range-progress': `${(exposure - 1000) / 99000 * 100}%` }} /></label>
      <div className="slider-endpoints"><span>$1,000</span><span>$100,000</span></div>
      <div className="calculator-horizon"><span>Time horizon</span><div className="landing-segments" role="group" aria-label="Risk preview horizon">{[[1, '1 day'], [5, '1 week'], [21, '1 month']].map(([days, label]) => <button key={days} type="button" aria-pressed={horizon === days} onClick={() => setHorizon(days)}>{label}</button>)}</div></div>
      {isPending && <div className="calculator-loading" role="status">Calculating scenarios…</div>}
      {isError && <div className="calculator-loading" role="alert">Risk estimates are unavailable. <button className="quiet-button" onClick={() => refetch()}><RefreshCw size={14} /> Retry</button></div>}
      {data && <>
        <div className="downside-estimate"><span>95% value at risk <small>over {horizon} trading {horizon === 1 ? 'session' : 'sessions'}</small></span><strong>{money(exposure * data.risk.var_95)}</strong><p>{percent(data.risk.probability_loss)} model probability of a loss</p></div>
        <div className="scenario-range"><div><span>5th percentile</span><span>95th percentile</span></div><div className="scenario-range-track"><i title={`Median terminal value: ${money(exposure * (1 + terminal.median))}`} style={{ left: `${Math.max(0, Math.min(100, (terminal.median - terminal.p05) / (terminal.p95 - terminal.p05 || 1) * 100))}%` }} /></div><div><strong>{money(exposure * (1 + terminal.p05))}</strong><strong>{money(exposure * (1 + terminal.p95))}</strong></div><p>Simulated terminal value of your exposure</p></div>
        <p className="calculator-date">Daily close {data.as_of}. {data.state.label}.</p>
      </>}
      <p className="calculator-disclosure">Model estimate, not a maximum loss. Actual outcomes can fall outside this range.</p>
    </div>
  </div></section>;
}
