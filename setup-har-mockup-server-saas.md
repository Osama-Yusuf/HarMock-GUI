# har-mock-mvp

A minimal, local-only Harmock MVP.

```
.
├── README.md
├── package.json
├── tsconfig.base.json
├── scripts/
│   └── suite-runner.ts
├── server/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts
│       ├── store.ts
│       ├── types.ts
│       ├── routes/
│       │   ├── api.ts
│       │   └── mock.ts
│       ├── utils/
│       │   ├── har.ts
│       │   ├── match.ts
│       │   └── redact.ts
│       └── test/
│           └── utils.test.ts
└── web/
    ├── index.html
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api.ts
        ├── components/
        │   ├── Upload.tsx
        │   ├── MockDetails.tsx
        │   ├── EntryTable.tsx
        │   ├── EntryInspector.tsx
        │   └── SuitePanel.tsx
        └── styles.css
```

---

## package.json (root)

```json
{
  "name": "har-mock-mvp",
  "private": true,
  "workspaces": ["server", "web"],
  "scripts": {
    "dev": "concurrently -k \"npm:dev:server\" \"npm:dev:web\"",
    "dev:server": "cross-env DEV_PROXY=1 node --loader ts-node/esm server/src/index.ts",
    "dev:web": "npm -w web run dev",
    "build": "npm -w web run build && npm -w server run build",
    "start": "node server/dist/index.js",
    "test": "npm -w server run test",
    "suite": "tsx scripts/suite-runner.ts"
  },
  "devDependencies": {
    "concurrently": "^9.0.1",
    "cross-env": "^7.0.3",
    "tsx": "^4.19.2",
    "ts-node": "^10.9.2",
    "typescript": "^5.5.4"
  }
}
```

## tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"]
  }
}
```

---

## server/package.json

```json
{
  "name": "server",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@fastify/cors": "^10.0.1",
    "@fastify/http-proxy": "^9.3.0",
    "@fastify/multipart": "^9.0.1",
    "@fastify/static": "^7.0.4",
    "fastify": "^4.28.1",
    "jsonpath-plus": "^10.3.0",
    "mime": "^4.0.4"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  }
}
```

## server/tsconfig.json

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src/**/*"]
}
```

## server/src/types.ts

```ts
export type Mode = 'sequence' | 'endpoint';

export interface MockEntry {
  id: string;
  orderIdx: number;
  method: string;
  url: string;
  path: string;
  query: Record<string, string[]>; // raw
  querySorted: string; // canonical a=1&b=2
  queryRelaxedKeys: Record<string, string[]>; // without volatile keys
  headerFp: string; // content-type, accept, authorization if present
  reqHeaders: Record<string, string>; // scrubbed
  reqBodyHash: string | null; // sha256 for <1MB
  reqBodyOriginal?: Buffer | null; // not served
  reqBodyScrubbed?: Buffer | null;
  status: number;
  respHeaders: Record<string, string>; // scrubbed
  respBodyOriginal?: Buffer | null; // not served
  respBodyScrubbed?: Buffer | null;
  contentType?: string;
  waitMs?: number; // captured wait timing
}

export interface SuiteAssertion {
  jsonPath?: string; // e.g. $.user.id
  equals?: unknown;
}

export interface SuiteItem {
  entryId: string;
  method: string;
  path: string;
  query?: Record<string, string[]>;
  headers?: Record<string, string>;
  body?: unknown;
  expectStatus: number;
  assertions?: SuiteAssertion[];
  ignorePaths?: string[]; // jsonpaths to ignore in diff
}

export interface Suite {
  id: string;
  name: string;
  mockId: string;
  items: SuiteItem[];
  createdAt: number;
}

export interface Mock {
  id: string;
  mode: Mode;
  simulateDelay: boolean;
  createdAt: number;
  entries: MockEntry[];
  // sequence session pointer per session id → next index to scan from
  sessions: Map<string, number>;
}
```

## server/src/store.ts

```ts
import type { Mock, Suite } from './types.js';

export const store = {
  mocks: new Map<string, Mock>(),
  suites: new Map<string, Suite>()
};
```

## server/src/utils/redact.ts

```ts
const SENSITIVE_HEADER_SET = new Set(['cookie', 'authorization', 'set-cookie']);
const REDACT_RE = /^(password|token|email|phone|card|cvv|ssn)$/i;

export function dropSensitiveHeaders(h: Record<string, string | string[] | undefined>) {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(h || {})) {
    const key = k.toLowerCase();
    if (SENSITIVE_HEADER_SET.has(key)) continue;
    if (v == null) continue;
    out[key] = Array.isArray(v) ? v.join(', ') : String(v);
  }
  return out;
}

export function redactJson(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(redactJson);
  const out: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACT_RE.test(k)) {
      out[k] = 'REDACTED';
    } else if (v && typeof v === 'object') {
      out[k] = redactJson(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

export function maybeRedactBody(contentType: string | undefined, buf: Buffer | null): Buffer | null {
  if (!buf) return buf;
  const ct = (contentType || '').toLowerCase();
  if (!ct.includes('application/json')) return buf; // only redact JSON
  try {
    const parsed = JSON.parse(buf.toString('utf8'));
    const red = redactJson(parsed);
    return Buffer.from(JSON.stringify(red));
  } catch {
    return buf; // leave untouched if not valid JSON
  }
}
```

