import React, { useEffect, useMemo, useState } from 'react';
import { createSuite, getEntry, getMock, listEntries, setMock, uploadHar } from './api';
import Upload from './components/Upload';
import MockDetails from './components/MockDetails';
import EntryTable from './components/EntryTable';
import EntryInspector from './components/EntryInspector';
import SuitePanel from './components/SuitePanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import './globals.css';

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
    async function onToggleBodyMode(bodyMode: 'scrubbed' | 'original') {
        if (!mockId) return;
        await setMock(mockId, { bodyMode });
        await refresh();
        await loadEntries();
        if (selectedEntry?.id) setSelectedEntry(await getEntry(mockId, selectedEntry.id));
    }
    async function onSelectEntry(id: string) { if (!mockId) return; setSelectedEntry(await getEntry(mockId, id)); }

    async function onCreateSuite(name: string) {
        if (!mockId) return; const { suiteId } = await createSuite(mockId, { name, entryIds: selectedIds }); const suite = await (await fetch(`/api/mocks/${mockId}/suites/${suiteId}`)).json();
        const blob = new Blob([JSON.stringify(suite, null, 2)], { type: 'application/json' });
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${name || 'suite'}.json`; a.click();
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <div className="container mx-auto p-6 space-y-8">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        HAR → Mock Server
                    </h1>
                    <p className="text-muted-foreground text-lg">
                        Transform your HAR files into powerful mock APIs
                    </p>
                </div>

                {/* Upload Section */}
                {!mockId && (
                    <Card className="max-w-2xl mx-auto">
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl">Get Started</CardTitle>
                            <CardDescription>
                                Upload a HAR file to create your mock API server
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Upload onUpload={onUpload} />
                        </CardContent>
                    </Card>
                )}

                {/* Mock Details and Controls */}
                {mock && (
                    <div className="space-y-6">
                        <MockDetails 
                            mock={mock} 
                            onToggleMode={onToggleMode} 
                            onToggleDelay={onToggleDelay} 
                            onToggleBodyMode={onToggleBodyMode} 
                        />
                        
                        <EntryTable 
                            entries={entries} 
                            filters={filters} 
                            setFilters={setFilters} 
                            selectedIds={selectedIds} 
                            setSelectedIds={setSelectedIds} 
                            onSelect={onSelectEntry} 
                            mockId={mock.id} 
                        />
                        
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <EntryInspector entry={selectedEntry} />
                            <SuitePanel onCreate={onCreateSuite} selectedCount={selectedIds.length} />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

