import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeHistory, stateCatalog, quoteData } from '../src/utils/marketData.js';

test('chart accepts both gateway envelopes and daily close arrays', () => {
  assert.equal(normalizeHistory({ data: [{ date: '2020-01-01', close: 12 }] })[0].price, 12);
  assert.equal(normalizeHistory({ data: { historical_data: [{ price: 10 }] } })[0].price, 10);
  assert.equal(normalizeHistory({ data: [{ close: null }] }).length, 0);
});
test('state labels come from the model rather than a numeric ID assumption', () => {
  const states = stateCatalog({ states: [{ state_id: 0, label: 'Correction' }] });
  assert.equal(states[0].id, 0);
  assert.equal(states[0].label, 'Correction');
});
test('quote envelope preserves a real zero instead of substituting entry cost', () => {
  assert.equal(quoteData({ success: true, data: { price: 0 } }).price, 0);
});