## server/src/utils/match.ts

```ts
import crypto from 'node:crypto';

const VOLATILE_KEYS = new Set(['_t', 'cache', 'cachebust', 'cb']);

export function normalizeQuery(obj: Record<string, string[] | string | undefined>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(obj || {})) {
    const key = k.toLowerCase();
    if (v == null) continue;
    const arr = Array.isArray(v) ? v.map(String) : [String(v)];
    out[key] = arr.sort();
  }
  return Object.fromEntries(Object.entries(out).sort((a, b) => a[0].localeCompare(b[0])));
}

export function canonicalQueryString(q: Record<string, string[]>): string {
  return Object.entries(q)
    .map(([k, vs]) => vs.map(v => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&'))
    .join('&');
}

export function relaxedQuery(q: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, vs] of Object.entries(q)) {
    if (VOLATILE_KEYS.has(k)) continue;
    out[k] = vs;
  }
  return out;
}

export function headerFingerprint(h: Record<string, string>): string {
  const keys = ['content-type', 'accept', 'authorization'];
  const parts: string[] = [];
  for (const k of keys) {
    if (h[k]) parts.push(`${k}:${h[k].toLowerCase()}`);
  }
  return parts.join('|');
}

export function hashBody(buf: Buffer | null): string | null {
  if (!buf) return null;
  if (buf.byteLength > 1024 * 1024) return null; // only small bodies
  return crypto.createHash('sha256').update(buf).digest('hex');
}

export type Tier = 'Exact' | 'Relaxed' | 'PathOnly';

export interface MatchCandidate<T> { entry: T; tier: Tier; }

export function chooseBestMatch<T extends { orderIdx: number }>(cands: MatchCandidate<T>[]): T | null {
  if (!cands.length) return null;
  const rank = { Exact: 0, Relaxed: 1, PathOnly: 2 } as const;
  cands.sort((a, b) => {
    const r = rank[a.tier] - rank[b.tier];
    if (r !== 0) return r;
    return a.entry.orderIdx - b.entry.orderIdx;
  });
  return cands[0].entry;
}
```

## server/src/utils/har.ts

```ts
import { dropSensitiveHeaders, maybeRedactBody } from './redact.js';
import { canonicalQueryString, hashBody, headerFingerprint, normalizeQuery, relaxedQuery } from './match.js';
import type { MockEntry } from '../types.js';

interface HarLogEntry {
  startedDateTime: string;
  request: {
    method: string;
    url: string;
    headers: { name: string; value: string }[];
    postData?: { mimeType?: string; text?: string; encoding?: string };
    queryString?: { name: string; value: string }[];
  };
  response: {
    status: number;
    headers: { name: string; value: string }[];
    content?: { mimeType?: string; text?: string; encoding?: string };
  };
  timings?: { wait?: number };
}

export function parseHar(buffer: Buffer): MockEntry[] {
  const json = JSON.parse(buffer.toString('utf8'));
  const entries: HarLogEntry[] = json.log?.entries || [];
  let idx = 0;
  const out: MockEntry[] = entries.map((e) => {
    const urlObj = new URL(e.request.url);
    const path = urlObj.pathname;
    const rawQuery: Record<string, string[]> = {};
    for (const [k, v] of urlObj.searchParams.entries()) {
      const key = k.toLowerCase();
      rawQuery[key] = rawQuery[key] || [];
      rawQuery[key].push(v);
    }
    const reqHeadersRaw: Record<string, string> = Object.fromEntries((e.request.headers || []).map(h => [h.name.toLowerCase(), h.value]));
    const respHeadersRaw: Record<string, string> = Object.fromEntries((e.response.headers || []).map(h => [h.name.toLowerCase(), h.value]));

    const reqHeaders = dropSensitiveHeaders(reqHeadersRaw);
    const respHeadersScrubbed = dropSensitiveHeaders(respHeadersRaw);

    const contentTypeReq = reqHeadersRaw['content-type'];
    const contentTypeResp = respHeadersRaw['content-type'];

    const reqBodyBuf = readBody(e.request.postData);
    const respBodyBuf = readBody(e.response.content);

    const reqBodyScrub = maybeRedactBody(contentTypeReq, reqBodyBuf);
    const respBodyScrub = maybeRedactBody(contentTypeResp, respBodyBuf);

    const qNorm = normalizeQuery(rawQuery);
    const relaxed = relaxedQuery(qNorm);
    const entry: MockEntry = {
      id: `e_${idx}`,
      orderIdx: idx++,
      method: e.request.method.toUpperCase(),
      url: e.request.url,
      path,
      query: qNorm,
      querySorted: canonicalQueryString(qNorm),
      queryRelaxedKeys: relaxed,
      headerFp: headerFingerprint(reqHeaders),
      reqHeaders,
      reqBodyHash: hashBody(reqBodyScrub),
      reqBodyOriginal: reqBodyBuf,
      reqBodyScrubbed: reqBodyScrub,
      status: e.response.status,
      respHeaders: respHeadersScrubbed,
      respBodyOriginal: respBodyBuf,
      respBodyScrubbed: respBodyScrub,
      contentType: contentTypeResp,
      waitMs: e.timings?.wait && e.timings.wait > 0 ? Math.floor(e.timings.wait) : undefined
    };
    return entry;
  });
  return out;
}

function readBody(part?: { mimeType?: string; text?: string; encoding?: string } | null): Buffer | null {
  if (!part || !part.text) return null;
  if (part.encoding === 'base64') return Buffer.from(part.text, 'base64');
  return Buffer.from(part.text, 'utf8');
}
```

