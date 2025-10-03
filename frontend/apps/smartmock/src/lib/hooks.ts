/**
 * Custom hooks for Phase 6: Frontend Integration
 * 
 * These hooks integrate with the backend APIs from Phases 3-5:
 * - Assessment readiness checks (Phase 4)
 * - Timer synchronization (Phase 3)
 * - Auto-submission state (Phase 3)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from './apiClient'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AssessmentReadiness {
    ready: boolean
    status: 'ready' | 'generating' | 'partially_generated' | 'generation_failed'
    total_questions: number
    ready_questions: number
    message: string
    retry_recommended?: boolean
}

export interface TimerSyncResponse {
    time_remaining_seconds: number
    time_expired: boolean
    grace_period_active: boolean
    grace_period_remaining: number
    current_server_time: string
}

export interface SubmissionResponse {
    success: boolean
    submission_id: string
    auto_submitted?: boolean
    auto_submit_reason?: string
    auto_submit_timestamp?: string
    submission_timestamp: string
}

// ============================================================================
// HOOK: useAssessmentReadiness
// ============================================================================

/**
 * Checks if an assessment is ready to start.
 * Polls the backend readiness endpoint and returns current status.
 * 
 * @param testId - Assessment ID
 * @param enabled - Whether to enable polling (default: true)
 * @returns Readiness state and refresh function
 */
export function useAssessmentReadiness(testId: string | null, enabled: boolean = true) {
    const [readiness, setReadiness] = useState<AssessmentReadiness | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const pollCount = useRef(0)

    const checkReadiness = useCallback(async () => {
        if (!testId || !enabled) {
            setLoading(false)
            return
        }

        try {
            const data = await apiFetch<AssessmentReadiness>(
                `/api/candidate/assessment/${testId}/readiness`
            )
            setReadiness(data)
            setError(null)
            pollCount.current = 0 // Reset poll count on success
        } catch (err: any) {
            console.error('Readiness check failed:', err)
            setError(err.message || 'Failed to check assessment readiness')
        } finally {
            setLoading(false)
        }
    }, [testId, enabled])

    useEffect(() => {
        // Initial check
        checkReadiness()

        // Poll if status is 'generating' with exponential backoff
        if (readiness?.status === 'generating') {
            pollCount.current++

            // Exponential backoff: 5s, 7.5s, 11.25s, ... max 30s
            const pollInterval = Math.min(5000 * Math.pow(1.5, pollCount.current), 30000)

            const interval = setInterval(checkReadiness, pollInterval)
            return () => clearInterval(interval)
        }
    }, [checkReadiness, readiness?.status])

    return {
        readiness,
        loading,
        error,
        refresh: checkReadiness
    }
}

// ============================================================================
// HOOK: useTimerSync
// ============================================================================

/**
 * Synchronizes local timer with backend every 60 seconds.
 * Handles grace period and auto-submission triggers.
 * 
 * @param testId - Assessment ID
 * @param enabled - Whether to enable sync (default: true)
 * @returns Timer state and sync function
 */
export function useTimerSync(testId: string | null, enabled: boolean = true) {
    const [timeRemaining, setTimeRemaining] = useState<number>(0)
    const [graceActive, setGraceActive] = useState(false)
    const [graceRemaining, setGraceRemaining] = useState(0)
    const [timeExpired, setTimeExpired] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const lastSyncTime = useRef<number>(Date.now())

    const syncTimer = useCallback(async () => {
        if (!testId || !enabled) return

        setSyncing(true)
        try {
            const data = await apiFetch<TimerSyncResponse>(
                `/api/candidate/assessment/${testId}/timer`
            )

            if (data.time_expired) {
                setTimeExpired(true)

                if (data.grace_period_active) {
                    setGraceActive(true)
                    setGraceRemaining(data.grace_period_remaining)
                } else {
                    // Grace period ended, trigger auto-submission
                    setGraceActive(false)
                    setGraceRemaining(0)
                }
            } else {
                // Smooth sync: only update if difference is > 5 seconds
                const currentTime = timeRemaining
                const newTime = data.time_remaining_seconds
                const diff = Math.abs(newTime - currentTime)

                if (diff > 5 || currentTime === 0) {
                    setTimeRemaining(newTime)
                }

                setTimeExpired(false)
                setGraceActive(false)
            }

            lastSyncTime.current = Date.now()
            setError(null)
        } catch (err: any) {
            console.error('Timer sync failed:', err)
            setError(err.message || 'Failed to sync timer')
        } finally {
            setSyncing(false)
        }
    }, [testId, enabled, timeRemaining])

    useEffect(() => {
        if (!enabled) return

        // Initial sync
        syncTimer()

        // Sync every 60 seconds
        const syncInterval = setInterval(syncTimer, 60000)

        // Local countdown every second
        const countdownInterval = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev <= 0) return 0
                return prev - 1
            })

            if (graceActive) {
                setGraceRemaining(prev => {
                    if (prev <= 0) return 0
                    return prev - 1
                })
            }
        }, 1000)

        return () => {
            clearInterval(syncInterval)
            clearInterval(countdownInterval)
        }
    }, [enabled, syncTimer, graceActive])

    return {
        timeRemaining,
        graceActive,
        graceRemaining,
        timeExpired,
        syncing,
        error,
        syncTimer
    }
}

// ============================================================================
// HOOK: useAutoSubmission
// ============================================================================

/**
 * Handles assessment submission and auto-submission detection.
 * 
 * @param testId - Assessment ID
 * @returns Submission function and state
 */
export function useAutoSubmission(testId: string | null) {
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState(false)
    const [submissionData, setSubmissionData] = useState<SubmissionResponse | null>(null)
    const [error, setError] = useState<string | null>(null)
    const submittingRef = useRef(false) // Prevent double submission

    const submitAssessment = useCallback(async (answers: any[]) => {
        if (!testId || submittingRef.current) return

        submittingRef.current = true
        setSubmitting(true)

        try {
            const data = await apiFetch<SubmissionResponse>(
                `/api/candidate/assessment/${testId}/submit`,
                {
                    method: 'POST',
                    body: JSON.stringify({ answers })
                }
            )

            setSubmissionData(data)
            setSubmitted(true)
            setError(null)

            return data
        } catch (err: any) {
            console.error('Submission failed:', err)
            setError(err.message || 'Failed to submit assessment')
            throw err
        } finally {
            setSubmitting(false)
            submittingRef.current = false
        }
    }, [testId])

    return {
        submitAssessment,
        submitting,
        submitted,
        submissionData,
        error
    }
}

// ============================================================================
// UTILITY: Format time remaining
// ============================================================================

export function formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) return '00:00:00'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    return [hours, minutes, secs]
        .map(n => n.toString().padStart(2, '0'))
        .join(':')
}
