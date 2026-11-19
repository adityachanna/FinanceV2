import { useMemo } from 'react';
import RegimeHistoryChart from './RegimeHistoryChart';

export default function StockPriceChart({ data, title = 'Daily price history' }) {
  const observations = useMemo(() => (data || []).map(row => ({ ...row, spx_price: row.price })), [data]);
  return <RegimeHistoryChart data={observations} title={title} instrument="Company price" marketContext={false} initialPeriod={63} />;
}