## server/src/routes/api.ts

```ts
import { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { store } from '../store.js';
import { parseHar } from '../utils/har.js';
import type { Mode, Suite } from '../types.js';
import { randomUUID } from 'node:crypto';

export async function apiRoutes(f: FastifyInstance) {
  await f.register(multipart);

  // Upload HAR → create mock
  f.post('/api/mocks', async (req, reply) => {
    const data = await req.file();
    if (!data) return reply.code(400).send({ error: 'no-file' });
    const buf = await data.toBuffer();
    try {
      const entries = parseHar(buf);
      const id = `mock_${randomUUID().slice(0, 8)}`;
      store.mocks.set(id, {
        id,
        mode: 'endpoint',
        simulateDelay: false,
        createdAt: Date.now(),
        entries,
        sessions: new Map()
      });
      return { mockId: id };
    } catch (e: any) {
      return reply.code(400).send({ error: 'invalid-har', detail: e?.message });
    }
  });

  // Mock metadata
  f.get('/api/mocks/:mockId', (req, reply) => {
    const { mockId } = req.params as any;
    const mock = store.mocks.get(mockId);
    if (!mock) return reply.code(404).send({ error: 'mock-not-found' });
    const endpoints = summarizeEndpoints(mock.entries);
    return {
      id: mock.id,
      mode: mock.mode,
      simulateDelay: mock.simulateDelay,
      createdAt: mock.createdAt,
      counts: { entries: mock.entries.length, endpoints: endpoints.length },
      endpoints
    };
  });

  // Toggle mode/delay
  f.patch('/api/mocks/:mockId', async (req, reply) => {
    const { mockId } = req.params as any;
    const mock = store.mocks.get(mockId);
    if (!mock) return reply.code(404).send({ error: 'mock-not-found' });
    const body = req.body as Partial<{ mode: Mode; simulateDelay: boolean }>;
    if (body.mode) mock.mode = body.mode;
    if (typeof body.simulateDelay === 'boolean') mock.simulateDelay = body.simulateDelay;
    return { ok: true };
  });

  // List entries by path/method
  f.get('/api/mocks/:mockId/entries', (req, reply) => {
    const { mockId } = req.params as any;
    const mock = store.mocks.get(mockId);
    if (!mock) return reply.code(404).send({ error: 'mock-not-found' });
    const { path, method, status } = (req.query || {}) as any;
    const list = mock.entries.filter(e => (!path || e.path === path) && (!method || e.method === String(method).toUpperCase()) && (!status || e.status === Number(status)));
    return list.map(e => ({
      id: e.id,
      orderIdx: e.orderIdx,
      method: e.method,
      path: e.path,
      status: e.status,
      contentType: e.contentType,
      curl: exampleCurl(mock.id, e)
    }));
  });

  // Entry preview
  f.get('/api/mocks/:mockId/entries/:entryId', (req, reply) => {
    const { mockId, entryId } = req.params as any;
    const mock = store.mocks.get(mockId);
    if (!mock) return reply.code(404).send({ error: 'mock-not-found' });
    const e = mock.entries.find(x => x.id === entryId);
    if (!e) return reply.code(404).send({ error: 'entry-not-found' });
    return {
      id: e.id,
      orderIdx: e.orderIdx,
      method: e.method,
      path: e.path,
      query: e.query,
      headerFp: e.headerFp,
      reqHeaders: e.reqHeaders,
      reqBody: e.reqBodyScrubbed ? safeBodyPreview(e.reqBodyScrubbed, e.reqHeaders['content-type']) : null,
      status: e.status,
      respHeaders: e.respHeaders,
      respBody: e.respBodyScrubbed ? safeBodyPreview(e.respBodyScrubbed, e.contentType) : null
    };
  });

  // Suites
  f.post('/api/mocks/:mockId/suites', async (req, reply) => {
    const { mockId } = req.params as any;
    const mock = store.mocks.get(mockId);
    if (!mock) return reply.code(404).send({ error: 'mock-not-found' });
    const body = req.body as any;
    const name = body?.name || 'Suite';
    const ids: string[] = body?.entryIds || [];
    const items = mock.entries
      .filter(e => ids.includes(e.id))
      .map(e => ({
        entryId: e.id,
        method: e.method,
        path: e.path,
        query: e.query,
        headers: { 'content-type': e.reqHeaders['content-type'] || undefined },
        body: e.reqBodyScrubbed ? parseMaybeJson(e.reqHeaders['content-type'], e.reqBodyScrubbed) : undefined,
        expectStatus: e.status,
        assertions: body?.assertions || [],
        ignorePaths: body?.ignorePaths || []
      }));
    const id = `suite_${randomUUID().slice(0, 8)}`;
    const suite: Suite = { id, name, mockId, items, createdAt: Date.now() };
    store.suites.set(id, suite);
    return { suiteId: id };
  });

  f.get('/api/mocks/:mockId/suites/:suiteId', (req, reply) => {
    const { suiteId } = req.params as any;
    const suite = store.suites.get(suiteId);
    if (!suite) return reply.code(404).send({ error: 'suite-not-found' });
    return suite;
  });
}

function summarizeEndpoints(entries: any[]) {
  const map = new Map<string, { method: string; path: string; count: number; statuses: number[] }>();
  for (const e of entries) {
    const key = `${e.method} ${e.path}`;
    const v = map.get(key) || { method: e.method, path: e.path, count: 0, statuses: [] };
    v.count++; v.statuses.push(e.status);
    map.set(key, v);
  }
  return Array.from(map.values()).map(v => ({
    method: v.method,
    path: v.path,
    count: v.count,
    minStatus: Math.min(...v.statuses),
    avgStatus: Math.round(v.statuses.reduce((a, b) => a + b, 0) / v.statuses.length),
    maxStatus: Math.max(...v.statuses)
  }));
}

function safeBodyPreview(buf: Buffer, ct?: string) {
  const isJson = (ct || '').toLowerCase().includes('application/json');
  const limit = 1024 * 64; // 64KB preview
  const slice = buf.byteLength > limit ? buf.subarray(0, limit) : buf;
  return {
    contentType: ct,
    size: buf.byteLength,
    truncated: buf.byteLength > limit,
    text: isJson ? slice.toString('utf8') : undefined,
    base64: isJson ? undefined : slice.toString('base64')
  };
}

function exampleCurl(mockId: string, e: any) {
  const q = e.querySorted ? `?${e.querySorted}` : '';
  const body = e.reqBodyScrubbed ? `\\\n  --data '${e.reqBodyScrubbed.toString('utf8').replace(/'/g, "'\\''")}'` : '';
  const ct = e.reqHeaders['content-type'] ? `\\\n  -H 'Content-Type: ${e.reqHeaders['content-type']}'` : '';
  return `curl -i -X ${e.method} 'http://localhost:3000/m/${mockId}${e.path}${q}'${ct}${body}`;
}

