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

