import type { Mock, Suite } from './types.js';

export const store = {
    mocks: new Map<string, Mock>(),
    suites: new Map<string, Suite>()
};

