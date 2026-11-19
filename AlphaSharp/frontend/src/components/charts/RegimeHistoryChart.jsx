import { useEffect, useId, useMemo, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';

const periods = [[21, '1M'], [63, '3M'], [126, '6M'], [252, '1Y'], [504, '2Y']];
const valueLabel = value => Number.isFinite(value) ? value.toLocaleString('en-US', { maximumFractionDigits: 2 }) : 'Unavailable';
const dateLabel = date => new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function RegimeHistoryChart({ data, title = 'Market history', onPeriodChange, initialPeriod = 63, loading = false, instrument = 'S&P 500', marketContext = true }) {
  const [period, setPeriod] = useState(initialPeriod);
  const [metric, setMetric] = useState('spx_price');
  const [cursor, setCursor] = useState(null);
  const [revealed, setRevealed] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [regimes, setRegimes] = useState(marketContext);
  const reduced = useReducedMotion();
  const gradient = useId().replace(/:/g, '');
  const rows = useMemo(() => (data || []).filter(row => Number.isFinite(row.spx_price) && (!marketContext || Number.isFinite(row.vix))).slice(-period), [data, period, marketContext]);
  useEffect(() => { setCursor(null); setRevealed(null); setPlaying(false); }, [period, metric, rows.length, rows[0]?.date, rows.at(-1)?.date]);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setRevealed(previous => {
      return Math.min(rows.length, (previous ?? 1) + Math.max(1, Math.floor(rows.length / 80)));
    }), 90);
    return () => clearInterval(timer);
  }, [playing, rows.length]);
  useEffect(() => { if (playing && revealed >= rows.length) setPlaying(false); }, [playing, revealed, rows.length]);
  if (!rows.length) return <div className="panel empty-copy" role="status">{loading ? 'Loading market history…' : 'Market history is unavailable.'}</div>;
  const count = Math.max(1, Math.min(rows.length, revealed ?? rows.length));
  const inspected = Math.max(0, Math.min(rows.length - 1, cursor ?? count - 1));
  const current = rows[inspected];
  const values = rows.map(row => row[metric]);
  const minimum = Math.min(...values), maximum = Math.max(...values);
  const padding = (maximum - minimum || Math.abs(maximum) * .02 || 1) * .16;
  const low = minimum - padding, high = maximum + padding;
  const x = index => 14 + index / Math.max(1, rows.length - 1) * 818;
  const y = value => 245 - (value - low) / (high - low) * 223;
  const points = rows.slice(0, count).map((row, i) => `${i ? 'L' : 'M'}${x(i).toFixed(2)} ${y(row[metric]).toFixed(2)}`).join(' ');
  const change = (current[metric] / rows[0][metric] - 1) * 100;
  const color = metric === 'vix' ? '#7b6bc1' : '#16836b';
  const move = event => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const index = Math.round(((event.clientX - bounds.left) / bounds.width * 920 - 14) / 818 * (rows.length - 1));
    setCursor(Math.max(0, Math.min(count - 1, index)));
  };
  return <div className="history-chart market-history" aria-busy={loading}>
    <div className="market-chart-heading"><h3>{title}</h3><div className="history-periods" role="group" aria-label="History period">{periods.map(([days, label]) => <button key={days} type="button" aria-pressed={period === days} className={period === days ? 'active' : ''} onClick={() => { setPeriod(days); onPeriodChange?.(days); }}>{label}</button>)}</div></div>
    <div className="market-chart-readout"><div><div className="chart-metric-tabs" role="group" aria-label="Chart instrument">{(marketContext ? [['spx_price', instrument], ['vix', 'VIX']] : [['spx_price', instrument]]).map(([key, label]) => <button key={key} type="button" aria-pressed={metric === key} onClick={() => setMetric(key)}>{label}</button>)}</div><div className="chart-price"><strong>{valueLabel(current[metric])}</strong><span className={change >= 0 ? 'quote-gain' : 'quote-loss'}>{change >= 0 ? '+' : ''}{change.toFixed(2)}%<small>from period start</small></span></div></div><div className="chart-observation"><time dateTime={current.date}>{dateLabel(current.date)}</time>{marketContext && <span style={{ color: current.regime_color }}><i style={{ background: current.regime_color }} />{current.regime_label}</span>}</div></div>
    <div className="market-chart-plot" onPointerLeave={() => setCursor(null)}>
      <svg viewBox="0 0 920 280" preserveAspectRatio="none" onPointerMove={move} onPointerDown={move} role="img" aria-label={`${metric === 'vix' ? 'VIX' : instrument} daily closing history. Use the session slider below to inspect prices.`}>
        <defs><linearGradient id={gradient} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".13" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
        {[0, 1, 2, 3].map(i => { const value = low + (high - low) * i / 3; return <g key={i}><line x1="14" x2="832" y1={y(value)} y2={y(value)} stroke="#eaf0ed" strokeDasharray="3 6" /><text x="848" y={y(value) + 4} fill="#7b8985" fontSize="11">{valueLabel(value)}</text></g>; })}
        {regimes && rows.slice(0, count).map((row, i) => <rect key={row.date} x={Math.max(14, x(i) - 818 / rows.length / 2)} y="22" width={818 / rows.length + .5} height="223" fill={row.regime_color || '#81969b'} opacity=".035" />)}
        <path d={`${points}L${x(count - 1)} 245L14 245Z`} fill={`url(#${gradient})`} />
        <path key={`${period}-${metric}-${rows.at(-1).date}`} className={!reduced ? 'chart-draw' : ''} d={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" pathLength="1" />
        <line x1={x(inspected)} x2={x(inspected)} y1="18" y2="245" stroke="#9eafa7" strokeDasharray="3 5" opacity={cursor !== null || playing ? 1 : 0} />
        <circle cx={x(inspected)} cy={y(current[metric])} r="8" fill={color} opacity=".12" /><circle cx={x(inspected)} cy={y(current[metric])} r="3.8" fill={color} stroke="white" strokeWidth="2" />
        {[0, .25, .5, .75, 1].map(fraction => { const i = Math.round((rows.length - 1) * fraction); return <text key={fraction} x={x(i)} y="271" textAnchor={fraction === 0 ? 'start' : fraction === 1 ? 'end' : 'middle'} fill="#87938e" fontSize="11">{rows[i].date.slice(5)}</text>; })}
      </svg>
    </div>
    <div className="market-chart-tools"><button type="button" className="chart-play" aria-label={playing ? 'Pause historical playback' : 'Play historical prices'} onClick={() => { if (playing) setPlaying(false); else { setCursor(null); setRevealed(1); setPlaying(true); } }}>{playing ? <Pause size={15} /> : <Play size={15} />}<span>{playing ? 'Pause' : 'Replay'}</span></button><label className="chart-scrubber"><span className="sr-only">Inspect trading session</span><input type="range" min="0" max={Math.max(1, rows.length - 1)} value={inspected} aria-valuetext={`${current.date}: ${valueLabel(current[metric])}, ${current.regime_label || instrument}`} onChange={event => { const i = Number(event.target.value); setPlaying(false); setRevealed(i + 1); setCursor(null); }} /></label><button type="button" className="chart-latest" onClick={() => { setPlaying(false); setRevealed(null); setCursor(null); }} aria-label="Show all observations" title="Show all observations"><RotateCcw size={14} /><span>Latest</span></button></div>
    <div className="market-chart-footer">{marketContext ? <label><input type="checkbox" checked={regimes} onChange={event => setRegimes(event.target.checked)} /> Show market regimes</label> : <span>Daily closing prices</span>}<span>{playing ? 'Historical playback' : `${rows.length} daily closes`}<i />{loading ? 'Refreshing…' : `As of ${rows.at(-1).date}`}</span></div>
    {regimes && <div className="history-regime-track" aria-label="Historical market regimes">{rows.map(row => <span key={row.date} style={{ background: row.regime_color || '#81969b' }} title={`${row.date}: ${row.regime_label}`} />)}</div>}
  </div>;
}
