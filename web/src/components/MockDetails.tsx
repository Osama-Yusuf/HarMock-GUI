import React from 'react';

export default function MockDetails({ mock, onToggleMode, onToggleDelay, onToggleBodyMode }: any) {
    const root = `${location.origin}/m/${mock.id}`;
    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="text-sm">
                    <div><b>Mock ID:</b> {mock.id}</div>
                    <div><b>Root:</b> <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800">{root}</code></div>
                    <div><b>Counts:</b> {mock.counts.entries} entries, {mock.counts.endpoints} endpoints</div>
                </div>
                <div className="flex items-center gap-3 text-sm">
                    <label className="flex items-center gap-2">Mode:
                        <select className="border rounded px-2 py-1 bg-white dark:bg-slate-800" value={mock.mode} onChange={e => onToggleMode(e.target.value as any)}>
                            <option value="endpoint">endpoint</option>
                            <option value="sequence">sequence</option>
                        </select>
                    </label>
                    <label className="flex items-center gap-2">Delay:
                        <input type="checkbox" checked={mock.simulateDelay} onChange={e => onToggleDelay(e.target.checked)} />
                    </label>
                    <span className="h-5 w-px bg-slate-300 dark:bg-slate-700" />
                    <label className="flex items-center gap-2">Body:
                        <select className="border rounded px-2 py-1 bg-white dark:bg-slate-800" value={mock.bodyMode || 'scrubbed'} onChange={e => onToggleBodyMode(e.target.value as any)}>
                            <option value="scrubbed">scrubbed</option>
                            <option value="original">original</option>
                        </select>
                    </label>
                </div>
            </div>
            <div className="overflow-auto mt-3">
                <table className="min-w-full text-sm">
                    <thead className="text-left text-slate-500">
                        <tr><th className="py-1 pr-2">Method</th><th className="py-1 pr-2">Path</th><th className="py-1 pr-2">Count</th><th className="py-1">Status min/avg/max</th></tr>
                    </thead>
                    <tbody>
                        {mock.endpoints.map((e: any) => (
                            <tr key={`${e.method}-${e.path}`} className="border-t border-slate-100 dark:border-slate-800">
                                <td className="py-1 pr-2"><code>{e.method}</code></td>
                                <td className="py-1 pr-2"><code>{e.path}</code></td>
                                <td className="py-1 pr-2">{e.count}</td>
                                <td className="py-1">{e.minStatus}/{e.avgStatus}/{e.maxStatus}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="text-slate-500 text-xs mt-2">Example curl will appear per entry.</div>
        </div>
    );
}

