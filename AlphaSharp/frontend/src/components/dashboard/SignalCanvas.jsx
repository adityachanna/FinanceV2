import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { marketService } from '../../services/marketService';
import RegimeHistoryChart from '../charts/RegimeHistoryChart';
import { percent, unwrap } from '../../utils/marketData';

const descriptions = [
  'Lower realized and implied volatility relative to the other fitted states.',
  'A more unsettled environment, between the lower-volatility and stress states.',
  'Higher volatility and wider modeled return distributions. This is not a prediction of a falling market.',
];

export default function SignalCanvas() {
  const [period, setPeriod] = useState(126);
  const [selected, setSelected] = useState(null);
  const { data, isPending, isFetching, isError, refetch } = useQuery({
    queryKey: ['landing-market', period],
    queryFn: async () => {
      const [condition, history] = await Promise.all([marketService.getMarketCondition(), marketService.getRegimeHistory(period)]);
      return { condition: unwrap(condition), history: unwrap(history)?.history || [] };
    },
    placeholderData: previous => previous, staleTime: 45_000, refetchInterval: 60_000,
  });
  const condition = data?.condition;
  const state = condition?.regime;
  const inspected = condition?.states?.find(item => item.id === (selected ?? state?.id));
  return <section className="landing-market page-container" id="market">
    <div className="landing-section-heading"><div><h2>The market, with context.</h2><p>Follow the price. See how the market environment changes around it.</p></div><button type="button" className="landing-refresh" disabled={isFetching} onClick={() => refetch()}><RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} /> Refresh data</button></div>
    {isError && <div className="notice" role="alert">Market data could not be refreshed. <button className="quiet-button" onClick={() => refetch()}>Try again</button></div>}
    <div className="landing-market-grid"><RegimeHistoryChart title="S&P 500 market history" data={data?.history} initialPeriod={period} onPeriodChange={setPeriod} loading={isPending || isFetching} /><aside className="landing-regime">
      <div className="regime-current"><span className="status-dot" /> Current market regime</div><h3 style={{ color: state?.color }}>{state?.label || (isPending ? 'Reading the market…' : 'Unavailable')}</h3><p>Three environments. A different perspective on the same market.</p>
      <div className="landing-state-bars" aria-label="Explore model states">{condition?.states?.map(item => <button key={item.id} type="button" className={inspected?.id === item.id ? 'is-selected' : ''} aria-pressed={inspected?.id === item.id} onClick={() => setSelected(item.id)}><span>{item.label}<strong>{percent(item.probability)}</strong></span><span className="state-bar-track"><i style={{ width: `${item.probability * 100}%`, background: item.color }} /></span></button>)}</div>
      {inspected && <div className="landing-state-detail"><strong>{inspected.label}</strong><p>{descriptions[inspected.id]}</p></div>}
      <div className="regime-source"><span>Observation {condition?.date || 'unavailable'}</span><p>Model probabilities, not classification accuracy. Daily closing data, refreshed every minute while this page is active.</p></div>
    </aside></div>
  </section>;
}
