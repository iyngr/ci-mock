/**
 * Admin Phase 6 Components
 * 
 * Reusable UI components for admin app Phase 6 features
 */

import React from 'react'
import { AlertCircle, CheckCircle2, Clock, TrendingUp, DollarSign } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { LLMHealthStatus, DuplicateCheckResult, CacheAnalytics } from '@/lib/hooks'
import { formatCostSavings, formatPercentage, formatLatency } from '@/lib/hooks'

// ============================================================================
// COMPONENT: LLMHealthIndicator
// Shows LLM service health status for question generation
// ============================================================================

interface LLMHealthIndicatorProps {
    health: LLMHealthStatus | null
    loading: boolean
    error: string | null
    onRefresh?: () => void
}

export function LLMHealthIndicator({ health, loading, error, onRefresh }: LLMHealthIndicatorProps) {
    if (loading) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-gray-400 rounded-full animate-pulse"></div>
                <span>Checking LLM health...</span>
            </div>
        )
    }

    if (error || !health) {
        return (
            <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-red-500" />
                <span className="text-red-600">LLM service unavailable</span>
                {onRefresh && (
                    <Button onClick={onRefresh} variant="ghost" size="sm" className="text-xs">
                        Retry
                    </Button>
                )}
            </div>
        )
    }

    if (!health.healthy) {
        return (
            <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-yellow-500" />
                <span className="text-yellow-600">
                    LLM degraded ({formatLatency(health.latency_ms)})
                </span>
                {onRefresh && (
                    <Button onClick={onRefresh} variant="ghost" size="sm" className="text-xs">
                        Retry
                    </Button>
                )}
            </div>
        )
    }

    return (
        <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            <span className="text-green-600">
                LLM healthy ({formatLatency(health.latency_ms)})
            </span>
            <span className="text-gray-400 text-xs">• {health.model}</span>
        </div>
    )
}

// ============================================================================
// COMPONENT: DuplicateWarning
// Shows warning when duplicate question is detected
// ============================================================================

interface DuplicateWarningProps {
    result: DuplicateCheckResult
    onReuse?: () => void
    onProceed?: () => void
}

export function DuplicateWarning({ result, onReuse, onProceed }: DuplicateWarningProps) {
    if (!result.is_duplicate) {
        return (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />
                    <div>
                        <p className="text-sm font-medium text-green-800">No Duplicates Found</p>
                        <p className="text-xs text-green-700 mt-1">
                            This appears to be a unique question. You can proceed with adding it.
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div className="flex-1">
                    <p className="text-sm font-medium text-yellow-800">
                        Possible Duplicate ({Math.round(result.similarity_score * 100)}% similar)
                    </p>

                    {result.existing_question && (
                        <div className="mt-2 bg-white/50 rounded p-2 text-xs">
                            <p className="text-gray-600 font-medium">Existing question:</p>
                            <p className="text-gray-700 mt-1">"{result.existing_question.text}"</p>
                            <p className="text-gray-500 mt-1 text-[10px]">
                                Added {new Date(result.existing_question.created_at).toLocaleDateString()}
                            </p>
                        </div>
                    )}

                    {result.recommendations && result.recommendations.length > 0 && (
                        <div className="mt-2">
                            <p className="text-xs text-yellow-700 font-medium">Recommendations:</p>
                            <ul className="list-disc list-inside text-xs text-yellow-700 mt-1 space-y-0.5">
                                {result.recommendations.map((rec, idx) => (
                                    <li key={idx}>{rec}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="flex gap-2 mt-3">
                        {onReuse && result.existing_question && (
                            <Button onClick={onReuse} variant="outline" size="sm" className="text-xs">
                                Reuse Existing
                            </Button>
                        )}
                        {onProceed && (
                            <Button onClick={onProceed} variant="default" size="sm" className="text-xs">
                                Add Anyway
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// COMPONENT: CacheMetricsCard
// Displays cache performance analytics
// ============================================================================

interface CacheMetricsCardProps {
    analytics: CacheAnalytics
}

export function CacheMetricsCard({ analytics }: CacheMetricsCardProps) {
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Cache Performance
                </h3>

                <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* Hit Rate */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-green-800">Hit Rate</span>
                            <CheckCircle2 className="w-4 h-4 text-green-600" />
                        </div>
                        <p className="text-2xl font-bold text-green-900">
                            {formatPercentage(analytics.hit_rate)}
                        </p>
                        <p className="text-xs text-green-700 mt-1">
                            {analytics.cache_hits} of {analytics.total_requests} requests
                        </p>
                    </div>

                    {/* Cost Savings */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-blue-800">Cost Savings</span>
                            <DollarSign className="w-4 h-4 text-blue-600" />
                        </div>
                        <p className="text-2xl font-bold text-blue-900">
                            {formatCostSavings(analytics.cost_savings_usd)}
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                            Saved by caching
                        </p>
                    </div>
                </div>

                {/* Top Cached Questions */}
                {analytics.top_cached_questions && analytics.top_cached_questions.length > 0 && (
                    <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            Top Reused Questions
                        </h4>
                        <div className="space-y-2">
                            {analytics.top_cached_questions.slice(0, 5).map((q, idx) => (
                                <div key={idx} className="bg-gray-50 border border-gray-200 rounded p-3">
                                    <p className="text-sm text-gray-800 line-clamp-2">{q.question_text}</p>
                                    <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                                        <span className="font-medium">{q.usage_count} uses</span>
                                        <span className="text-gray-400">•</span>
                                        <span>Last: {new Date(q.last_used).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

// ============================================================================
// COMPONENT: GenerationStatusBadge
// Shows question generation status with visual indicator
// ============================================================================

interface GenerationStatusBadgeProps {
    status: 'generating' | 'ready' | 'partially_generated' | 'generation_failed'
    readyCount?: number
    totalCount?: number
}

export function GenerationStatusBadge({ status, readyCount, totalCount }: GenerationStatusBadgeProps) {
    const statusConfig = {
        generating: {
            color: 'bg-blue-100 text-blue-800 border-blue-200',
            icon: <Clock className="w-3 h-3" />,
            label: 'Generating',
        },
        ready: {
            color: 'bg-green-100 text-green-800 border-green-200',
            icon: <CheckCircle2 className="w-3 h-3" />,
            label: 'Ready',
        },
        partially_generated: {
            color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            icon: <AlertCircle className="w-3 h-3" />,
            label: 'Partial',
        },
        generation_failed: {
            color: 'bg-red-100 text-red-800 border-red-200',
            icon: <AlertCircle className="w-3 h-3" />,
            label: 'Failed',
        },
    }

    const config = statusConfig[status]

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${config.color}`}>
            {config.icon}
            <span>{config.label}</span>
            {readyCount !== undefined && totalCount !== undefined && (
                <span className="text-[10px] opacity-75">({readyCount}/{totalCount})</span>
            )}
        </span>
    )
}