function parseMaybeJson(ct: string | undefined, buf: Buffer): any {
  if (!ct || !ct.toLowerCase().includes('application/json')) return undefined;
  try { return JSON.parse(buf.toString('utf8')); } catch { return undefined; }
}
```

## server/src/routes/mock.ts

```ts
import { FastifyInstance } from 'fastify';
import { store } from '../store.js';
import { chooseBestMatch, canonicalQueryString, headerFingerprint, normalizeQuery, relaxedQuery, type MatchCandidate } from '../utils/match.js';
import type { MockEntry } from '../types.js';
import { setTimeout as sleep } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';

export async function mockRoutes(f: FastifyInstance) {
  f.all('/m/:mockId/*', async (req, reply) => {
    const { mockId } = req.params as any;
    const mock = store.mocks.get(mockId);
    if (!mock) return reply.code(404).send({ error: 'mock-not-found' });

    const url = new URL(req.url, `http://localhost`);
    const path = '/' + (req.params as any)['*'];
    const method = req.method.toUpperCase();

    const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(', ') : String(v || '')]));
    const fp = headerFingerprint(headers);

    const bodyBuf = req.body && typeof req.body === 'object' && Buffer.isBuffer((req.body as any))
      ? (req.body as Buffer)
      : Buffer.isBuffer((req.body as any))
        ? (req.body as Buffer)
        : undefined; // Fastify gives parsed body, we match without hash here for simplicity

    const qNorm = normalizeQuery(Object.fromEntries(url.searchParams.entries()));
    const qCanon = canonicalQueryString(qNorm);
    const qRelax = relaxedQuery(qNorm);

    let entry: MockEntry | null = null;

    if (mock.mode === 'sequence') {
      let session = (req.headers['x-mock-session'] as string) || '';
      if (!session) {
        session = randomUUID();
        reply.header('X-Mock-Session', session);
      }
      const startIdx = mock.sessions.get(session) ?? 0;
      // Scan forward to find the next matching entry
      for (let i = startIdx; i < mock.entries.length; i++) {
        const e = mock.entries[i];
        if (isMatch(method, path, qCanon, qRelax, fp, e)) { entry = e; mock.sessions.set(session, i + 1); break; }
      }
      if (!entry) return reply.code(404).send({ error: 'out-of-sequence' });
    } else {
      const cands: MatchCandidate<MockEntry>[] = [];
      for (const e of mock.entries) {
        if (e.method !== method || e.path !== path) continue;
        if (e.querySorted === qCanon && e.headerFp === fp) cands.push({ entry: e, tier: 'Exact' });
        else if (subsetQuery(e.queryRelaxedKeys, qRelax)) cands.push({ entry: e, tier: 'Relaxed' });
        else cands.push({ entry: e, tier: 'PathOnly' });
      }
      entry = chooseBestMatch(cands);
      if (!entry) return reply.code(404).send({ error: 'no-match' });
    }

    if (mock.simulateDelay && entry.waitMs && entry.waitMs > 0) {
      await sleep(entry.waitMs);
    }

    const headersOut = { ...entry.respHeaders };
    // Never set sensitive headers
    delete headersOut['set-cookie'];
    if (entry.contentType) headersOut['content-type'] = entry.contentType;

    reply.code(entry.status);
    for (const [k, v] of Object.entries(headersOut)) reply.header(k, v);

    if (entry.respBodyScrubbed) {
      return reply.send(entry.respBodyScrubbed);
    }
    return reply.send();
  });
}

