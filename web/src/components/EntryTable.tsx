import React from 'react';

export default function EntryTable({ entries, filters, setFilters, selectedIds, setSelectedIds, onSelect, mockId }: any) {
    function toggle(id: string) {
        if (selectedIds.includes(id)) setSelectedIds(selectedIds.filter((x: string) => x !== id));
        else setSelectedIds([...selectedIds, id]);
    }
    return (
        <div className="card">
            <div className="row">
                <label>Method <input value={filters.method || ''} onChange={e => setFilters({ ...filters, method: e.target.value })} placeholder="GET" /></label>
                <label>Status <input value={filters.status || ''} onChange={e => setFilters({ ...filters, status: e.target.value })} placeholder="200" /></label>
            </div>
            <table>
                <thead><tr><th></th><th>#</th><th>Method</th><th>Path</th><th>Status</th><th>Curl</th></tr></thead>
                <tbody>
                    {entries.map((e: any) => (
                        <tr key={e.id}>
                            <td><input type="checkbox" checked={selectedIds.includes(e.id)} onChange={() => toggle(e.id)} /></td>
                            <td>{e.orderIdx}</td>
                            <td><code>{e.method}</code></td>
                            <td><button className="link" onClick={() => onSelect(e.id)}>{e.path}</button></td>
                            <td>{e.status}</td>
                            <td><button onClick={() => navigator.clipboard.writeText(e.curl)}>Copy curl</button></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

