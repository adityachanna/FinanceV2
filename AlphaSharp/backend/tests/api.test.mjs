import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';

test('gateway preserves research snapshots, error status, and stock history shapes', async () => {
  const python = http.createServer((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url.includes('bad-date')) { res.writeHead(400); res.end(JSON.stringify({ detail: 'Invalid observation date' })); return; }
    if (req.url.startsWith('/api/research/snapshot')) {
      res.end(JSON.stringify({ snapshot_id: 'test', states: [{ id: 0, label: 'Low volatility' }], training_end: '2020-01-01' }));
    } else if (req.url.startsWith('/api/research/evaluation')) {
      res.end(JSON.stringify({ status: 'complete', overall: [] }));
    } else res.end(JSON.stringify({ response: 'Mock answer' }));
  });
  python.listen(0, '127.0.0.1'); await once(python, 'listening');
  process.env.PYTHON_API_URL = `http://127.0.0.1:${python.address().port}`;
  const { default: app } = await import('../src/app.js');
  const gateway = http.createServer(app); gateway.listen(0, '127.0.0.1'); await once(gateway, 'listening');
  const base = `http://127.0.0.1:${gateway.address().port}`;
  try {
    const result = await (await fetch(`${base}/api/research/snapshot?horizon=21`)).json();
    assert.equal(result.success, true); assert.equal(result.data.snapshot_id, 'test');
    assert.equal(result.data.states[0].label, 'Low volatility');
    const bad = await fetch(`${base}/api/research/snapshot?as_of=bad-date`);
    assert.equal(bad.status, 400); assert.equal((await bad.json()).message, 'Invalid observation date');
    const evaluation = await (await fetch(`${base}/api/research/evaluation`)).json();
    assert.equal(evaluation.data.status, 'complete');
  } finally {
    gateway.closeAllConnections(); python.closeAllConnections();
    await Promise.all([new Promise(resolve => gateway.close(resolve)), new Promise(resolve => python.close(resolve))]);
  }
});