function isMatch(method: string, path: string, qCanon: string, qRelax: Record<string, string[]>, fp: string, e: MockEntry): boolean {
  if (e.method !== method || e.path !== path) return false;
  if (e.querySorted === qCanon && e.headerFp === fp) return true;
  if (subsetQuery(e.queryRelaxedKeys, qRelax)) return true;
  return true; // path-only fallback
}

function subsetQuery(a: Record<string, string[]>, b: Record<string, string[]>): boolean {
  // return true if a ⊆ b
  for (const [k, vs] of Object.entries(a)) {
    const bv = b[k] || [];
    for (const v of vs) if (!bv.includes(v)) return false;
  }
  return true;
}
```

## server/src/index.ts

```ts
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import fastifyProxy from '@fastify/http-proxy';
import { apiRoutes } from './routes/api.js';
import { mockRoutes } from './routes/mock.js';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = Fastify({ logger: false, bodyLimit: 50 * 1024 * 1024 });
await app.register(cors, { origin: true, exposedHeaders: ['x-mock-session'] });

await apiRoutes(app);
await mockRoutes(app);

// Frontend: in dev proxy Vite, in prod serve static build
const DEV = process.env.DEV_PROXY === '1';
if (DEV) {
  await app.register(fastifyProxy, { upstream: 'http://127.0.0.1:5173', prefix: '/', http2: false, websocket: false, rewritePrefix: '/' });
} else {
  const dist = path.resolve(__dirname, '../../web/dist');
  await app.register(fastifyStatic, { root: dist, index: ['index.html'] });
  app.get('/*', (_req, reply) => reply.sendFile('index.html'));
}

const port = Number(process.env.PORT || 3000);
app.listen({ port, host: '0.0.0.0' }).then(() => {
  console.log(`Server on http://localhost:${port}`);
});
```

## server/src/test/utils.test.ts

```ts
import { describe, it, expect } from 'vitest';
import { normalizeQuery, canonicalQueryString, relaxedQuery, headerFingerprint, chooseBestMatch } from '../utils/match.js';
import { redactJson } from '../utils/redact.js';

describe('normalizeQuery', () => {
  it('sorts keys and values', () => {
    const q = normalizeQuery({ b: ['2', '1'], a: 'x' });
    expect(Object.keys(q)).toEqual(['a', 'b']);
    expect(q.b).toEqual(['1', '2']);
    expect(canonicalQueryString(q)).toBe('a=x&b=1&b=2');
  });
});

describe('relaxedQuery', () => {
  it('drops volatile keys', () => {
    const q = relaxedQuery({ a: ['1'], _t: ['9'], cache: ['y'] });
    expect(q).toEqual({ a: ['1'] });
  });
});

describe('headerFingerprint', () => {
  it('select headers', () => {
    const fp = headerFingerprint({ 'content-type': 'Application/JSON', accept: 'application/json', other: 'x' } as any);
    expect(fp).toContain('content-type:application/json');
    expect(fp).toContain('accept:application/json');
    expect(fp).not.toContain('other');
  });
});

describe('chooseBestMatch', () => {
  it('ranks by specificity then orderIdx', () => {
    const e = chooseBestMatch([
      { tier: 'PathOnly', entry: { orderIdx: 2 } },
      { tier: 'Exact', entry: { orderIdx: 5 } },
      { tier: 'Relaxed', entry: { orderIdx: 1 } }
    ]);
    expect(e?.orderIdx).toBe(5);
  });
});

describe('redactJson', () => {
  it('redacts sensitive keys recurisvely', () => {
    const out = redactJson({ a: 1, token: 'abc', nested: { Email: 'x@y.com' } });
    expect(out.token).toBe('REDACTED');
    expect(out.nested.Email).toBe('REDACTED');
  });
});
```

---

## web/package.json

```json
{
  "name": "web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.5.4",
    "vite": "^5.4.2"
  }
}
```

## web/tsconfig.json

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

## web/index.html

```html
<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>HAR → Mock</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

## web/src/main.tsx

```tsx
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles.css'

createRoot(document.getElementById('root')!).render(<App />)
```

## web/src/api.ts

