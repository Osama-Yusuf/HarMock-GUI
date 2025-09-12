import React from 'react';

export default function EntryInspector({ entry }: any) {
    if (!entry) return <div className="card"><i>Select an entry</i></div>;
    return (
        <div className="card">
            <h3>Entry #{entry.orderIdx}</h3>
            <div className="grid2">
                <section>
                    <h4>Request</h4>
                    <pre>{JSON.stringify({ method: entry.method, path: entry.path, headers: entry.reqHeaders, body: entry.reqBody?.text?.slice?.(0, 2000) ?? entry.reqBody }, null, 2)}</pre>
                </section>
                <section>
                    <h4>Response</h4>
                    <pre>{JSON.stringify({ status: entry.status, headers: entry.respHeaders, body: entry.respBody?.text?.slice?.(0, 2000) ?? entry.respBody }, null, 2)}</pre>
                </section>
            </div>
        </div>
    );
}

