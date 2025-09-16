// Local storage utilities for HAR Mock Server

const STORAGE_KEYS = {
  MOCK_ID: 'har-mock-server-mock-id',
  MOCK_DATA: 'har-mock-server-mock-data',
  HAR_FILE_NAME: 'har-mock-server-file-name',
  SESSION_TIMESTAMP: 'har-mock-server-session-timestamp'
} as const;

export interface StoredSession {
  mockId: string;
  mockData: any;
  fileName: string;
  timestamp: number;
}

export const storage = {
  // Save current session data
  saveSession: (mockId: string, mockData: any, fileName: string): void => {
    try {
      const sessionData: StoredSession = {
        mockId,
        mockData,
        fileName,
        timestamp: Date.now()
      };
      
      localStorage.setItem(STORAGE_KEYS.MOCK_ID, mockId);
      localStorage.setItem(STORAGE_KEYS.MOCK_DATA, JSON.stringify(mockData));
      localStorage.setItem(STORAGE_KEYS.HAR_FILE_NAME, fileName);
      localStorage.setItem(STORAGE_KEYS.SESSION_TIMESTAMP, sessionData.timestamp.toString());
      
      console.log('Session saved to localStorage:', { mockId, fileName });
    } catch (error) {
      console.error('Failed to save session to localStorage:', error);
    }
  },

  // Load saved session data
  loadSession: (): StoredSession | null => {
    try {
      const mockId = localStorage.getItem(STORAGE_KEYS.MOCK_ID);
      const mockDataStr = localStorage.getItem(STORAGE_KEYS.MOCK_DATA);
      const fileName = localStorage.getItem(STORAGE_KEYS.HAR_FILE_NAME);
      const timestampStr = localStorage.getItem(STORAGE_KEYS.SESSION_TIMESTAMP);

      if (!mockId || !mockDataStr || !fileName || !timestampStr) {
        return null;
      }

      const mockData = JSON.parse(mockDataStr);
      const timestamp = parseInt(timestampStr, 10);

      return {
        mockId,
        mockData,
        fileName,
        timestamp
      };
    } catch (error) {
      console.error('Failed to load session from localStorage:', error);
      return null;
    }
  },

  // Clear all session data
  clearSession: (): void => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
      console.log('Session cleared from localStorage');
    } catch (error) {
      console.error('Failed to clear session from localStorage:', error);
    }
  },

  // Check if there's a saved session
  hasSession: (): boolean => {
    return localStorage.getItem(STORAGE_KEYS.MOCK_ID) !== null;
  },

  // Get session age in milliseconds
  getSessionAge: (): number | null => {
    const timestampStr = localStorage.getItem(STORAGE_KEYS.SESSION_TIMESTAMP);
    if (!timestampStr) return null;
    
    const timestamp = parseInt(timestampStr, 10);
    return Date.now() - timestamp;
  },

  // Format session age for display
  formatSessionAge: (ageMs: number): string => {
    const minutes = Math.floor(ageMs / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
  }
};
