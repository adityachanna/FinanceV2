const KEY = 'user_watchlists';
const read = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; }
};
const write = (value) => localStorage.setItem(KEY, JSON.stringify(value));
const ensureDefault = () => {
  const lists = read();
  if (lists.length) return lists;
  const initial = [{ id: 'local-default', name: 'My Watchlist', isDefault: true, stocks: [] }];
  write(initial);
  return initial;
};

export const watchlistService = {
  async getWatchlists() { return ensureDefault(); },
  async createWatchlist(name, stocks = [], isDefault = false) {
    const lists = ensureDefault();
    const next = { id: `local-${Date.now()}`, name, stocks, isDefault };
    if (isDefault) lists.forEach((list) => { list.isDefault = false; });
    lists.push(next); write(lists); return next;
  },
  async getWatchlist(id) { return ensureDefault().find((list) => list.id === id) || null; },
  async updateWatchlist(id, data) {
    const lists = ensureDefault();
    const index = lists.findIndex((list) => list.id === id);
    if (index < 0) throw new Error('Watchlist not found');
    lists[index] = { ...lists[index], ...data };
    write(lists); return lists[index];
  },
  async deleteWatchlist(id) { write(ensureDefault().filter((list) => list.id !== id)); return { success: true }; },
  async addStock(watchlistId, ticker, notes = '') {
    const lists = ensureDefault();
    const list = lists.find((item) => item.id === watchlistId) || lists[0];
    if (!list.stocks.some((stock) => stock.ticker === ticker.toUpperCase())) {
      list.stocks.push({ ticker: ticker.toUpperCase(), notes, addedAt: new Date().toISOString() });
    }
    write(lists); return list;
  },
  async removeStock(watchlistId, ticker) {
    const lists = ensureDefault();
    const list = lists.find((item) => item.id === watchlistId) || lists[0];
    list.stocks = list.stocks.filter((stock) => stock.ticker !== ticker.toUpperCase());
    write(lists); return list;
  },
  async getWatchlistWithData(id) { return this.getWatchlist(id); },
};
