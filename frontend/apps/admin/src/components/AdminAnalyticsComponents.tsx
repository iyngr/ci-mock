/**
 * Admin Analytics & Monitoring Components
 * 
 * Reusable UI components for admin-facing analytics and monitoring features:
 * - LLM health status indicators
 * - Question duplicate detection modals
 * - Analytics dashboard components (metrics cards, top reused questions)
 * - Cache performance visualization
 * 
 * @module AdminAnalyticsComponents
 */

import React from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, CheckCircle, Clock, TrendingUp, Database, Zap } from 'lucide-react'

// ============================================================================
// LLM Health Status Component
// ============================================================================

export interface LLMHealthStatus {
    healthy: boolean
    models_available: number
    total_models: number
    response_time_ms: number
    message: string
    last_check?: string
}

interface LLMHealthIndicatorProps {
    status: LLMHealthStatus | null
    loading: boolean
    onRefresh?: () => void
}

export function LLMHealthIndicator({ status, loading, onRefresh }: LLMHealthIndicatorProps) {
    if (loading) {
        return (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                <span className="text-sm text-gray-600">Checking LLM health...</span>
            </div>
        )
    }

    if (!status) return null

    const isHealthy = status.healthy
    const bgColor = isHealthy ? 'bg-green-50' : 'bg-red-50'
    const borderColor = isHealthy ? 'border-green-200' : 'border-red-200'
    const textColor = isHealthy ? 'text-green-800' : 'text-red-800'
    const iconColor = isHealthy ? 'text-green-600' : 'text-red-600'

    return (
        <div className={`${bgColor} border ${borderColor} rounded-lg p-4`}>
            <div className="flex items-start justify-between">
                <div className="flex items-start gap-3 flex-1">
                    <div className={`mt-0.5 ${iconColor}`}>
                        {isHealthy ? (
                            <CheckCircle className="w-5 h-5" />
                        ) : (
                            <AlertCircle className="w-5 h-5" />
                        )}
                    </div>
                    <div className="flex-1">
                        <h4 className={`font-medium ${textColor} mb-1`}>
                            LLM Service {isHealthy ? 'Operational' : 'Degraded'}
                        </h4>
                        <p className="text-sm text-gray-600 mb-2">{status.message}</p>
                        <div className="flex flex-wrap gap-4 text-xs text-gray-500">
                            <span>Models: {status.models_available}/{status.total_models}</span>
                            <span>Response: {status.response_time_ms}ms</span>
                            {status.last_check && (
                                <span>Checked: {new Date(status.last_check).toLocaleTimeString()}</span>
                            )}
                        </div>
                    </div>
                </div>
                {onRefresh && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onRefresh}
                        className="ml-3"
                    >
                        Refresh
                    </Button>
                )}
            </div>
        </div>
    )
}

// ============================================================================
// Question Generation Progress Component
// ============================================================================

interface QuestionGenerationProgressProps {
    totalQuestions: number
    generatedQuestions: number
    status: 'queued' | 'generating' | 'complete' | 'failed'
    estimatedTimeRemaining?: number
}

export function QuestionGenerationProgress({
    totalQuestions,
    generatedQuestions,
    status,
    estimatedTimeRemaining
}: QuestionGenerationProgressProps) {
    const percentage = totalQuestions > 0 ? Math.round((generatedQuestions / totalQuestions) * 100) : 0

    const getStatusColor = () => {
        switch (status) {
            case 'complete':
                return 'bg-green-500'
            case 'failed':
                return 'bg-red-500'
            case 'generating':
                return 'bg-blue-500'
            default:
                return 'bg-gray-400'
        }
    }

    const getStatusText = () => {
        switch (status) {
            case 'queued':
                return 'Queued for generation...'
            case 'generating':
                return `Generating questions (${generatedQuestions}/${totalQuestions})...`
            case 'complete':
                return 'All questions generated successfully'
            case 'failed':
                return 'Generation failed - please retry'
        }
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">{getStatusText()}</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{percentage}%</span>
            </div>

            <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                <div
                    className={`h-2 rounded-full transition-all duration-500 ${getStatusColor()}`}
                    style={{ width: `${percentage}%` }}
                />
            </div>

            {estimatedTimeRemaining && status === 'generating' && (
                <p className="text-xs text-gray-500 mt-2">
                    Estimated time remaining: ~{Math.ceil(estimatedTimeRemaining / 60)} minutes
                </p>
            )}
        </div>
    )
}

// ============================================================================
// Duplicate Question Warning Component
// ============================================================================

