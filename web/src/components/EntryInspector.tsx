import React from 'react';

export default function EntryInspector({ entry }: any) {
    if (!entry) return <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4"><i>Select an entry</i></div>;
    return (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm p-4">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Entry #{entry.orderIdx}</h3>
                <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                    <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        Load Time: <strong>{entry.time ? `${Math.round(entry.time)}ms` : 'N/A'}</strong>
                    </span>
                    {entry.timings && (
                        <span className="text-xs">
                            (DNS: {entry.timings.dns || 0}ms, Connect: {entry.timings.connect || 0}ms, Send: {entry.timings.send || 0}ms, Wait: {entry.timings.wait || 0}ms, Receive: {entry.timings.receive || 0}ms)
                        </span>
                    )}
                </div>
            </div>
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