```ts
export async function uploadHar(file: File) {
  const fd = new FormData();
  fd.append('file', file);
  const r = await fetch('/api/mocks', { method: 'POST', body: fd });
  if (!r.ok) throw new Error('upload failed');
  return r.json() as Promise<{ mockId: string }>;
}

export async function getMock(id: string) {
  const r = await fetch(`/api/mocks/${id}`);
  if (!r.ok) throw new Error('not found');
  return r.json();
}

export async function setMock(id: string, body: any) {
  const r = await fetch(`/api/mocks/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('update failed');
}

export async function listEntries(id: string, params: Record<string, string> = {}) {
  const qs = new URLSearchParams(params).toString();
  const r = await fetch(`/api/mocks/${id}/entries${qs ? '?' + qs : ''}`);
  if (!r.ok) throw new Error('failed');
  return r.json();
}

export async function getEntry(id: string, entryId: string) {
  const r = await fetch(`/api/mocks/${id}/entries/${entryId}`);
  if (!r.ok) throw new Error('failed');
  return r.json();
}

export async function createSuite(id: string, body: any) {
  const r = await fetch(`/api/mocks/${id}/suites`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error('failed');
  return r.json();
}

export async function getSuite(id: string, suiteId: string) {
  const r = await fetch(`/api/mocks/${id}/suites/${suiteId}`);
  if (!r.ok) throw new Error('failed');
  return r.json();
}
```

## web/src/App.tsx

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { createSuite, getEntry, getMock, listEntries, setMock, uploadHar } from './api';
import Upload from './components/Upload';
import MockDetails from './components/MockDetails';
import EntryTable from './components/EntryTable';
import EntryInspector from './components/EntryInspector';
import SuitePanel from './components/SuitePanel';

export default function App() {
  const [mockId, setMockId] = useState<string | null>(null);
  const [mock, setMockData] = useState<any | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [filters, setFilters] = useState<{method?: string; status?: string}>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => { if (mockId) refresh(); }, [mockId]);
  useEffect(() => { if (mockId) loadEntries(); }, [mockId, filters]);

  async function refresh(){ if (!mockId) return; setMockData(await getMock(mockId)); }
  async function loadEntries(){ if (!mockId) return; setEntries(await listEntries(mockId, filters as any)); }
  async function onUpload(file: File){ const { mockId } = await uploadHar(file); setMockId(mockId); }
  async function onToggleMode(mode: 'sequence'|'endpoint'){ if (!mockId) return; await setMock(mockId, { mode }); await refresh(); }
  async function onToggleDelay(simulateDelay: boolean){ if (!mockId) return; await setMock(mockId, { simulateDelay }); await refresh(); }
  async function onSelectEntry(id: string){ if (!mockId) return; setSelectedEntry(await getEntry(mockId, id)); }

  async function onCreateSuite(name: string){ if (!mockId) return; const { suiteId } = await createSuite(mockId, { name, entryIds: selectedIds }); const suite = await (await fetch(`/api/mocks/${mockId}/suites/${suiteId}`)).json();
    const blob = new Blob([JSON.stringify(suite, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name || 'suite'}.json`; a.click();
  }

  return (
    <div className="container">
      <h1>Harmock</h1>
      {!mockId && <Upload onUpload={onUpload} />}
      {mock && (
        <>
          <MockDetails mock={mock} onToggleMode={onToggleMode} onToggleDelay={onToggleDelay} />
          <EntryTable entries={entries} filters={filters} setFilters={setFilters} selectedIds={selectedIds} setSelectedIds={setSelectedIds} onSelect={onSelectEntry} mockId={mock.id} />
          <div className="panes">
            <EntryInspector entry={selectedEntry} />
            <SuitePanel onCreate={onCreateSuite} selectedCount={selectedIds.length} />
          </div>
        </>
      )}
    </div>
  );
}
```

## web/src/components/Upload.tsx

```tsx
import React, { useCallback } from 'react';

export default function Upload({ onUpload }: { onUpload: (f: File)=>void }){
  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onUpload(f);
  }, [onUpload]);
  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) onUpload(f);
  }, [onUpload]);
  return (
    <div className="upload" onDrop={onDrop} onDragOver={e=>e.preventDefault()}>
      <p>Drag & drop a .har file or choose</p>
      <input type="file" accept=".har,application/json" onChange={onChange} />
    </div>
  );
}
```

## web/src/components/MockDetails.tsx

```tsx
import React from 'react';

