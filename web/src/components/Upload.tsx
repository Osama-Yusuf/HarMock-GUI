import React, { useCallback } from 'react';

export default function Upload({ onUpload }: { onUpload: (f: File) => void }) {
    const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) onUpload(f);
    }, [onUpload]);
    const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (f) onUpload(f);
    }, [onUpload]);
    return (
        <div className="border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl p-8 text-center bg-white/60 dark:bg-slate-800/40 shadow-sm" onDrop={onDrop} onDragOver={e => e.preventDefault()}>
            <p className="text-slate-700 dark:text-slate-200 mb-3">Drag & drop a <code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-slate-700">.har</code> file or choose</p>
            <input className="block mx-auto text-sm" type="file" accept=".har,application/json" onChange={onChange} />
        </div>
    );
}

