export async function uploadHar(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch('/api/mocks', { method: 'POST', body: fd });
    if (!r.ok) throw new Error('upload failed');
    return r.json() as Promise<{ mockId: string }>;
}

export async function getMock(id: string) {
    const r = await fetch(`/api/mocks/${id}`);
    if (!r.ok) throw new Error('not found');
    return r.json();
}

export async function setMock(id: string, body: any) {
    const r = await fetch(`/api/mocks/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('update failed');
}

export async function listEntries(id: string, params: Record<string, string> = {}) {
    const qs = new URLSearchParams(params).toString();
    const r = await fetch(`/api/mocks/${id}/entries${qs ? '?' + qs : ''}`);
    if (!r.ok) throw new Error('failed');
    return r.json();
}

export async function getEntry(id: string, entryId: string) {
    const r = await fetch(`/api/mocks/${id}/entries/${entryId}`);
    if (!r.ok) throw new Error('failed');
    return r.json();
}

export async function createSuite(id: string, body: any) {
    const r = await fetch(`/api/mocks/${id}/suites`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('failed');
    return r.json();
}

export async function getSuite(id: string, suiteId: string) {
    const r = await fetch(`/api/mocks/${id}/suites/${suiteId}`);
    if (!r.ok) throw new Error('failed');
    return r.json();
}

