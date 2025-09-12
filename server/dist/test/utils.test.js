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
        const fp = headerFingerprint({ 'content-type': 'Application/JSON', accept: 'application/json', other: 'x' });
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
