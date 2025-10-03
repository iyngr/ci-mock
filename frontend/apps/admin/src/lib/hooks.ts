/**
 * Admin App Hooks for Phase 6
 * 
 * Custom React hooks for admin-specific Phase 6 features:
 * - LLM health checks
 * - Question duplicate detection
 * - Analytics and metrics
 */

import { useState, useEffect, useCallback } from 'react'
import { buildApiUrl } from './apiClient'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface LLMHealthStatus {
    healthy: boolean
    latency_ms: number
    model: string
    last_checked: string
    error?: string
}

export interface DuplicateCheckResult {
    is_duplicate: boolean
    similarity_score: number
    existing_question?: {
        id: string
        text: string
        created_at: string
    }
    recommendations?: string[]
}

export interface CacheAnalytics {
    total_requests: number
    cache_hits: number
    cache_misses: number
    hit_rate: number
    cost_savings_usd: number
    top_cached_questions: Array<{
        question_text: string
        usage_count: number
        last_used: string
    }>
}

// ============================================================================
// HOOK: useLLMHealth
// Monitors LLM service health for question generation
// ============================================================================

export function useLLMHealth() {
    const [health, setHealth] = useState<LLMHealthStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const checkHealth = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const token = localStorage.getItem('adminToken')
            if (!token) {
                throw new Error('Not authenticated')
            }

            const response = await fetch(buildApiUrl('/api/utils/llm-health'), {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            })

            if (!response.ok) {
                throw new Error(`Health check failed: ${response.statusText}`)
            }

            const data = await response.json()
            setHealth(data)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Health check failed'
            setError(message)
            setHealth(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        checkHealth()
    }, [checkHealth])

    return { health, loading, error, refresh: checkHealth }
}

// ============================================================================
// HOOK: useDuplicateCheck
// Checks for duplicate questions before adding to database
// ============================================================================

export function useDuplicateCheck() {
    const [checking, setChecking] = useState(false)
    const [result, setResult] = useState<DuplicateCheckResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    const checkDuplicate = useCallback(async (questionText: string, role?: string) => {
        if (!questionText.trim()) {
            setResult(null)
            return
        }

        setChecking(true)
        setError(null)

        try {
            const token = localStorage.getItem('adminToken')
            if (!token) {
                throw new Error('Not authenticated')
            }

            const response = await fetch(buildApiUrl('/api/admin/questions/check-duplicate'), {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    question_text: questionText,
                    role: role,
                }),
            })

            if (!response.ok) {
                throw new Error(`Duplicate check failed: ${response.statusText}`)
            }

            const data = await response.json()
            setResult(data)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Duplicate check failed'
            setError(message)
            setResult(null)
        } finally {
            setChecking(false)
        }
    }, [])

    const reset = useCallback(() => {
        setResult(null)
        setError(null)
    }, [])

    return { checking, result, error, checkDuplicate, reset }
}

// ============================================================================
// HOOK: useCacheAnalytics
// Fetches cache performance metrics and analytics
// ============================================================================

export function useCacheAnalytics() {
    const [analytics, setAnalytics] = useState<CacheAnalytics | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchAnalytics = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const token = localStorage.getItem('adminToken')
            if (!token) {
                throw new Error('Not authenticated')
            }

            const response = await fetch(buildApiUrl('/api/admin/analytics/cache'), {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            })

            if (!response.ok) {
                throw new Error(`Analytics fetch failed: ${response.statusText}`)
            }

            const data = await response.json()
            setAnalytics(data)
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Analytics fetch failed'
            setError(message)
            setAnalytics(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchAnalytics()
    }, [fetchAnalytics])

    return { analytics, loading, error, refresh: fetchAnalytics }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Format cost savings with proper currency formatting
 */
export function formatCostSavings(usd: number): string {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(usd)
}

/**
 * Format percentage with 1 decimal place
 */
export function formatPercentage(decimal: number): string {
    return `${(decimal * 100).toFixed(1)}%`
}

/**
 * Format latency with appropriate unit (ms or s)
 */
export function formatLatency(ms: number): string {
    if (ms < 1000) {
        return `${Math.round(ms)}ms`
    }
    return `${(ms / 1000).toFixed(2)}s`
}
