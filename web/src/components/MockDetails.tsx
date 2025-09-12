import React from 'react';

export default function MockDetails({ mock, onToggleMode, onToggleDelay }: any) {
    const root = `${location.origin}/m/${mock.id}`;
    return (
        <div className="card">
            <div className="row">
                <div>
                    <div><b>Mock ID:</b> {mock.id}</div>
                    <div><b>Root:</b> <code>{root}</code></div>
                    <div><b>Counts:</b> {mock.counts.entries} entries, {mock.counts.endpoints} endpoints</div>
                </div>
                <div className="controls">
                    <label>
                        Mode:
                        <select value={mock.mode} onChange={e => onToggleMode(e.target.value as any)}>
                            <option value="endpoint">endpoint</option>
                            <option value="sequence">sequence</option>
                        </select>
                    </label>
                    <label>
                        Delay:
                        <input type="checkbox" checked={mock.simulateDelay} onChange={e => onToggleDelay(e.target.checked)} />
                    </label>
                </div>
            </div>
            <div className="endpoints">
                <table>
                    <thead><tr><th>Method</th><th>Path</th><th>Count</th><th>Status min/avg/max</th></tr></thead>
                    <tbody>
                        {mock.endpoints.map((e: any) => (
                            <tr key={`${e.method}-${e.path}`}>
                                <td><code>{e.method}</code></td>
                                <td><code>{e.path}</code></td>
                                <td>{e.count}</td>
                                <td>{e.minStatus}/{e.avgStatus}/{e.maxStatus}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="hint">Example curl will appear per entry.</div>
        </div>
    );
}

