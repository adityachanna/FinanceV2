export const unwrap = response => response?.data ?? response;
export const percent = (value, digits = 1) => Number.isFinite(value) ? `${(value * 100).toFixed(digits)}%` : 'Unavailable';
export const number = value => Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'Unavailable';
// Large amounts as 5.08T / 312.4B / 14.2M; the API reports company values in their own currency.
export const compact = value => {
  if (!Number.isFinite(value)) return 'Unavailable';
  const abs = Math.abs(value);
  for (const [size, suffix] of [[1e12, 'T'], [1e9, 'B'], [1e6, 'M']]) if (abs >= size) return `${(value / size).toFixed(2)}${suffix}`;
  return number(value);
};
export function stateCatalog(condition) {
  return (condition?.states || []).map(state => ({ ...state, id: state.id ?? state.state_id }));
}
export function normalizeHistory(response) {
  const data = unwrap(response);
  const rows = Array.isArray(data) ? data : data?.historical_data || data?.history || [];
  return rows.map(row => ({ ...row, price: row.price ?? row.close })).filter(row => Number.isFinite(row.price));
}
export function quoteData(response) { return unwrap(response); }
