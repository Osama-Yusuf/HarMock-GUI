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
        if (mock.simulateDelay && entry.time && entry.time > 0) {
            await sleep(Math.floor(entry.time));
        }
        const headersOut = { ...entry.respHeaders };
        // Never set sensitive headers
        delete headersOut['set-cookie'];
        // Body we serve is not compressed; remove encoding if present
        delete headersOut['content-encoding'];
        if (entry.contentType)
            headersOut['content-type'] = entry.contentType;
        // If HAR captured a 304 with a body, serve it with 200 to ensure body is delivered
        const hasBodyOriginal = !!entry.respBodyOriginal && entry.respBodyOriginal.byteLength > 0;
        const hasBodyScrubbed = !!entry.respBodyScrubbed && entry.respBodyScrubbed.byteLength > 0;
        const harWas304 = entry.status === 304;
        const shouldCoerceTo200 = harWas304 && (hasBodyOriginal || hasBodyScrubbed);
        if (shouldCoerceTo200)
            reply.header('X-Har-Original-Status', String(entry.status));
        reply.code(shouldCoerceTo200 ? 200 : entry.status);
        for (const [k, v] of Object.entries(headersOut))
            reply.header(k, v);
        const useOriginal = mock.bodyMode === 'original';
        let bodyBuf = (useOriginal && entry.respBodyOriginal) ? entry.respBodyOriginal : entry.respBodyScrubbed || null;
        // If HTML, inject prefixing script so in-app fetch/XHR hit the mock root
        const ctLower = (headersOut['content-type'] || '').toLowerCase();
        if (bodyBuf && ctLower.includes('text/html')) {
            // Remove CSP response header for HTML so local scripts can load while mocking
            delete headersOut['content-security-policy'];
            const injected = injectPrefixScript(stripMetaCsp(bodyBuf.toString('utf8')), mock.id);
            if (injected !== null) {
                delete headersOut['content-length'];
                delete headersOut['etag'];
                bodyBuf = Buffer.from(injected, 'utf8');
            }
        }
        if (bodyBuf)
            return reply.send(bodyBuf);
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
function injectPrefixScript(html, mockId) {
    const script = `\n<script>(function(){\n  var BASE = '/m/${mockId}';\n  function rewrite(u){\n    try{\n      if(/^https?:\\\/\\\//i.test(u)){\n        var url = new URL(u, location.href);\n        if(url.origin===location.origin && !url.pathname.startsWith(BASE)){\n          url.pathname = BASE + (url.pathname.startsWith('/')?url.pathname:'/'+url.pathname);\n          return url.toString();\n        }\n        return u;\n      }\n      if(u.startsWith('/')){\n        return u.startsWith(BASE+'/')?u:(BASE+u);\n      }\n      return u;\n    }catch(e){ return u; }\n  }\n  var _fetch = window.fetch;\n  window.fetch = function(i, init){\n    if(typeof i==='string'){ i = rewrite(i); }\n    else if(i && i.url){ i = new Request(rewrite(i.url), i); }\n    return _fetch(i, init);\n  };\n  var _open = XMLHttpRequest.prototype.open;\n  XMLHttpRequest.prototype.open = function(m,u,a,u2,p){\n    try{ u = rewrite(String(u)); }catch(e){}\n    return _open.call(this,m,u,a,u2,p);\n  };\n})();</script>`;
    if (html.includes('</head>'))
        return html.replace('</head>', script + '\n</head>');
    if (html.includes('</body>'))
        return html.replace('</body>', script + '\n</body>');
    return html + script;
}
function stripMetaCsp(html) {
    // Remove <meta http-equiv="Content-Security-Policy" ...>
    return html.replace(/<meta[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>\s*/gi, '');
}
