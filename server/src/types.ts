export type Mode = 'sequence' | 'endpoint';
export type BodyMode = 'scrubbed' | 'original';

export interface MockEntry {
    id: string;
    orderIdx: number;
    method: string;
    url: string;
    path: string;
    query: Record<string, string[]>; // raw
    querySorted: string; // canonical a=1&b=2
    queryRelaxedKeys: Record<string, string[]>; // without volatile keys
    headerFp: string; // content-type, accept, authorization if present
    reqHeaders: Record<string, string>; // scrubbed
    reqBodyHash: string | null; // sha256 for <1MB
    reqBodyOriginal?: Buffer | null; // not served
    reqBodyScrubbed?: Buffer | null;
    status: number;
    respHeaders: Record<string, string>; // scrubbed
    respBodyOriginal?: Buffer | null; // not served
    respBodyScrubbed?: Buffer | null;
    contentType?: string;
    waitMs?: number; // captured wait timing
}

export interface SuiteAssertion {
    jsonPath?: string; // e.g. $.user.id
    equals?: unknown;
}

export interface SuiteItem {
    entryId: string;
    method: string;
    path: string;
    query?: Record<string, string[]>;
    headers?: Record<string, string>;
    body?: unknown;
    expectStatus: number;
    assertions?: SuiteAssertion[];
    ignorePaths?: string[]; // jsonpaths to ignore in diff
}

export interface Suite {
    id: string;
    name: string;
    mockId: string;
    items: SuiteItem[];
    createdAt: number;
}

export interface Mock {
    id: string;
    mode: Mode;
    bodyMode?: BodyMode;
    simulateDelay: boolean;
    createdAt: number;
    entries: MockEntry[];
    // sequence session pointer per session id → next index to scan from
    sessions: Map<string, number>;
}

