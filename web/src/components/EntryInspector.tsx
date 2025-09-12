import React from 'react';

export default function EntryInspector({ entry }: any) {
    if (!entry) return <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4"><i>Select an entry</i></div>;
    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4">
            <h3 className="text-lg font-semibold mb-2">Entry #{entry.orderIdx}</h3>
            <div className="grid grid-cols-1 gap-3">
                <section>
                    <h4 className="font-medium mb-1">Request</h4>
                    <pre className="max-h-80 overflow-auto rounded bg-slate-900/90 text-slate-100 p-3 text-xs">{JSON.stringify({ method: entry.method, path: entry.path, headers: entry.reqHeaders, body: entry.reqBody?.text?.slice?.(0, 2000) ?? entry.reqBody }, null, 2)}</pre>
                </section>
                <section>
                    <h4 className="font-medium mb-1">Response</h4>
                    <pre className="max-h-80 overflow-auto rounded bg-slate-900/90 text-slate-100 p-3 text-xs">{JSON.stringify({ status: entry.status, headers: entry.respHeaders, body: entry.respBody?.text?.slice?.(0, 2000) ?? entry.respBody }, null, 2)}</pre>
                </section>
            </div>
        </div>
    );
}

