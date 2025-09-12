import React, { useState } from 'react';

export default function SuitePanel({ onCreate, selectedCount }: { onCreate: (name: string) => void; selectedCount: number }) {
    const [name, setName] = useState('regression-suite');
    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4">
            <h3 className="text-lg font-semibold mb-2">Create Suite</h3>
            <div className="flex items-center gap-2 mb-2">
                <input className="flex-1 border rounded px-3 py-2" value={name} onChange={e => setName(e.target.value)} />
                <button className="px-3 py-2 rounded bg-blue-600 text-white disabled:opacity-50" disabled={!selectedCount} onClick={() => onCreate(name)}>Download suite.json ({selectedCount} items)</button>
            </div>
            <p className="text-slate-500 text-xs">Run: <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-800">npm run suite -- --target http://localhost:3000 --suite ./suite.json</code></p>
        </div>
    );
}

