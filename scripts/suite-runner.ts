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
    return `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<testsuite name="${xmlName}" tests="${cases.length}" failures="${failures.length}">` +
        cases.map(c => c.ok ? `<testcase name="${c.name}"/>` : `<testcase name=\"${c.name}\"><failure><![CDATA[${c.message}]]></failure></testcase>`).join('') +
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

