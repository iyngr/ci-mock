// Centralized API client wrapper
// Uses NEXT_PUBLIC_API_URL and automatically attaches Authorization header if candidateToken present.

export const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

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

export function withQuery(path: string, params: Record<string, any>) {
    const usp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null) return;
        usp.append(k, String(v));
    });
    const qs = usp.toString();
    return qs ? `${path}?${qs}` : path;
}
