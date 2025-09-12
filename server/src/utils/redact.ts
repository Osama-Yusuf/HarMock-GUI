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

