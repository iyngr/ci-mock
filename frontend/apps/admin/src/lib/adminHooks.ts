/**
 * Phase 6: Admin-specific React hooks
 * 
 * Hooks for:
 * - LLM health monitoring
 * - Question duplicate detection
 * - Analytics data fetching
 */

import { useState, useEffect, useCallback } from 'react'
import { apiFetch } from '@/lib/apiClient'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface LLMHealthStatus {
    healthy: boolean
    models_available: number
    total_models: number
    response_time_ms: number
    message: string
    last_check?: string
}

export interface DuplicateCheckResult {
    has_duplicates: boolean
    duplicates: Array<{
        id: string
        text: string
        similarity_score: number
        tags: string[]
        used_in_assessments: number
    }>
}

export interface CacheMetrics {
    total_questions: number
    cached_questions: number
    cache_hit_rate: number
    total_requests: number
    cache_hits: number
    cache_misses: number
    estimated_cost_savings: number
}

export interface TopReusedQuestion {
    id: string
    text: string
    usage_count: number
    tags: string[]
    avg_score?: number
}

// ============================================================================
// HOOK: useLLMHealth
// ============================================================================

/**
 * Monitors LLM service health status
 * 
 * @param autoRefresh - Whether to auto-refresh every 5 minutes (default: true)
 * @returns Health status and refresh function
 */
export function useLLMHealth(autoRefresh: boolean = true) {
    const [status, setStatus] = useState<LLMHealthStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const checkHealth = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const data = await apiFetch<LLMHealthStatus>('/api/utils/llm-health')
            setStatus(data)
        } catch (err: any) {
            console.error('LLM health check failed:', err)
            setError(err.message || 'Failed to check LLM health')
            setStatus(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        checkHealth()

        if (autoRefresh) {
            const interval = setInterval(checkHealth, 5 * 60 * 1000) // Every 5 minutes
            return () => clearInterval(interval)
        }
    }, [checkHealth, autoRefresh])

    return {
        status,
        loading,
        error,
        refresh: checkHealth
    }
}

// ============================================================================
// HOOK: useDuplicateCheck
// ============================================================================

/**
 * Checks if a question text is similar to existing questions
 * 
 * @returns Check function and results
 */
export function useDuplicateCheck() {
    const [checking, setChecking] = useState(false)
    const [result, setResult] = useState<DuplicateCheckResult | null>(null)
    const [error, setError] = useState<string | null>(null)

    const checkDuplicate = useCallback(async (questionText: string, tags: string[] = [], skill?: string) => {
        if (!questionText.trim()) {
            setError('Question text is required')
            return null
        }

        setChecking(true)
        setError(null)

        try {
            // Derive skill from first tag if not provided
            const derivedSkill = skill || (tags.length > 0 ? tags[0] : 'general')

            const data = await apiFetch<DuplicateCheckResult>(
                '/api/admin/questions/check-duplicate',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        text: questionText,
                        question_text: questionText,
                        skill: derivedSkill,
                        tags
                    })
                }
            )

            setResult(data)
            return data
        } catch (err: any) {
            console.error('Duplicate check failed:', err)
            setError(err.message || 'Failed to check for duplicates')
            return null
        } finally {
            setChecking(false)
        }
    }, [])

    const reset = useCallback(() => {
        setResult(null)
        setError(null)
    }, [])

    return {
        checkDuplicate,
        checking,
        result,
        error,
        reset
    }
}

// ============================================================================
// HOOK: useCacheMetrics
// ============================================================================

/**
 * Fetches cache performance metrics for question deduplication
 * 
 * @param autoRefresh - Whether to auto-refresh every 30 seconds (default: false)
 * @returns Cache metrics and refresh function
 */
export function useCacheMetrics(autoRefresh: boolean = false) {
    const [metrics, setMetrics] = useState<CacheMetrics | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchMetrics = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const data = await apiFetch<CacheMetrics>('/api/admin/analytics/cache-metrics')
            setMetrics(data)
        } catch (err: any) {
            console.error('Failed to fetch cache metrics:', err)
            setError(err.message || 'Failed to fetch metrics')
            setMetrics(null)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchMetrics()

        if (autoRefresh) {
            const interval = setInterval(fetchMetrics, 30 * 1000) // Every 30 seconds
            return () => clearInterval(interval)
        }
    }, [fetchMetrics, autoRefresh])

    return {
        metrics,
        loading,
        error,
        refresh: fetchMetrics
    }
}

// ============================================================================
// HOOK: useTopReusedQuestions
// ============================================================================

/**
 * Fetches the most frequently reused questions
 * 
 * @param limit - Number of questions to fetch (default: 10)
 * @returns Top reused questions and refresh function
 */
export function useTopReusedQuestions(limit: number = 10) {
    const [questions, setQuestions] = useState<TopReusedQuestion[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const fetchQuestions = useCallback(async () => {
        setLoading(true)
        setError(null)

        try {
            const data = await apiFetch<{ questions: TopReusedQuestion[] }>(
                `/api/admin/analytics/top-reused-questions?limit=${limit}`
            )
            setQuestions(data.questions || [])
        } catch (err: any) {
            console.error('Failed to fetch top reused questions:', err)
            setError(err.message || 'Failed to fetch questions')
            setQuestions([])
        } finally {
            setLoading(false)
        }
    }, [limit])

    useEffect(() => {
        fetchQuestions()
    }, [fetchQuestions])

    return {
        questions,
        loading,
        error,
        refresh: fetchQuestions
    }
}
