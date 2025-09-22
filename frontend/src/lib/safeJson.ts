// Small helper to safely parse JSON values from localStorage or other dynamic sources.
// Returns undefined on failure instead of throwing, with optional console debug.
export function safeParseJSON<T = any>(value: string | null | undefined, debugLabel?: string): T | undefined {
    if (value == null) return undefined;
    try {
        return JSON.parse(value) as T;
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn(`safeParseJSON: failed to parse ${debugLabel || 'value'}`, err);
        }
        return undefined;
    }
}

// Store an object (or primitive) as JSON safely.
export function setJSON(key: string, value: any) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
            console.warn('setJSON failed', key, err);
        }
    }
}

// Retrieve and parse JSON; returns fallback if missing or invalid.
export function getJSON<T = any>(key: string, fallback?: T): T | undefined {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(key) : null;
    const parsed = safeParseJSON<T>(raw || undefined, key);
    return parsed === undefined ? fallback : parsed;
}

// Remove key (no-op if absent)
export function removeJSON(key: string) {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
}
