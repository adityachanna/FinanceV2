import RichText from '../components/common/RichText';
import { useEffect, useState } from 'react';
import { Area, ComposedChart, CartesianGrid, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Download, RefreshCw, Sparkles, Eye } from 'lucide-react';
import { researchService } from '../services/researchService';
import { agentService } from '../services/agentService';
import { number, percent, unwrap } from '../utils/marketData';

const horizons = [[1, '1 session'], [5, '1 week'], [21, '1 month']];
function exportJson(value, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Fan({ snapshot }) {
  const rows = [{ session: 0, median: 0, outer: [0, 0], inner: [0, 0], actual: 0 }, ...snapshot.fan.map(row => ({
    session: row.session, median: row.median * 100, outer: [row.p05 * 100, row.p95 * 100],
    inner: [row.p25 * 100, row.p75 * 100], actual: snapshot.outcome?.path.find(item => item.session === row.session)?.return * 100,
  }))];
  return <div className="risk-fan"><ResponsiveContainer width="100%" height={300}><ComposedChart data={rows} margin={{ top: 16, right: 14, bottom: 5, left: 4 }}>
    <CartesianGrid vertical={false} stroke="#e1e9eb" /><XAxis dataKey="session" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} /><YAxis tickFormatter={value => `${value.toFixed(0)}%`} tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11 }} />
    <Tooltip formatter={(value, name) => [Array.isArray(value) ? value.map(item => `${item.toFixed(2)}%`).join(' to ') : `${value?.toFixed(2)}%`, name]} labelFormatter={value => `Session ${value}`} />
    <ReferenceLine y={0} stroke="#80959e" strokeDasharray="4 4" />
    <Area dataKey="outer" name="90% scenario range" stroke="none" fill="#c7e3e0" fillOpacity={.65} isAnimationActive={false} />
    <Area dataKey="inner" name="50% scenario range" stroke="none" fill="#80bbb4" fillOpacity={.45} isAnimationActive={false} />
    <Line dataKey="median" name="Median scenario" stroke="#087f83" strokeWidth={2.5} dot={false} isAnimationActive={false} />
    {snapshot.outcome && <Line dataKey="actual" name="Observed outcome" stroke="#b76a35" strokeWidth={2.5} dot={false} isAnimationActive={false} />}
  </ComposedChart></ResponsiveContainer><div className="chart-caption"><span><i className="fan-key" /> 90% and 50% scenario ranges</span><span>Trading sessions after {snapshot.as_of}</span></div></div>;
}

