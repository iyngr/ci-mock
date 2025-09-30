// Centralized API client wrapper
// Uses NEXT_PUBLIC_API_URL and automatically attaches Authorization header if candidateToken present.
// Automatically includes admin context source parameter for context-aware API calls.

import { getActiveAdminSource } from './adminContext';

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

export async function apiFetch<T = any>(path: string, options: RequestInit = {}): Promise<T> {
    const token = (typeof window !== 'undefined') ? localStorage.getItem('candidateToken') : null;
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {})
    };
    if (token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    // Add admin context source parameter if path starts with /api/admin
    const contextAwarePath = path.startsWith('/api/admin') ? withContextSource(path) : path;

    const res = await fetch(`${apiBase}${contextAwarePath}`, { ...options, headers });
    const payload = await parseJSON(res);
    if (!res.ok) {
        const err: ApiError = new Error(payload?.detail || payload?.message || 'API request failed');
        err.status = res.status;
        err.payload = payload;
        throw err;
    }
    return payload as T;
}

export function withQuery(path: string, params: Record<string, any>) {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        usp.append(k, String(v));
    });
    const qs = usp.toString();
    return qs ? `${path}?${qs}` : path;
}

// Add admin context source parameter to admin API paths
export function withContextSource(path: string): string {
    if (typeof window === 'undefined') return path; // SSR safe

    try {
        // Do not attach admin source to question-related endpoints. Questions are
        // shared across product contexts and should not be partitioned by source.
        if (path.startsWith('/api/admin/questions')) {
            return path;
        }
        const activeContext = getActiveAdminSource();
        return withQuery(path, { source: activeContext });
    } catch (error) {
        // Fallback if context is not available
        console.warn('Could not get admin context, using default source:', error);
        return withQuery(path, { source: 'smart-mock' });
    }
}

// Convenience function to build API URLs with automatic context awareness
export function buildApiUrl(path: string, extraParams?: Record<string, any>): string {
    let finalPath = path;

    // Add context source for admin paths
    if (path.startsWith('/api/admin')) {
        finalPath = withContextSource(path);
    }

    // Add any extra parameters
    if (extraParams && Object.keys(extraParams).length > 0) {
        // Parse existing query params and merge with new ones
        const [basePath, queryString] = finalPath.split('?');
        const existingParams = queryString ? Object.fromEntries(new URLSearchParams(queryString)) : {};
        const mergedParams = { ...existingParams, ...extraParams };
        finalPath = withQuery(basePath, mergedParams);
    }

    return `${apiBase}${finalPath}`;
}
