/**
 * Centralized API client wrapper for Talens (AI Realtime Interview)
 * Uses NEXT_PUBLIC_API_URL and automatically attaches Authorization header if candidateToken present.
 * 
 * Security Best Practices:
 * - Hostname validation using allowlist
 * - No user input in hostname construction
 * - Bearer token authentication
 * - Proper error handling
 */

// List of trusted API base URLs. Adjust as required for your deployment environments.
const allowedApiBases = [
    'http://localhost:8000',
    'https://api.myapp.com',
    'https://staging-api.myapp.com'
];

// Validate that the configured API URL is allowed
function getSafeApiBase(): string {
    const envBase = process.env.NEXT_PUBLIC_API_URL || '';
    if (allowedApiBases.includes(envBase)) {
        return envBase;
    }
    return 'http://localhost:8000';
}

export const apiBase = getSafeApiBase();

export interface ApiError extends Error {
    status?: number;
    payload?: any;
}

async function parseJSON(res: Response) {
    const text = await res.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
}

/**
 * Fetch wrapper with automatic authentication and error handling
 * 
 * @param path - API endpoint path (e.g., '/api/live-interview/plan')
 * @param options - Fetch options (method, body, headers, etc.)
 * @returns Parsed JSON response
 */
export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    const token = (typeof window !== 'undefined') ? localStorage.getItem('talens_candidate_token') : null;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {})
    };
    if (token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    const res = await fetch(`${apiBase}${path}`, { ...options, headers });
    const payload = await parseJSON(res);
    if (!res.ok) {
        const err: ApiError = new Error(payload?.detail || payload?.message || 'API request failed');
        err.status = res.status;
        err.payload = payload;
        throw err;
    }
    return payload as T;
}

/**
 * Build URL with query parameters
 * 
 * @param path - Base path
 * @param params - Query parameters object
 * @returns Full path with query string
 */
export function withQuery(path: string, params: Record<string, any>) {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        usp.append(k, String(v));
    });
    const qs = usp.toString();
    return qs ? `${path}?${qs}` : path;
}

/**
 * Get candidate token from localStorage
 */
export function getCandidateToken(): string | null {
    return (typeof window !== 'undefined') ? localStorage.getItem('talens_candidate_token') : null;
}

/**
 * Set candidate token in localStorage
 */
export function setCandidateToken(token: string): void {
    if (typeof window !== 'undefined') {
        localStorage.setItem('talens_candidate_token', token);
    }
}

/**
 * Clear candidate token
 */
export function clearCandidateToken(): void {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('talens_candidate_token');
    }
}
