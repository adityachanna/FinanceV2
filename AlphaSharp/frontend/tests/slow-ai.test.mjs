import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

test('actual frontend agent service receives a response after the old 30-second limit', { timeout: 90000 }, async () => {
  const python = http.createServer((req, res) => {
    req.resume();
    setTimeout(() => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ response: 'Delayed answer', thread_id: 'timeout-test' })); }, 35000);
  });
  python.listen(0, '127.0.0.1'); await once(python, 'listening');
  process.env.PYTHON_API_URL = `http://127.0.0.1:${python.address().port}`;
  const { default: app } = await import('../../backend/src/app.js');
  const gateway = http.createServer(app); gateway.listen(0, '127.0.0.1'); await once(gateway, 'listening');
  process.env.VITE_API_URL = `http://127.0.0.1:${gateway.address().port}/api`;
  const vite = await createServer({ root: fileURLToPath(new URL('..', import.meta.url)),
    server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
  try {
    const { agentService } = await vite.ssrLoadModule('/src/services/agentService.js');
    const start = Date.now();
    const result = await agentService.queryAgent('Use only this mock', 'timeout-test');
    assert.equal(result.data.response, 'Delayed answer');
    assert.ok(Date.now()-start >= 35000);
  } finally {
    await vite.close(); gateway.closeAllConnections(); python.closeAllConnections();
    await Promise.all([new Promise(resolve => gateway.close(resolve)), new Promise(resolve => python.close(resolve))]);
  }
});
