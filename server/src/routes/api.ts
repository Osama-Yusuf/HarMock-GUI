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
        const data = await (req as any).file?.();
        const file = data ? await (data as any) : await (req as any).file();
        if (!file) return reply.code(400).send({ error: 'no-file' });
        const buf = await file.toBuffer();
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
        const { mockId } = (req.params as any);
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
        const { mockId } = (req.params as any);
        const mock = store.mocks.get(mockId);
        if (!mock) return reply.code(404).send({ error: 'mock-not-found' });
        const body = (req.body as Partial<{ mode: Mode; simulateDelay: boolean }>);
        if (body.mode) mock.mode = body.mode;
        if (typeof body.simulateDelay === 'boolean') mock.simulateDelay = body.simulateDelay;
        return { ok: true };
    });

    // List entries by path/method
    f.get('/api/mocks/:mockId/entries', (req, reply) => {
        const { mockId } = (req.params as any);
        const mock = store.mocks.get(mockId);
        if (!mock) return reply.code(404).send({ error: 'mock-not-found' });
        const { path, method, status } = ((req.query || {}) as any);
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
        const { mockId, entryId } = (req.params as any);
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
        const { mockId } = (req.params as any);
        const mock = store.mocks.get(mockId);
        if (!mock) return reply.code(404).send({ error: 'mock-not-found' });
        const body = (req.body as any);
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
        const { suiteId } = (req.params as any);
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