export interface DuplicateQuestion {
    id: string
    text: string
    similarity_score: number
    tags: string[]
    used_in_assessments: number
}

interface DuplicateWarningProps {
    duplicates: DuplicateQuestion[]
    onReuseExisting: (questionId: string) => void
    onAddAnyway: () => void
    onCancel: () => void
}

export function DuplicateWarning({
    duplicates,
    onReuseExisting,
    onAddAnyway,
    onCancel
}: DuplicateWarningProps) {
    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto shadow-2xl">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-amber-600" />
                    </div>
                    <div>
                        <h3 className="text-xl font-medium text-gray-900">Potential Duplicate Questions</h3>
                        <p className="text-sm text-gray-600">
                            We found {duplicates.length} similar question{duplicates.length > 1 ? 's' : ''} in the database
                        </p>
                    </div>
                </div>

                <div className="space-y-4 mb-6">
                    {duplicates.map((dup) => (
                        <div
                            key={dup.id}
                            className="bg-gray-50 border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                        >
                            <div className="flex items-start justify-between mb-2">
                                <p className="text-sm text-gray-900 flex-1 font-medium">{dup.text}</p>
                                <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded ml-3">
                                    {Math.round(dup.similarity_score * 100)}% match
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                                <span>Tags: {dup.tags.join(', ')}</span>
                                <span>Used: {dup.used_in_assessments} times</span>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onReuseExisting(dup.id)}
                                className="w-full"
                            >
                                Reuse This Question
                            </Button>
                        </div>
                    ))}
                </div>

                <div className="flex gap-3">
                    <Button variant="outline" onClick={onCancel} className="flex-1">
                        Cancel
                    </Button>
                    <Button onClick={onAddAnyway} className="flex-1 bg-amber-600 hover:bg-amber-700">
                        Add New Question Anyway
                    </Button>
                </div>
            </div>
        </div>
    )
}

// ============================================================================
// Analytics Card Components
// ============================================================================

interface AnalyticsCardProps {
    title: string
    value: string | number
    subtitle?: string
    icon: React.ReactNode
    trend?: {
        value: number
        label: string
    }
    color?: 'blue' | 'green' | 'purple' | 'orange'
}

export function AnalyticsCard({ title, value, subtitle, icon, trend, color = 'blue' }: AnalyticsCardProps) {
    const colorMap = {
        blue: 'bg-blue-100 text-blue-600',
        green: 'bg-green-100 text-green-600',
        purple: 'bg-purple-100 text-purple-600',
        orange: 'bg-orange-100 text-orange-600'
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-4">
                <div className={`w-12 h-12 rounded-lg ${colorMap[color]} flex items-center justify-center`}>
                    {icon}
                </div>
                {trend && (
                    <div className="flex items-center gap-1 text-green-600">
                        <TrendingUp className="w-4 h-4" />
                        <span className="text-sm font-medium">+{trend.value}%</span>
                    </div>
                )}
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-1">{value}</h3>
            <p className="text-sm font-medium text-gray-700 mb-1">{title}</p>
            {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
    )
}

// ============================================================================
// Top Reused Questions Component
// ============================================================================

export interface TopReusedQuestion {
    id: string
    text: string
    usage_count: number
    tags: string[]
    avg_score?: number
}

interface TopReusedQuestionsProps {
    questions: TopReusedQuestion[]
    loading: boolean
}

export function TopReusedQuestions({ questions, loading }: TopReusedQuestionsProps) {
    if (loading) {
        return (
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">Most Reused Questions</h3>
                <div className="flex items-center justify-center py-8">
                    <div className="w-6 h-6 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                </div>
            </div>
        )
    }

    return (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
                <Database className="w-5 h-5 text-gray-500" />
                Most Reused Questions
            </h3>
            <div className="space-y-3">
                {questions.map((q, idx) => (
                    <div key={q.id} className="flex items-start gap-3 pb-3 border-b border-gray-100 last:border-0">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-gray-600">{idx + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 font-medium mb-1 truncate">{q.text}</p>
                            <div className="flex items-center gap-3 text-xs text-gray-500">
                                <span className="flex items-center gap-1">
                                    <Zap className="w-3 h-3" />
                                    {q.usage_count} uses
                                </span>
                                {q.avg_score !== undefined && (
                                    <span>Avg score: {q.avg_score.toFixed(1)}/10</span>
                                )}
                            </div>
                            <div className="flex flex-wrap gap-1 mt-2">
                                {q.tags.slice(0, 3).map((tag) => (
                                    <span key={tag} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
