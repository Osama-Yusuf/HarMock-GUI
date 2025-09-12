import { dropSensitiveHeaders, maybeRedactBody } from './redact.js';
import { canonicalQueryString, hashBody, headerFingerprint, normalizeQuery, relaxedQuery } from './match.js';
export function parseHar(buffer) {
    const json = JSON.parse(buffer.toString('utf8'));
    const entries = json.log?.entries || [];
    let idx = 0;
    const out = entries.map((e) => {
        const urlObj = new URL(e.request.url);
        const path = urlObj.pathname;
        const rawQuery = {};
        for (const [k, v] of urlObj.searchParams.entries()) {
            const key = k.toLowerCase();
            rawQuery[key] = rawQuery[key] || [];
            rawQuery[key].push(v);
        }
        const reqHeadersRaw = Object.fromEntries((e.request.headers || []).map(h => [h.name.toLowerCase(), h.value]));
        const respHeadersRaw = Object.fromEntries((e.response.headers || []).map(h => [h.name.toLowerCase(), h.value]));
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
        const entry = {
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
function readBody(part) {
    if (!part || !part.text)
        return null;
    if (part.encoding === 'base64')
        return Buffer.from(part.text, 'base64');
    return Buffer.from(part.text, 'utf8');
}
