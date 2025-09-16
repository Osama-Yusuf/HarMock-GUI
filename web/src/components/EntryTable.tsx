import React, { useState } from 'react';
import { ChevronUp, ChevronDown, Check } from 'lucide-react';

export default function EntryTable({ entries, filters, setFilters, selectedIds, setSelectedIds, onSelect, mockId }: any) {
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    function toggle(id: string) {
        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter((x: string) => x !== id));
        else setSelectedIds([...selectedIds, id]);
    }

    function handleSort(field: string) {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('asc');
        }
    }

    const sortedEntries = [...entries].sort((a, b) => {
        if (!sortField) return 0;
        
        let aVal = a[sortField];
        let bVal = b[sortField];
        
        if (sortField === 'time') {
            aVal = a.time || 0;
            bVal = b.time || 0;
        }
        
        if (typeof aVal === 'string' && typeof bVal === 'string') {
            return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
        }
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        return 0;
    });

    function SortableHeader({ field, children }: { field: string; children: React.ReactNode }) {
        const isActive = sortField === field;
        return (
            <th 
                className="py-1 pr-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 select-none"
                onClick={() => handleSort(field)}
            >
                <div className="flex items-center gap-1">
                    {children}
                    {isActive && (
                        sortDirection === 'asc' ? 
                        <ChevronUp className="h-3 w-3" /> : 
                        <ChevronDown className="h-3 w-3" />
                    )}
                </div>
            </th>
        );
    }
    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4">
            <div className="flex items-center justify-between gap-3 mb-2">
                <label className="text-sm">Method <input className="ml-2 border rounded px-2 py-1" value={filters.method || ''} onChange={e => setFilters({ ...filters, method: e.target.value })} placeholder="GET" /></label>
                <label className="text-sm">Status <input className="ml-2 border rounded px-2 py-1" value={filters.status || ''} onChange={e => setFilters({ ...filters, status: e.target.value })} placeholder="200" /></label>
            </div>
            <div className="overflow-auto">
                <table className="min-w-full text-sm">
                    <thead className="text-left text-slate-500">
                        <tr>
                            <th className="py-1 pr-2"></th>
                            <SortableHeader field="orderIdx">#</SortableHeader>
                            <SortableHeader field="method">Method</SortableHeader>
                            <SortableHeader field="path">Path</SortableHeader>
                            <SortableHeader field="status">Status</SortableHeader>
                            <SortableHeader field="time">Time</SortableHeader>
                            <th className="py-1">Curl</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedEntries.map((e: any) => (
                            <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <td className="py-1 pr-2"><input type="checkbox" checked={selectedIds.includes(e.id)} onChange={() => toggle(e.id)} /></td>
                                <td className="py-1 pr-2">{e.orderIdx}</td>
                                <td className="py-1 pr-2"><code>{e.method}</code></td>
                                <td className="py-1 pr-2"><button className="text-blue-600 hover:underline" onClick={() => onSelect(e.id)}>{e.path}</button></td>
                                <td className="py-1 pr-2">{e.status}</td>
                                <td className="py-1 pr-2">
                                    <span className="text-xs text-slate-600 dark:text-slate-400">
                                        {e.time ? `${Math.round(e.time)}ms` : '-'}
                                    </span>
                                </td>
                                <td className="py-1">
                                    <button 
                                        className="px-2 py-1 border rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors relative z-10 flex items-center gap-1" 
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            navigator.clipboard.writeText(e.curl);
                                            setCopiedId(e.id);
                                            setTimeout(() => setCopiedId(null), 2000);
                                        }}
                                    >
                                        {copiedId === e.id ? (
                                            <>
                                                <Check className="h-3 w-3 text-green-600" />
                                                Copied!
                                            </>
                                        ) : (
                                            'Copy curl'
                                        )}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

