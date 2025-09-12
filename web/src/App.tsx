import React, { useEffect, useMemo, useState } from 'react';
import { createSuite, getEntry, getMock, listEntries, setMock, uploadHar } from './api';
import Upload from './components/Upload';
import MockDetails from './components/MockDetails';
import EntryTable from './components/EntryTable';
import EntryInspector from './components/EntryInspector';
import SuitePanel from './components/SuitePanel';

export default function App() {
    const [mockId, setMockId] = useState<string | null>(null);
    const [mock, setMockData] = useState<any | null>(null);
    const [entries, setEntries] = useState<any[]>([]);
    const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
    const [filters, setFilters] = useState<{ method?: string; status?: string }>({});
    const [selectedIds, setSelectedIds] = useState<string[]>([]);

    useEffect(() => { if (mockId) refresh(); }, [mockId]);
    useEffect(() => { if (mockId) loadEntries(); }, [mockId, filters]);

    async function refresh() { if (!mockId) return; setMockData(await getMock(mockId)); }
    async function loadEntries() { if (!mockId) return; setEntries(await listEntries(mockId, filters as any)); }
    async function onUpload(file: File) { const { mockId } = await uploadHar(file); setMockId(mockId); }
    async function onToggleMode(mode: 'sequence' | 'endpoint') { if (!mockId) return; await setMock(mockId, { mode }); await refresh(); }
    async function onToggleDelay(simulateDelay: boolean) { if (!mockId) return; await setMock(mockId, { simulateDelay }); await refresh(); }
    async function onSelectEntry(id: string) { if (!mockId) return; setSelectedEntry(await getEntry(mockId, id)); }

    async function onCreateSuite(name: string) {
        if (!mockId) return; const { suiteId } = await createSuite(mockId, { name, entryIds: selectedIds }); const suite = await (await fetch(`/api/mocks/${mockId}/suites/${suiteId}`)).json();
        const blob = new Blob([JSON.stringify(suite, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name || 'suite'}.json`; a.click();
    }

    return (
        <div className="container">
            <h1>HAR → Mock Server</h1>
            {!mockId && <Upload onUpload={onUpload} />}
            {mock && (
                <>
                    <MockDetails mock={mock} onToggleMode={onToggleMode} onToggleDelay={onToggleDelay} />
                    <EntryTable entries={entries} filters={filters} setFilters={setFilters} selectedIds={selectedIds} setSelectedIds={setSelectedIds} onSelect={onSelectEntry} mockId={mock.id} />
                    <div className="panes">
                        <EntryInspector entry={selectedEntry} />
                        <SuitePanel onCreate={onCreateSuite} selectedCount={selectedIds.length} />
                    </div>
                </>
            )}
        </div>
    );
}