export default function MockDetails({ mock, onToggleMode, onToggleDelay }: any){
  const root = `${location.origin}/m/${mock.id}`;
  return (
    <div className="card">
      <div className="row">
        <div>
          <div><b>Mock ID:</b> {mock.id}</div>
          <div><b>Root:</b> <code>{root}</code></div>
          <div><b>Counts:</b> {mock.counts.entries} entries, {mock.counts.endpoints} endpoints</div>
        </div>
        <div className="controls">
          <label>
            Mode:
            <select value={mock.mode} onChange={e=>onToggleMode(e.target.value as any)}>
              <option value="endpoint">endpoint</option>
              <option value="sequence">sequence</option>
            </select>
          </label>
          <label>
            Delay:
            <input type="checkbox" checked={mock.simulateDelay} onChange={e=>onToggleDelay(e.target.checked)} />
          </label>
        </div>
      </div>
      <div className="endpoints">
        <table>
          <thead><tr><th>Method</th><th>Path</th><th>Count</th><th>Status min/avg/max</th></tr></thead>
          <tbody>
            {mock.endpoints.map((e: any) => (
              <tr key={`${e.method}-${e.path}`}>
                <td><code>{e.method}</code></td>
                <td><code>{e.path}</code></td>
                <td>{e.count}</td>
                <td>{e.minStatus}/{e.avgStatus}/{e.maxStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="hint">Example curl will appear per entry.</div>
    </div>
  );
}
```

## web/src/components/EntryTable.tsx

```tsx
import React from 'react';

export default function EntryTable({ entries, filters, setFilters, selectedIds, setSelectedIds, onSelect, mockId }: any){
  function toggle(id: string){
    if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter((x:string)=>x!==id));
    else setSelectedIds([...selectedIds, id]);
  }
  return (
    <div className="card">
      <div className="row">
        <label>Method <input value={filters.method||''} onChange={e=>setFilters({ ...filters, method: e.target.value })} placeholder="GET" /></label>
        <label>Status <input value={filters.status||''} onChange={e=>setFilters({ ...filters, status: e.target.value })} placeholder="200" /></label>
      </div>
      <table>
        <thead><tr><th></th><th>#</th><th>Method</th><th>Path</th><th>Status</th><th>Curl</th></tr></thead>
        <tbody>
          {entries.map((e:any) => (
            <tr key={e.id}>
              <td><input type="checkbox" checked={selectedIds.includes(e.id)} onChange={()=>toggle(e.id)} /></td>
              <td>{e.orderIdx}</td>
              <td><code>{e.method}</code></td>
              <td><button className="link" onClick={()=>onSelect(e.id)}>{e.path}</button></td>
              <td>{e.status}</td>
              <td><button onClick={()=>navigator.clipboard.writeText(e.curl)}>Copy curl</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## web/src/components/EntryInspector.tsx

```tsx
import React from 'react';

export default function EntryInspector({ entry }: any){
  if (!entry) return <div className="card"><i>Select an entry</i></div>;
  return (
    <div className="card">
      <h3>Entry #{entry.orderIdx}</h3>
      <div className="grid2">
        <section>
          <h4>Request</h4>
          <pre>{JSON.stringify({ method: entry.method, path: entry.path, headers: entry.reqHeaders, body: entry.reqBody?.text?.slice?.(0, 2000) ?? entry.reqBody }, null, 2)}</pre>
        </section>
        <section>
          <h4>Response</h4>
          <pre>{JSON.stringify({ status: entry.status, headers: entry.respHeaders, body: entry.respBody?.text?.slice?.(0, 2000) ?? entry.respBody }, null, 2)}</pre>
        </section>
      </div>
    </div>
  );
}
```

## web/src/components/SuitePanel.tsx

```tsx
import React, { useState } from 'react';

export default function SuitePanel({ onCreate, selectedCount }: { onCreate: (name: string)=>void; selectedCount: number }){
  const [name, setName] = useState('regression-suite');
  return (
    <div className="card">
      <h3>Create Suite</h3>
      <div className="row">
        <input value={name} onChange={e=>setName(e.target.value)} />
        <button disabled={!selectedCount} onClick={()=>onCreate(name)}>Download suite.json ({selectedCount} items)</button>
      </div>
      <p className="hint">Run: <code>npm run suite -- --target http://localhost:3000 --suite ./suite.json</code></p>
    </div>
  );
}
```

## web/src/styles.css

```css
:root { font-family: ui-sans-serif, system-ui, Arial; color-scheme: light dark; }
body { margin: 0; padding: 0 16px 48px; }
.container { max-width: 1100px; margin: 0 auto; }
.row { display: flex; gap: 12px; align-items: center; justify-content: space-between; }
.card { border: 1px solid #ccc; border-radius: 8px; padding: 12px; margin: 12px 0; }
.upload { border: 2px dashed #aaa; padding: 24px; text-align: center; }
.endpoints { overflow: auto; }
.panes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
pre { background: #1112; padding: 8px; border-radius: 6px; overflow: auto; max-height: 300px; }
code { background: #1112; padding: 1px 4px; border-radius: 4px; }
button { padding: 6px 10px; }
button.link { background: none; border: none; color: #06c; cursor: pointer; padding: 0; }
.hint { color: #666; font-size: 12px; }
```

---

## scripts/suite-runner.ts

```ts
#!/usr/bin/env tsx
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { JSONPath } from 'jsonpath-plus';

interface Options { target: string; suite: string; }

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const out: any = {};
  for (let i = 0; i < args.length; i += 2) {
    const k = args[i]; const v = args[i + 1];
    if (k === '--target') out.target = v;
    if (k === '--suite') out.suite = v;
  }
  if (!out.target || !out.suite) {
    console.error('Usage: npm run suite -- --target http://localhost:3000 --suite ./suite.json');
    process.exit(2);
  }
  return out as Options;
}

function mask(obj: any, ignore: string[] = []) {
  if (!ignore.length) return obj;
  const clone = JSON.parse(JSON.stringify(obj));
  for (const jp of ignore) {
    const res = JSONPath({ path: jp, json: clone, resultType: 'all' }) as any[];
    for (const r of res) {
      const parent = r.parent; const key = r.parentProperty;
      if (parent && key != null) parent[key] = '__IGNORED__';
    }
  }
  return clone;
}

function toJUnit(xmlName: string, cases: { name: string; ok: boolean; message?: string }[]) {
  const failures = cases.filter(c => !c.ok);
  return `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n` +
    `<testsuite name=\"${xmlName}\" tests=\"${cases.length}\" failures=\"${failures.length}\">` +
    cases.map(c => c.ok ? `<testcase name=\"${c.name}\"/>` : `<testcase name=\"${c.name}\"><failure><![CDATA[${c.message}]]></failure></testcase>`).join('') +
    `</testsuite>`;
}

(async () => {
  const { target, suite } = parseArgs();
  const raw = fs.readFileSync(suite, 'utf8');
  const s = JSON.parse(raw);
  const results: { name: string; ok: boolean; message?: string }[] = [];

  for (const item of s.items) {
    const url = new URL(item.path + (item.query ? '?' + new URLSearchParams(Object.entries(item.query).flatMap(([k, vs]) => vs.map((v: string) => [k, v]))) : ''), target);
    const name = `${item.method} ${url.pathname}`;

    const res = await fetch(url, { method: item.method, headers: item.headers || { 'content-type': 'application/json' }, body: item.body ? JSON.stringify(item.body) : undefined });
    const text = await res.text();
    let body: any; try { body = JSON.parse(text); } catch { body = text; }

    let ok = true; let message = '';
    if (res.status !== item.expectStatus) { ok = false; message += `Status ${res.status} != ${item.expectStatus}\n`; }

    if (item.assertions && Array.isArray(item.assertions)) {
      for (const a of item.assertions) {
        if (!a.jsonPath) continue;
        const vals = JSONPath({ path: a.jsonPath, json: body });
        if (a.equals !== undefined) {
          if (vals.length === 0 || JSON.stringify(vals[0]) !== JSON.stringify(a.equals)) {
            ok = false; message += `Assert ${a.jsonPath} expected ${JSON.stringify(a.equals)} got ${JSON.stringify(vals[0])}\n`;
          }
        }
      }
    }

    if (!ok && typeof body === 'object') {
      const masked = mask(body, item.ignorePaths || []);
      message += `Body:\n${JSON.stringify(masked, null, 2)}\n`;
    }

    results.push({ name, ok, message: ok ? undefined : message });
    const status = ok ? 'OK' : 'FAIL';
    console.log(`[${status}] ${name}`);
  }

  const junit = toJUnit('har-mock-suite', results);
  fs.writeFileSync('suite-report.xml', junit);

  const failed = results.filter(r => !r.ok).length;
  if (failed) { console.error(`Failures: ${failed}`); process.exit(1); }
  console.log('All tests passed');
})();
```

---

## README.md

````md
# Harmock MVP

Local-only, single-repo, no auth, no DB. Upload a HAR and get a mock API at `/m/{mockId}`. Two modes: sequence and endpoint. Delay simulation optional. Suites runner included.

## Run

```bash
# dev (server on :3000, Vite on :5173, backend proxies frontend)
npm install
npm run dev
# open http://localhost:3000

# prod
npm run build
npm run start
# open http://localhost:3000
````

## Use

1. Upload a `.har` file on the page.
2. Copy the Mock Root URL and try an endpoint via the example curl.
3. Toggle mode and delay as needed.
4. Select entries → Create Suite → downloads `suite.json`.
5. Run the suite against any target base URL:

```bash
npm run suite -- --target http://localhost:3000 --suite ./suite.json
```

A JUnit report writes to `./suite-report.xml`.

## API

* `POST /api/mocks` (multipart file) → `{ mockId }`
* `GET /api/mocks/:mockId`
* `PATCH /api/mocks/:mockId` `{ mode, simulateDelay }`
* `GET /api/mocks/:mockId/entries?path=&method=&status=`
* `GET /api/mocks/:mockId/entries/:entryId`
* `POST /api/mocks/:mockId/suites` `{ name, entryIds }` → `{ suiteId }`
* `GET /api/mocks/:mockId/suites/:suiteId`
* `ALL /m/:mockId/*` replay

## Matching

* Tier 1 Exact: method + path + exact normalized query + header fingerprint
* Tier 2 Relaxed: ignores volatile query keys (`_t, cache, cacheBust, cb`) and allows subset
* Tier 3 Path-only
* Winner = highest tier, then smallest `orderIdx`.

## Redaction

* Drop headers: `cookie, authorization, set-cookie`.
* JSON bodies: redact keys by `/password|token|email|phone|card|cvv|ssn/i` → `"REDACTED"`.
* Only scrubbed versions are served.

## Tests

```bash
npm -w server run test
```

## Notes

* Binary bodies are replayed; preview uses base64 in UI when non-JSON.
* In sequence mode the server issues `X-Mock-Session` if missing and advances per session.
* For HARs with non-API assets, sequence mode may 404 out-of-sequence if requests are skipped.

```
```
