import { store } from '../store.js';
import { chooseBestMatch, canonicalQueryString, headerFingerprint, normalizeQuery, relaxedQuery } from '../utils/match.js';
import { setTimeout as sleep } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
export async function mockRoutes(f) {
    f.all('/m/:mockId/*', async (req, reply) => {
        const { mockId } = req.params;
        const mock = store.mocks.get(mockId);
        if (!mock)
            return reply.code(404).send({ error: 'mock-not-found' });
        const url = new URL(req.url, `http://localhost`);
        const path = '/' + req.params['*'];
        const method = req.method.toUpperCase();
        const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k.toLowerCase(), Array.isArray(v) ? v.join(', ') : String(v || '')]));
        const fp = headerFingerprint(headers);
        const qNorm = normalizeQuery(Object.fromEntries(url.searchParams.entries()));
        const qCanon = canonicalQueryString(qNorm);
        const qRelax = relaxedQuery(qNorm);
        let entry = null;
        if (mock.mode === 'sequence') {
            let session = req.headers['x-mock-session'] || '';
            if (!session) {
                session = randomUUID();
                reply.header('X-Mock-Session', session);
            }
            const startIdx = mock.sessions.get(session) ?? 0;
            // Scan forward to find the next matching entry
            for (let i = startIdx; i < mock.entries.length; i++) {
                const e = mock.entries[i];
                if (isMatch(method, path, qCanon, qRelax, fp, e)) {
                    entry = e;
                    mock.sessions.set(session, i + 1);
                    break;
                }
            }
            if (!entry)
                return reply.code(404).send({ error: 'out-of-sequence' });
        }
        else {
            const cands = [];
            for (const e of mock.entries) {
                if (e.method !== method || e.path !== path)
                    continue;
                if (e.querySorted === qCanon && e.headerFp === fp)
                    cands.push({ entry: e, tier: 'Exact' });
                else if (subsetQuery(e.queryRelaxedKeys, qRelax))
                    cands.push({ entry: e, tier: 'Relaxed' });
                else
                    cands.push({ entry: e, tier: 'PathOnly' });
            }
            entry = chooseBestMatch(cands);
            if (!entry)
                return reply.code(404).send({ error: 'no-match' });
        }
        if (mock.simulateDelay && entry.waitMs && entry.waitMs > 0) {
            await sleep(entry.waitMs);
        }
        const headersOut = { ...entry.respHeaders };
        // Never set sensitive headers
        delete headersOut['set-cookie'];
        if (entry.contentType)
            headersOut['content-type'] = entry.contentType;
        reply.code(entry.status);
        for (const [k, v] of Object.entries(headersOut))
            reply.header(k, v);
        const useOriginal = mock.bodyMode === 'original';
        if (useOriginal && entry.respBodyOriginal) {
            return reply.send(entry.respBodyOriginal);
        }
        if (entry.respBodyScrubbed) {
            return reply.send(entry.respBodyScrubbed);
        }
        return reply.send();
    });
}
function isMatch(method, path, qCanon, qRelax, fp, e) {
    if (e.method !== method || e.path !== path)
        return false;
    if (e.querySorted === qCanon && e.headerFp === fp)
        return true;
    if (subsetQuery(e.queryRelaxedKeys, qRelax))
        return true;
    return true; // path-only fallback
}
function subsetQuery(a, b) {
    // return true if a ⊆ b
    for (const [k, vs] of Object.entries(a)) {
        const bv = b[k] || [];
        for (const v of vs)
            if (!bv.includes(v))
                return false;
    }
    return true;
}
