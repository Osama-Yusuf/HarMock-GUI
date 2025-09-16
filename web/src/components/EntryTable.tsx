import React from 'react';

export default function EntryTable({ entries, filters, setFilters, selectedIds, setSelectedIds, onSelect, mockId }: any) {
    function toggle(id: string) {
        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter((x: string) => x !== id));
        else setSelectedIds([...selectedIds, id]);
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
                        <tr><th className="py-1 pr-2"></th><th className="py-1 pr-2">#</th><th className="py-1 pr-2">Method</th><th className="py-1 pr-2">Path</th><th className="py-1 pr-2">Status</th><th className="py-1 pr-2">Time</th><th className="py-1">Curl</th></tr>
                    </thead>
                    <tbody>
                        {entries.map((e: any) => (
                            <tr key={e.id} className="border-t border-slate-100 dark:border-slate-800">
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
                                <td className="py-1"><button className="px-2 py-1 border rounded hover:bg-slate-50 dark:hover:bg-slate-800" onClick={() => navigator.clipboard.writeText(e.curl)}>Copy curl</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

