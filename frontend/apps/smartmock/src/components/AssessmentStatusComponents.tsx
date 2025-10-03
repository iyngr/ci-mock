/**
 * Assessment Status Components
 * 
 * Reusable UI components for displaying candidate assessment states:
 * - Generation progress indicators
 * - Grace period warnings
 * - Auto-submission badges
 * - Error and loading states
 * 
 * @module AssessmentStatusComponents
 */

import React from 'react'
import { AlertCircle, AlertTriangle, CheckCircle, Loader2, XCircle } from 'lucide-react'
import { Button } from './ui/button'

// ============================================================================
// COMPONENT: GenerationProgress
// ============================================================================

interface GenerationProgressProps {
    status: 'ready' | 'generating' | 'partially_generated' | 'generation_failed'
    readyQuestions: number
    totalQuestions: number
    message?: string
    onRetry?: () => void
    retryRecommended?: boolean
}

export function GenerationProgress({
    status,
    readyQuestions,
    totalQuestions,
    message,
    onRetry,
    retryRecommended
}: GenerationProgressProps) {
    const progress = totalQuestions > 0 ? (readyQuestions / totalQuestions) * 100 : 0

    // Ready state
    if (status === 'ready') {
        return (
            <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-2">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <h3 className="text-lg font-medium text-green-900">Assessment Ready</h3>
                </div>
                <p className="text-sm text-green-700">
                    All {totalQuestions} questions are ready. You can start the assessment now.
                </p>
            </div>
        )
    }

    // Generating state
    if (status === 'generating') {
        return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
                    <h3 className="text-lg font-medium text-blue-900">Generating Questions</h3>
                </div>

                <p className="text-sm text-blue-700 mb-3">
                    {readyQuestions} of {totalQuestions} questions ready
                </p>

                <div className="w-full bg-blue-100 rounded-full h-2.5 mb-3">
                    <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                <p className="text-xs text-blue-600">
                    Please wait while we prepare your assessment. This usually takes 30-60 seconds.
                </p>
            </div>
        )
    }

    // Partially generated state
    if (status === 'partially_generated') {
        return (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                    <AlertTriangle className="w-6 h-6 text-amber-600" />
                    <h3 className="text-lg font-medium text-amber-900">Partially Generated</h3>
                </div>

                <p className="text-sm text-amber-700 mb-3">
                    Only {readyQuestions} of {totalQuestions} questions were generated successfully.
                </p>

                {message && (
                    <p className="text-xs text-amber-600 mb-3">{message}</p>
                )}

                {retryRecommended && onRetry && (
                    <Button
                        onClick={onRetry}
                        variant="outline"
                        className="mt-2 border-amber-300 text-amber-700 hover:bg-amber-100"
                    >
                        <Loader2 className="w-4 h-4 mr-2" />
                        Retry Generation
                    </Button>
                )}
            </div>
        )
    }

    // Generation failed state
    if (status === 'generation_failed') {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-center gap-3 mb-3">
                    <XCircle className="w-6 h-6 text-red-600" />
                    <h3 className="text-lg font-medium text-red-900">Generation Failed</h3>
                </div>

                <p className="text-sm text-red-700 mb-3">
                    {message || 'Failed to generate assessment questions. Please contact support or try again.'}
                </p>

                <p className="text-xs text-red-600 mb-4">
                    Questions ready: {readyQuestions} of {totalQuestions}
                </p>

                {retryRecommended && onRetry && (
                    <Button
                        onClick={onRetry}
                        variant="destructive"
                        className="mt-2"
                    >
                        <Loader2 className="w-4 h-4 mr-2" />
                        Retry Generation
                    </Button>
                )}
            </div>
        )
    }

    return null
}

// ============================================================================
// COMPONENT: GracePeriodWarning
// ============================================================================

interface GracePeriodWarningProps {
    secondsRemaining: number
    onSubmit?: () => void
}

export function GracePeriodWarning({ secondsRemaining, onSubmit }: GracePeriodWarningProps) {
    return (
        <div className="fixed top-4 right-4 bg-amber-500 text-white p-4 rounded-lg shadow-xl z-50 animate-pulse max-w-sm">
            <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-semibold">Grace Period Active</span>
            </div>
            <p className="text-sm mb-3">
                Time expired! Submit within <strong className="text-lg">{secondsRemaining}s</strong> to avoid auto-submission.
            </p>
            {onSubmit && (
                <Button
                    onClick={onSubmit}
                    variant="secondary"
                    size="sm"
                    className="w-full bg-white text-amber-900 hover:bg-amber-50"
                >
                    Submit Now
                </Button>
            )}
        </div>
    )
}

// ============================================================================
// COMPONENT: AutoSubmissionBadge
// ============================================================================

interface AutoSubmissionBadgeProps {
    reason: string
    timestamp: string
}

export function AutoSubmissionBadge({ reason, timestamp }: AutoSubmissionBadgeProps) {
    const reasonText: Record<string, string> = {
        time_expired: 'Time Expired',
        window_violations: 'Window Exit Violations',
        tab_switch_violations: 'Tab Switch Violations',
        grace_period_expired: 'Grace Period Expired'
    }

    const reasonDescription: Record<string, string> = {
        time_expired: 'Your assessment was automatically submitted because the time limit was reached.',
        window_violations: 'Your assessment was automatically submitted due to multiple attempts to exit the assessment window.',
        tab_switch_violations: 'Your assessment was automatically submitted due to multiple tab switching attempts.',
        grace_period_expired: 'Your assessment was automatically submitted because the grace period expired without manual submission.'
    }

    const title = reasonText[reason] || 'Auto-Submitted'
    const description = reasonDescription[reason] || 'Your assessment was automatically submitted.'

    return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="w-5 h-5 text-amber-600" />
                <span className="font-medium text-amber-900">Auto-Submitted: {title}</span>
            </div>
            <p className="text-sm text-amber-700 mb-2">{description}</p>
            <p className="text-xs text-amber-600">
                Submitted at: {new Date(timestamp).toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                })}
            </p>
        </div>
    )
}

// ============================================================================
// COMPONENT: AssessmentNotReady
// ============================================================================

interface AssessmentNotReadyProps {
    status: string
    message: string
    onRefresh?: () => void
}

export function AssessmentNotReady({ status, message, onRefresh }: AssessmentNotReadyProps) {
    return (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
            <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-gray-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Assessment Not Ready</h3>
            <p className="text-sm text-gray-700 mb-4">{message}</p>
            <p className="text-xs text-gray-600 mb-4">Current status: <strong>{status}</strong></p>
            {onRefresh && (
                <Button
                    onClick={onRefresh}
                    variant="outline"
                    size="sm"
                >
                    <Loader2 className="w-4 h-4 mr-2" />
                    Refresh Status
                </Button>
            )}
        </div>
    )
}

// ============================================================================
// COMPONENT: LoadingSpinner
// ============================================================================

export function LoadingSpinner({ message = 'Loading...' }: { message?: string }) {
    return (
        <div className="flex flex-col items-center justify-center p-8">
            <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
            <p className="text-sm text-gray-600">{message}</p>
        </div>
    )
}
