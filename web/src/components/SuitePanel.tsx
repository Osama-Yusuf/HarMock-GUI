import React, { useState } from 'react';

export default function SuitePanel({ onCreate, selectedCount }: { onCreate: (name: string) => void; selectedCount: number }) {
    const [name, setName] = useState('regression-suite');
    return (
        <div className="card">
            <h3>Create Suite</h3>
            <div className="row">
                <input value={name} onChange={e => setName(e.target.value)} />
                <button disabled={!selectedCount} onClick={() => onCreate(name)}>Download suite.json ({selectedCount} items)</button>
            </div>
            <p className="hint">Run: <code>npm run suite -- --target http://localhost:3000 --suite ./suite.json</code></p>
        </div>
    );
}

