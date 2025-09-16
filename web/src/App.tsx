import React, { useEffect, useMemo, useState } from 'react';
import { createSuite, getEntry, getMock, listEntries, setMock, uploadHar } from './api';
import Upload from './components/Upload';
import MockDetails from './components/MockDetails';
import EntryTable from './components/EntryTable';
import EntryInspector from './components/EntryInspector';
import SuitePanel from './components/SuitePanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './components/ui/card';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Input } from './components/ui/input';
import { ThemeToggle } from './components/ui/theme-toggle';
import { storage } from './lib/storage';
import { RefreshCw, Trash2, Clock, FileText, Search, ChevronDown, ChevronRight } from 'lucide-react';
import './globals.css';

export default function App() {
    const [mockId, setMockId] = useState<string | null>(null);
    const [mock, setMockData] = useState<any | null>(null);
    const [entries, setEntries] = useState<any[]>([]);
    const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
    const [filters, setFilters] = useState<{ method?: string; status?: string }>({});
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [savedSession, setSavedSession] = useState<any>(null);
    const [currentFileName, setCurrentFileName] = useState<string>('');
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [showMockDetails, setShowMockDetails] = useState<boolean>(true);
    const [showEntryDetails, setShowEntryDetails] = useState<boolean>(true);

    // Load saved session on app start
    useEffect(() => {
        const session = storage.loadSession();
        if (session) {
            setSavedSession(session);
            setMockId(session.mockId);
            setMockData(session.mockData);
            setCurrentFileName(session.fileName);
        }
    }, []);

    useEffect(() => { if (mockId) refresh(); }, [mockId]);
    useEffect(() => { if (mockId) loadEntries(); }, [mockId, filters]);

    async function refresh() { 
        if (!mockId) return; 
        const mockData = await getMock(mockId);
        setMockData(mockData);
        
        // Save to localStorage whenever we refresh mock data
        if (currentFileName) {
            storage.saveSession(mockId, mockData, currentFileName);
        }
    }
    
    async function loadEntries() { if (!mockId) return; setEntries(await listEntries(mockId, filters as any)); }
    
    async function onUpload(file: File) { 
        const { mockId } = await uploadHar(file); 
        setMockId(mockId);
        setCurrentFileName(file.name);
        
        // Clear any previous session when uploading new file
        storage.clearSession();
    }
    
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

    const filteredEntries = useMemo(() => {
        return entries.filter(e => {
            const matchesFilters = (!filters.method || e.method === filters.method) &&
                (!filters.status || e.status === Number(filters.status));
            
            const matchesSearch = !searchQuery || 
                e.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
                e.path.toLowerCase().includes(searchQuery.toLowerCase());
            
            return matchesFilters && matchesSearch;
        });
    }, [entries, filters, searchQuery]);

    const filteredEndpoints = useMemo(() => {
        if (!mock?.endpoints) return [];
        return mock.endpoints.filter((endpoint: any) => {
            return !searchQuery || 
                endpoint.method.toLowerCase().includes(searchQuery.toLowerCase()) ||
                endpoint.path.toLowerCase().includes(searchQuery.toLowerCase());
        });
    }, [mock?.endpoints, searchQuery]);

    function clearSession() {
        storage.clearSession();
        setMockId(null);
        setMockData(null);
        setEntries([]);
        setSelectedEntry(null);
        setSelectedIds([]);
        setSavedSession(null);
        setCurrentFileName('');
        setFilters({});
    }

    return (
        <div className="min-h-screen bg-gradient-light dark:bg-gradient-dark">
            <div className="container mx-auto p-6 space-y-8">
                {/* Header */}
                <div className="flex items-center">
                    {/* Left spacer - matches right side width */}
                    <div className="flex items-center gap-2 w-32">
                        {/* Empty spacer to balance the right side */}
                    </div>
                    
                    {/* Centered title */}
                    <div className="text-center flex-1 space-y-2">
                        <h1 
                            className="text-4xl font-bold tracking-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent glitch-title"
                            data-text="HARMOCK"
                        >
                            HarMock
                        </h1>
                        <p className="text-muted-foreground text-lg">
                            Transform your HAR files into powerful mock APIs
                        </p>
                    </div>
                    
                    {/* Session Controls */}
                    <div className="flex items-center gap-2 w-32 justify-end">
                        <ThemeToggle />
                        {mock && (
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={clearSession}
                                className="text-red-400 hover:text-red-300 dark:text-red-400 dark:hover:text-red-300"
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Clear Session
                            </Button>
                        )}
                    </div>
                </div>

                {/* Saved Session Banner */}
                {!mockId && savedSession && (
                    <Card className="max-w-2xl mx-auto border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/20">
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/50">
                                        <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-medium text-blue-900 dark:text-blue-100">
                                            Previous Session Found
                                        </h3>
                                        <div className="flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
                                            <FileText className="h-3 w-3" />
                                            <span>{savedSession.fileName}</span>
                                            <Badge variant="secondary" className="text-xs">
                                                {storage.formatSessionAge(Date.now() - savedSession.timestamp)}
                                            </Badge>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            setMockId(savedSession.mockId);
                                            setMockData(savedSession.mockData);
                                            setCurrentFileName(savedSession.fileName);
                                        }}
                                    >
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        Restore
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            storage.clearSession();
                                            setSavedSession(null);
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Search Bar */}
                {mock && (
                    <Card>
                        <CardContent className="pt-6">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                                <Input
                                    placeholder="Search by method or path (e.g., GET, /api/users)"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Upload Section */}
                {!mockId && (
                    <Upload onUpload={onUpload} />
                )}

                {/* Mock Details and Controls */}
                {mock && (
                    <div className="space-y-6">
                        {/* Mock Server Details Section */}
                        <Card>
                            <CardHeader>
                                <button
                                    onClick={() => setShowMockDetails(!showMockDetails)}
                                    className="flex items-center justify-between w-full text-left hover:bg-muted/50 rounded p-2 -m-2 transition-colors"
                                >
                                    <CardTitle className="flex items-center gap-2">
                                        {showMockDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        Mock Server Details
                                    </CardTitle>
                                    <Badge variant="outline">
                                        {filteredEndpoints.length} endpoints
                                    </Badge>
                                </button>
                            </CardHeader>
                            {showMockDetails && (
                                <CardContent>
                                    <MockDetails 
                                        mock={{...mock, endpoints: filteredEndpoints}} 
                                        onToggleMode={onToggleMode} 
                                        onToggleDelay={onToggleDelay} 
                                        onToggleBodyMode={onToggleBodyMode} 
                                    />
                                </CardContent>
                            )}
                        </Card>
                        
                        {/* Request/Response Details Section */}
                        <Card>
                            <CardHeader>
                                <button
                                    onClick={() => setShowEntryDetails(!showEntryDetails)}
                                    className="flex items-center justify-between w-full text-left hover:bg-muted/50 rounded p-2 -m-2 transition-colors"
                                >
                                    <CardTitle className="flex items-center gap-2">
                                        {showEntryDetails ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                        Request/Response Details
                                    </CardTitle>
                                    <Badge variant="outline">
                                        {filteredEntries.length} entries
                                    </Badge>
                                </button>
                            </CardHeader>
                            {showEntryDetails && (
                                <CardContent className="space-y-6">
                                    <EntryTable 
                                        entries={filteredEntries} 
                                        filters={filters} 
                                        setFilters={setFilters} 
                                        selectedIds={selectedIds} 
                                        setSelectedIds={setSelectedIds} 
                                        onSelect={onSelectEntry} 
                                        mockId={mock.id} 
                                    />
                                    
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <EntryInspector entry={selectedEntry} />
                                        <SuitePanel 
                                            selectedCount={selectedIds.length}
                                            onCreate={onCreateSuite} 
                                        />
                                    </div>
                                </CardContent>
                            )}
                        </Card>
                    </div>
                )}
            </div>
        </div>
    );
}
