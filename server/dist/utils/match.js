import crypto from 'node:crypto';
const VOLATILE_KEYS = new Set(['_t', 'cache', 'cachebust', 'cb']);
export function normalizeQuery(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj || {})) {
        const key = k.toLowerCase();
        if (v == null)
            continue;
        const arr = Array.isArray(v) ? v.map(String) : [String(v)];
        out[key] = arr.sort();
    }
    return Object.fromEntries(Object.entries(out).sort((a, b) => a[0].localeCompare(b[0])));
}
export function canonicalQueryString(q) {
    return Object.entries(q)
        .map(([k, vs]) => vs.map(v => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&'))
        .join('&');
}
export function relaxedQuery(q) {
    const out = {};
    for (const [k, vs] of Object.entries(q)) {
        if (VOLATILE_KEYS.has(k))
            continue;
        out[k] = vs;
    }
    return out;
}
export function headerFingerprint(h) {
    const keys = ['content-type', 'accept', 'authorization'];
    const parts = [];
    for (const k of keys) {
        if (h[k])
            parts.push(`${k}:${h[k].toLowerCase()}`);
    }
    return parts.join('|');
}
export function hashBody(buf) {
    if (!buf)
        return null;
    if (buf.byteLength > 1024 * 1024)
        return null; // only small bodies
    return crypto.createHash('sha256').update(buf).digest('hex');
}
export function chooseBestMatch(cands) {
    if (!cands.length)
        return null;
    const rank = { Exact: 0, Relaxed: 1, PathOnly: 2 };
    cands.sort((a, b) => {
        const r = rank[a.tier] - rank[b.tier];
        if (r !== 0)
            return r;
        return a.entry.orderIdx - b.entry.orderIdx;
    });
    return cands[0].entry;
}
