/**
 * Mock AWS sync server for local testing.
 * Mirrors the real Lambda (infra/lambda/index.js) exactly:
 *   POST /sync        body: { items: SyncQueueItem[] }  →  { syncedIds: string[] }
 *   GET  /attendance  ?limit=N                          →  { events: AttendanceEvent[] }
 *
 * Run: node scripts/mock-sync-server.js
 * Then set constants/aws.ts → apiEndpoint to one of:
 *   Android emulator : http://10.0.2.2:3001
 *   Physical device  : http://<YOUR_LAN_IP>:3001
 */

const http = require('http');

const PORT = 3001;
const log = (msg) => console.log(`[${new Date().toISOString()}] ${msg}`);

// In-memory store — same shape as DynamoDB rows in production
const store = [];

function flattenItem(item) {
  const p = item.payload ?? {};
  const base = {
    id:        item.id,
    type:      item.type,
    createdAt: item.createdAt,
    syncedAt:  new Date().toISOString(),
  };
  if (item.type === 'VERIFICATION_EVENT') {
    return {
      ...base,
      employeeId:   p.employeeId   ?? 'unknown',
      matchedName:  p.matchedName  ?? null,
      success:      p.success      ?? false,
      livenessPass: p.livenessPass ?? false,
      matchScore:   p.matchScore   ?? 0,
      processingMs: p.processingMs ?? 0,
      timestamp:    p.timestamp    ?? item.createdAt,
    };
  }
  if (item.type === 'FACE_TEMPLATE') {
    return {
      ...base,
      employeeId:    p.employeeId ?? 'unknown',
      name:          p.name       ?? '',
      templateCount: (p.templates ?? []).length,
      timestamp:     p.createdAt  ?? item.createdAt,
    };
  }
  return base;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error('Invalid JSON')); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-api-key');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // POST /sync
  if (req.method === 'POST' && req.url === '/sync') {
    let parsed;
    try { parsed = await parseBody(req); }
    catch {
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid JSON' }));
      return;
    }

    const items = parsed.items ?? [];
    log(`POST /sync — received ${items.length} item(s)`);

    items.forEach((item, i) => {
      const flat = flattenItem(item);
      store.push(flat);
      log(`  [${i + 1}] id=${item.id} type=${item.type}`);
      if (item.type === 'VERIFICATION_EVENT') {
        const p = item.payload ?? {};
        log(`       employeeId=${p.employeeId ?? 'anon'} success=${p.success} score=${(p.matchScore ?? 0).toFixed(3)} liveness=${p.livenessPass} ms=${p.processingMs}`);
      } else if (item.type === 'FACE_TEMPLATE') {
        const p = item.payload ?? {};
        log(`       employeeId=${p.employeeId} name=${p.name} templates=${p.templates?.length ?? 0}`);
      }
    });

    const syncedIds = items.map(i => i.id);
    res.writeHead(200);
    res.end(JSON.stringify({ syncedIds }));
    log(`Responded syncedIds: [${syncedIds.join(', ')}]`);
    return;
  }

  // GET /attendance
  if (req.method === 'GET' && req.url.startsWith('/attendance')) {
    const urlObj = new URL(req.url, `http://localhost:${PORT}`);
    const limit = Math.min(parseInt(urlObj.searchParams.get('limit') ?? '100', 10), 500);

    const events = store
      .filter(e => e.type === 'VERIFICATION_EVENT')
      .sort((a, b) => (b.timestamp ?? '').localeCompare(a.timestamp ?? ''))
      .slice(0, limit);

    log(`GET /attendance — returning ${events.length} event(s) (store total: ${store.length})`);
    res.writeHead(200);
    res.end(JSON.stringify({ events }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: `No route ${req.method} ${req.url}` }));
});

server.listen(PORT, '0.0.0.0', () => {
  log(`Mock sync server listening on port ${PORT}`);
  log(`Routes:`);
  log(`  POST /sync        — receive verification events + face templates`);
  log(`  GET  /attendance  — fetch verification history (in-memory)`);
  log(`Set apiEndpoint in constants/aws.ts to:`);
  log(`  Android emulator : http://10.0.2.2:${PORT}`);
  log(`  Physical device  : http://<YOUR_LAN_IP>:${PORT}`);
});
