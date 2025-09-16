import multipart from '@fastify/multipart';
import { store } from '../store.js';
import { parseHar } from '../utils/har.js';
import { randomUUID } from 'node:crypto';
export async function apiRoutes(f) {
    await f.register(multipart);
    // Upload HAR → create mock
    f.post('/api/mocks', async (req, reply) => {
        const data = await req.file?.();
        const file = data ? await data : await req.file();
        if (!file)
            return reply.code(400).send({ error: 'no-file' });
        const buf = await file.toBuffer();
        try {
            const entries = parseHar(buf);
            const id = `mock_${randomUUID().slice(0, 8)}`;
            store.mocks.set(id, {
                id,
                mode: 'endpoint',
                bodyMode: 'scrubbed',
                simulateDelay: false,
                createdAt: Date.now(),
                entries,
                sessions: new Map()
            });
            return { mockId: id };
        }
        catch (e) {
            return reply.code(400).send({ error: 'invalid-har', detail: e?.message });
        }
    });
    // Mock metadata
    f.get('/api/mocks/:mockId', (req, reply) => {
        const { mockId } = req.params;
        const mock = store.mocks.get(mockId);
        if (!mock)
            return reply.code(404).send({ error: 'mock-not-found' });
        const endpoints = summarizeEndpoints(mock.entries);
        return {
            id: mock.id,
            mode: mock.mode,
            bodyMode: mock.bodyMode || 'scrubbed',
            simulateDelay: mock.simulateDelay,
            createdAt: mock.createdAt,
            counts: { entries: mock.entries.length, endpoints: endpoints.length },
            endpoints
        };
    });
    // Toggle mode/delay/bodyMode
    f.patch('/api/mocks/:mockId', async (req, reply) => {
        const { mockId } = req.params;
        const mock = store.mocks.get(mockId);
        if (!mock)
            return reply.code(404).send({ error: 'mock-not-found' });
        const body = req.body;
        if (body.mode)
            mock.mode = body.mode;
        if (typeof body.simulateDelay === 'boolean')
            mock.simulateDelay = body.simulateDelay;
        if (body.bodyMode)
            mock.bodyMode = body.bodyMode;
        return { ok: true };
    });
    // List entries by path/method
    f.get('/api/mocks/:mockId/entries', (req, reply) => {
        const { mockId } = req.params;
        const mock = store.mocks.get(mockId);
        if (!mock)
            return reply.code(404).send({ error: 'mock-not-found' });
        const useOriginal = mock.bodyMode === 'original';
        const { path, method, status } = (req.query || {});
        const list = mock.entries.filter(e => (!path || e.path === path) && (!method || e.method === String(method).toUpperCase()) && (!status || e.status === Number(status)));
        return list.map(e => ({
            id: e.id,
            orderIdx: e.orderIdx,
            method: e.method,
            path: e.path,
            status: e.status,
            contentType: e.contentType,
            time: e.time,
            timings: e.timings,
            curl: exampleCurl(mock.id, e, useOriginal)
        }));
    });
    // Entry preview
    f.get('/api/mocks/:mockId/entries/:entryId', (req, reply) => {
        const { mockId, entryId } = req.params;
        const mock = store.mocks.get(mockId);
        if (!mock)
            return reply.code(404).send({ error: 'mock-not-found' });
        const useOriginal = mock.bodyMode === 'original';
        const e = mock.entries.find(x => x.id === entryId);
        if (!e)
            return reply.code(404).send({ error: 'entry-not-found' });
        const reqBodyBuf = useOriginal && e.reqBodyOriginal ? e.reqBodyOriginal : e.reqBodyScrubbed || null;
        const respBodyBuf = useOriginal && e.respBodyOriginal ? e.respBodyOriginal : e.respBodyScrubbed || null;
        return {
            id: e.id,
            orderIdx: e.orderIdx,
            method: e.method,
            path: e.path,
            query: e.query,
            headerFp: e.headerFp,
            reqHeaders: e.reqHeaders,
            reqBody: reqBodyBuf ? safeBodyPreview(reqBodyBuf, e.reqHeaders['content-type']) : null,
            status: e.status,
            respHeaders: e.respHeaders,
            respBody: respBodyBuf ? safeBodyPreview(respBodyBuf, e.contentType) : null
        };
    });
    // Suites
    f.post('/api/mocks/:mockId/suites', async (req, reply) => {
        const { mockId } = req.params;
        const mock = store.mocks.get(mockId);
        if (!mock)
            return reply.code(404).send({ error: 'mock-not-found' });
        const body = req.body;
        const name = body?.name || 'Suite';
        const ids = body?.entryIds || [];
        const items = mock.entries
            .filter(e => ids.includes(e.id))
            .map(e => ({
            entryId: e.id,
            method: e.method,
            path: e.path,
            query: e.query,
            headers: e.contentType ? { 'content-type': e.contentType } : undefined,
            body: e.reqBodyScrubbed ? parseMaybeJson(e.reqHeaders['content-type'], e.reqBodyScrubbed) : undefined,
            expectStatus: e.status,
            assertions: body?.assertions || [],
            ignorePaths: body?.ignorePaths || []
        }));
        const id = `suite_${randomUUID().slice(0, 8)}`;
        const suite = { id, name, mockId, items, createdAt: Date.now() };
        store.suites.set(id, suite);
        return { suiteId: id };
    });
    f.get('/api/mocks/:mockId/suites/:suiteId', (req, reply) => {
        const { suiteId } = req.params;
        const suite = store.suites.get(suiteId);
        if (!suite)
            return reply.code(404).send({ error: 'suite-not-found' });
        return suite;
    });
}
function summarizeEndpoints(entries) {
    const map = new Map();
    for (const e of entries) {
        const key = `${e.method} ${e.path}`;
        const v = map.get(key) || { method: e.method, path: e.path, count: 0, statuses: [] };
        v.count++;
        v.statuses.push(e.status);
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
function safeBodyPreview(buf, ct) {
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
function exampleCurl(mockId, e, useOriginal) {
    const q = e.querySorted ? `?${e.querySorted}` : '';
    const bodyBuf = useOriginal && e.reqBodyOriginal ? e.reqBodyOriginal : e.reqBodyScrubbed;
    const body = bodyBuf ? `\\\n  --data '${bodyBuf.toString('utf8').replace(/'/g, "'\\''")}'` : '';
    const ct = e.reqHeaders['content-type'] ? `\\\n  -H 'Content-Type: ${e.reqHeaders['content-type']}'` : '';
    return `curl -i -X ${e.method} 'http://localhost:3000/m/${mockId}${e.path}${q}'${ct}${body}`;
}
function parseMaybeJson(ct, buf) {
    if (!ct || !ct.toLowerCase().includes('application/json'))
        return undefined;
    try {
        return JSON.parse(buf.toString('utf8'));
    }
    catch {
        return undefined;
    }
}