export default function RiskLabPage() {
  const [tab, setTab] = useState('risk');
  const [horizon, setHorizon] = useState(21);
  const [asOf, setAsOf] = useState('2020-02-20');
  const [reveal, setReveal] = useState(false);
  const [exposure, setExposure] = useState(10000);
  const [snapshot, setSnapshot] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [aiEnabled, setAiEnabled] = useState('built-in');
  const [brief, setBrief] = useState('');
  const [writing, setWriting] = useState(false);

  useEffect(() => { agentService.getStatus().then(result => setAiEnabled(unwrap(result)?.configured ? 'ai' : 'built-in')).catch(() => {}); }, []);
  useEffect(() => {
    let active = true;
    setError(''); setLoading(true); setBrief('');
    if (tab !== 'evaluation') setSnapshot(null);
    const request = tab === 'evaluation' ? researchService.evaluation() : tab === 'replay' ? researchService.replay(asOf, horizon, reveal) : researchService.snapshot(horizon);
    request.then(result => { if (active) { const data = unwrap(result); if (tab === 'evaluation') setEvaluation(data); else setSnapshot(data); } })
      .catch(caught => { if (active) setError(caught.response?.data?.message || 'Market research could not be loaded. Try refreshing.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [tab, horizon, asOf, reveal, refresh]);
  const selectDate = value => { setReveal(false); setAsOf(value); };
  const explain = async () => {
    setWriting(true);
    try { setBrief(unwrap(await researchService.brief(snapshot)).brief); }
    catch (caught) { setBrief(caught.response?.data?.message || 'The explanation could not be generated.'); }
    finally { setWriting(false); }
  };

  return <div className="workspace-page risk-workspace">
    <div className="workspace-intro"><div><h1>Risk lab</h1><p>Explore market uncertainty, replay past forecasts, and inspect the evidence.</p></div><button className="outline-button" onClick={() => setRefresh(value => value + 1)} disabled={loading}><RefreshCw size={16} /> Refresh</button></div>
    <div className="research-tabs" role="tablist" aria-label="Research views">{[['risk', 'Scenarios'], ['replay', 'Historical replay'], ['evaluation', 'Model evaluation']].map(([id, label]) => <button key={id} role="tab" aria-selected={tab === id} onClick={() => { setTab(id); setReveal(false); }}>{label}</button>)}</div>
    {tab !== 'evaluation' && <div className="research-controls"><div className="history-periods" role="group" aria-label="Scenario horizon">{horizons.map(([days, label]) => <button key={days} className={horizon === days ? 'active' : ''} aria-pressed={horizon === days} onClick={() => { setReveal(false); setHorizon(days); }}>{label}</button>)}</div>
      {tab === 'risk' ? <label className="inline-field">Exposure in USD <input type="number" min="0" max="100000000" value={exposure} onChange={event => setExposure(Math.max(0, Math.min(100000000, Number(event.target.value))))} /></label> : <label className="inline-field">Observation date <input type="date" value={asOf} min="2007-01-01" max="2025-12-31" onChange={event => selectDate(event.target.value)} required /></label>}
    </div>}
    {tab === 'replay' && <div className="replay-presets"><span>Explore a period</span>{[['2008-09-15', 'Financial crisis'], ['2020-02-20', 'Before COVID sell-off'], ['2022-01-03', '2022 tightening']].map(([date, label]) => <button key={date} onClick={() => selectDate(date)}>{label}</button>)}</div>}
    {error && <div className="notice" role="alert">{error}</div>}
    {loading && <div className="panel empty-copy" role="status">Loading {tab === 'evaluation' ? 'evaluation results' : 'market snapshot'}…</div>}
    {!loading && snapshot && tab !== 'evaluation' && <>
      <div className="snapshot-heading"><div><span className="state-badge" style={{ '--state-color': snapshot.state.color }}>{snapshot.state.label}</span><h2>S&P 500 risk over {snapshot.horizon} trading {snapshot.horizon === 1 ? 'session' : 'sessions'}</h2><p>Observation {snapshot.as_of}. Model trained through {snapshot.training_end}.</p></div><button className="quiet-button" onClick={() => exportJson(snapshot, `alphasharp-${snapshot.as_of}.json`)}><Download size={16} /> Export data</button></div>
      <div className="risk-layout"><section className="risk-chart-panel"><Fan snapshot={snapshot} /><p className="method-note">Ranges describe simulated outcomes. Their historical coverage is available in Model evaluation.</p>{snapshot.reference && <p className="method-note">EWMA reference range: {percent(snapshot.reference.p05)} to {percent(snapshot.reference.p95)}. This simpler method had lower interval scores in the historical evaluation.</p>}</section><aside className="probability-panel"><h3>State probabilities</h3>{snapshot.states.map(state => <div className="state-probability" key={state.id}><div><span>{state.label}</span><strong>{percent(state.probability)}</strong></div><meter min="0" max="1" value={state.probability} style={{ accentColor: state.color }}>{percent(state.probability)}</meter></div>)}<dl><div><dt>Estimated current state age</dt><dd>{snapshot.state.estimated_age} sessions</dd></div><div><dt>Chance of switching next session</dt><dd>{percent(snapshot.switch_probability_next_session)}</dd></div><div><dt>VIX close</dt><dd>{number(snapshot.market.vix)}</dd></div></dl><p>Probabilities describe the fitted model. They are not classification accuracy.</p></aside></div>
      <div className="risk-metrics"><article><span>Probability of loss</span><strong>{percent(snapshot.risk.probability_loss)}</strong><small>Any negative terminal return</small></article><article><span>Probability of a 5% decline</span><strong>{percent(snapshot.risk.probability_decline_5pct)}</strong><small>Loss of at least 5% at the horizon</small></article><article><span>95% value at risk</span><strong>{percent(snapshot.risk.var_95)}</strong><small>{tab === 'risk' ? `$${number(exposure * snapshot.risk.var_95)} on this exposure` : '95th percentile of simulated loss'}</small></article><article><span>Expected shortfall</span><strong>{percent(snapshot.risk.expected_shortfall_95)}</strong><small>Mean loss within the worst 5% of scenarios</small></article></div>
      {tab === 'replay' && <section className="panel replay-result"><div className="panel-heading"><div><h3>What happened next?</h3><p>The scenario uses an earlier model and observations through {snapshot.as_of}.</p></div><button className="outline-button" onClick={() => setReveal(value => !value)}><Eye size={16} />{reveal ? 'Hide outcome' : 'Reveal outcome'}</button></div>{snapshot.outcome && <p className="outcome-number">Observed return <strong>{percent(snapshot.outcome.return, 2)}</strong> through {snapshot.outcome.date}</p>}{reveal && !snapshot.outcome && <p>The full outcome is not available yet.</p>}{snapshot.comparisons?.length > 0 && <div className="table-scroll"><table className="research-table"><thead><tr><th>Method</th><th>5th percentile</th><th>Median</th><th>95th percentile</th>{reveal && <th>Outcome in range</th>}</tr></thead><tbody>{snapshot.comparisons.map(row => <tr key={row.method}><td>{row.method}</td><td>{percent(row.q05, 2)}</td><td>{percent(row.median, 2)}</td><td>{percent(row.q95, 2)}</td>{reveal && <td>{row.covered ? 'Yes' : 'No'}</td>}</tr>)}</tbody></table></div>}</section>}
      <details className="method-details"><summary>How to read these estimates</summary><p>The model has three Gaussian market states and explicit negative-binomial regime durations. Scenarios integrate uncertainty about the current state and its elapsed age. The Gaussian return assumption can miss extreme tails. VaR is a loss percentile, not a maximum possible loss. Expected shortfall averages the worst simulated losses.</p><p>Source: {snapshot.source}. S&P 500 price returns exclude dividends. Snapshot {snapshot.snapshot_id}. Model {snapshot.model_id}.</p></details>
      <div className="research-brief"><button className="outline-button" disabled={!aiEnabled || writing} onClick={explain}><Sparkles size={16} />{writing ? 'Preparing explanation…' : 'Explain this snapshot'}</button><span>{aiEnabled === 'ai' ? 'Uses the displayed snapshot and its model version.' : 'The built-in analyst summarises the displayed snapshot.'}</span></div>{brief && <RichText className="brief-output" text={brief} />}
    </>}
    {!loading && tab === 'evaluation' && evaluation && <Evaluation value={evaluation} />}
  </div>;
}

function Evaluation({ value }) {
  const [horizon, setHorizon] = useState(21);
  if (value.status !== 'complete') return <div className="notice">{value.message}</div>;
  const rows = value.overall.filter(row => row.horizon === horizon);
  const hsmm = rows.find(row => row.method === 'HSMM');
  const hmm = rows.find(row => row.method === 'HMM');
  return <section><div className="section-heading"><div><h2>Measured performance</h2><p>Annual walk-forward forecasts, 2007–2025. Every model was fitted before its forecast dates.</p></div><button className="outline-button" onClick={() => exportJson(value, 'alphasharp-evaluation.json')}><Download size={16} /> Export results</button></div><div className="history-periods">{horizons.map(([days, label]) => <button key={days} className={days === horizon ? 'active' : ''} onClick={() => setHorizon(days)}>{label}</button>)}</div>
    {hsmm && hmm && <div className="notice evaluation-verdict">At this horizon, the HSMM has {hsmm.interval_score < hmm.interval_score ? 'a lower' : 'a higher'} mean interval score than the matched HMM. Lower scores are better. Coverage and width must be considered together.</div>}
    <div className="table-scroll"><table className="research-table"><thead><tr><th>Method</th><th>Forecasts</th><th>90% coverage</th><th>Mean range width</th><th>Interval score ↓</th><th>VaR breaches</th><th>Loss Brier score ↓</th></tr></thead><tbody>{rows.map(row => <tr key={row.method} className={row.method === 'HSMM' ? 'highlight-row' : ''}><td>{row.method}</td><td>{row.observations.toLocaleString()}</td><td>{percent(row.coverage)}</td><td>{percent(row.width)}</td><td>{row.interval_score.toFixed(4)}</td><td>{percent(row.breach_rate)}</td><td>{row.brier.toFixed(4)}</td></tr>)}</tbody></table></div>
    <div className="evaluation-notes"><div><h3>What the comparison tests</h3><p>The HMM uses the same inputs and Gaussian emissions. The HSMM models regime duration explicitly. The age-reset version tests what is lost by ignoring elapsed age. Gaussian and EWMA forecasts are simpler reference methods.</p></div><div><h3>What it does not establish</h3><p>Coverage is an observed frequency, not a guarantee. There are no ground-truth market-state labels. The experiment uses revised vendor history, and overlapping forecast horizons are dependent.</p></div></div>
    <details className="method-details"><summary>State-level results and uncertainty</summary>{Object.entries(value.by_state).map(([state, metrics]) => <div key={state}><h3>{state}</h3>{metrics.filter(row => row.horizon === horizon && row.method === 'HSMM').map(row => <p key={row.method}>{row.observations} forecasts. Coverage {percent(row.coverage)}. Interval score {row.interval_score.toFixed(4)}.</p>)}</div>)}<p>Paired 63-session block-bootstrap interval-score differences against HMM: {value.paired_interval_score.filter(row => row.horizon === horizon && row.baseline === 'HMM').map(row => `${row.hsmm_minus_baseline.toFixed(4)}, 95% interval ${row.block_bootstrap_95.map(value => value.toFixed(5)).join(' to ')}`)}. Negative differences favor HSMM.</p></details>
    <details className="method-details"><summary>Market data verification and configuration</summary><p>VIX was checked against <a href="https://www.cboe.com/tradable-products/vix/vix-historical-data" target="_blank" rel="noreferrer">Cboe historical data</a>. S&P 500 was checked against <a href="https://fred.stlouisfed.org/series/SP500" target="_blank" rel="noreferrer">FRED</a>. Provider discrepancies are retained in the exported verification record.</p><pre>{JSON.stringify({ configuration: value.configuration, verification: value.data_verification }, null, 2)}</pre></details>
  </section>;
}
