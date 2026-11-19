import { useQuery } from '@tanstack/react-query';
import { marketService } from '../../services/marketService';
import { number, unwrap } from '../../utils/marketData';

export default function QuoteRibbon() {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['macro-pulse'], queryFn: async () => unwrap(await marketService.getMacroPulse()),
    refetchInterval: 60_000, staleTime: 45_000,
  });
  return <div className="quote-ribbon" aria-label="Cross-asset market prices">
    <span className="ribbon-title"><span className="status-dot" /> Market snapshot</span>
    {data?.instruments?.map(item => <a href="#market" key={item.ticker} title={`${item.name}: ${item.unit}. As of ${item.asOf || 'date unavailable'}`}>
      <span>{item.name}</span><strong>{number(item.price)}</strong>
      {Number.isFinite(item.change5dPct) && <span className={item.change5dPct >= 0 ? 'quote-gain' : 'quote-loss'}>{item.change5dPct >= 0 ? '+' : ''}{item.change5dPct.toFixed(2)}%<small>5d</small></span>}
    </a>)}
    {isPending && <span className="ribbon-message">Loading market prices…</span>}
    {isError && !data && <button onClick={() => refetch()}>Prices unavailable. Retry</button>}
  </div>;
}
