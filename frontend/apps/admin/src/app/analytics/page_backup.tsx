"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"
import { Button } from "@/components/ui/button"
import { useCacheMetrics, useTopReusedQuestions } from "@/lib/adminHooks"
import { AnalyticsCard, TopReusedQuestions } from "@/components/AdminAnalyticsComponents"
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    RefreshCw,
    Database,
    DollarSign,
    CheckCircle2,
    Activity
} from "lucide-react"

export default function AnalyticsPage() {
    const router = useRouter()
    const [autoRefresh, setAutoRefresh] = useState(true)

    // Fetch cache metrics with auto-refresh every 30 seconds
    const { metrics: cacheMetrics, loading: metricsLoading, refresh: refreshMetrics } = useCacheMetrics(autoRefresh)

    // Fetch top 10 reused questions
    const { questions: topQuestions, loading: questionsLoading, refresh: refreshQuestions } = useTopReusedQuestions(10)

    const handleRefreshAll = () => {
        refreshMetrics()
        refreshQuestions()
    }

    const handleToggleAutoRefresh = () => {
        setAutoRefresh(prev => !prev)
    }

    return (
        <div className="min-h-screen bg-neutral-50">
            {/* Header - Matches dashboard exactly */}
            <header className="bg-white border-b border-neutral-200 sticky top-0 z-50 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <Button
                                onClick={() => router.push("/dashboard")}
                                variant="ghost"
                                size="sm"
                                className="gap-2 text-warm-brown hover:text-warm-brown/80 hover:bg-warm-brown/5"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                Back to Dashboard
                            </Button>
                            <div className="border-l border-neutral-200 pl-4">
                                <h1 className="text-xl font-semibold text-warm-brown">Analytics Dashboard</h1>
                                <p className="text-sm text-warm-brown/60">
                                    Cache performance and question reuse statistics
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Button
                                onClick={handleToggleAutoRefresh}
                                variant={autoRefresh ? "default" : "outline"}
                                size="sm"
                                className="gap-2"
                            >
                                <Activity className={`h-4 w-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
                                Auto-refresh: {autoRefresh ? "ON" : "OFF"}
                            </Button>
                            <Button
                                onClick={handleRefreshAll}
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                disabled={metricsLoading || questionsLoading}
                            >
                                <RefreshCw className={`h-4 w-4 ${(metricsLoading || questionsLoading) ? 'animate-spin' : ''}`} />
                                Refresh All
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content - Matches dashboard layout */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Cache Metrics Section */}
                <AnimateOnScroll>
                    <div className="mb-8">
                        <h2 className="text-lg font-semibold text-warm-brown mb-4 flex items-center gap-2">
                            <Database className="h-5 w-5" />
                            Cache Performance Metrics
                        </h2>

                        {metricsLoading && !cacheMetrics ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6 animate-pulse">
                                        <div className="h-12 bg-neutral-200 rounded mb-2"></div>
                                        <div className="h-4 bg-neutral-200 rounded w-2/3"></div>
                                    </div>
                                ))}
                            </div>
                        ) : cacheMetrics ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                <AnalyticsCard
                                    title="Cache Hit Rate"
                                    value={`${cacheMetrics.cache_hit_rate.toFixed(1)}%`}
                                    subtitle={`${cacheMetrics.cache_hits} hits / ${cacheMetrics.total_requests} requests`}
                                    icon={<CheckCircle2 className="h-6 w-6 text-green-600" />}
                                    color="green"
                                />

                                <AnalyticsCard
                                    title="Total Requests"
                                    value={cacheMetrics.total_requests.toLocaleString()}
                                    subtitle={`${cacheMetrics.cache_hits} cached, ${cacheMetrics.cache_misses} generated`}
                                    icon={<Activity className="h-6 w-6 text-blue-600" />}
                                    color="blue"
                                />

                                <AnalyticsCard
                                    title="Cost Savings"
                                    value={`$${cacheMetrics.estimated_cost_savings.toFixed(2)}`}
                                    subtitle="From cache hits and question reuse"
                                    icon={<DollarSign className="h-6 w-6 text-amber-600" />}
                                    color="orange"
                                />

                                <AnalyticsCard
                                    title="Cached Questions"
                                    value={cacheMetrics.cached_questions.toLocaleString()}
                                    subtitle={`${((cacheMetrics.cached_questions / cacheMetrics.total_questions) * 100).toFixed(1)}% of total questions`}
                                    icon={<Database className="h-6 w-6 text-purple-600" />}
                                    color="purple"
                                />
                            </div>
                        ) : (
                            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6 text-center text-neutral-500">
                                No cache metrics available. Metrics will appear as questions are generated and reused.
                            </div>
                        )}

                        {cacheMetrics && (
                            <div className="mt-4 text-sm text-warm-brown/60">
                                Last updated: {new Date().toLocaleString()}
                                {autoRefresh && " • Auto-refreshing every 30 seconds"}
                            </div>

                        )}
                    </div>
                </AnimateOnScroll>

                {/* Top Reused Questions Section */}
                <AnimateOnScroll>
                    <div>
                        <h2 className="text-lg font-semibold text-warm-brown mb-4 flex items-center gap-2">
                            <TrendingUp className="h-5 w-5" />
                            Most Reused Questions
                        </h2>

                        {questionsLoading && topQuestions.length === 0 ? (
                            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => (
                                        <div key={i} className="animate-pulse">
                                            <div className="h-6 bg-neutral-200 rounded w-3/4 mb-2"></div>
                                            <div className="h-4 bg-neutral-200 rounded w-1/2"></div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : topQuestions.length > 0 ? (
                            <TopReusedQuestions
                                questions={topQuestions}
                                loading={questionsLoading}
                            />
                        ) : (
                            <div className="bg-white rounded-lg border border-neutral-200 shadow-sm p-6 text-center text-neutral-500">
                                No reused questions yet. Questions will appear here as they are reused across assessments.
                            </div>
                        )}
                    </div>
                </AnimateOnScroll>

                {/* Additional Insights Section */}
                <AnimateOnScroll>
                    <div className="mt-8 bg-white rounded-lg border border-neutral-200 shadow-sm p-6">
                        <h3 className="text-lg font-semibold text-warm-brown mb-4 flex items-center gap-2">
                            <Activity className="h-5 w-5" />
                            Analytics Insights
                        </h3>
                        <div className="space-y-3 text-sm text-warm-brown/80">
                            {cacheMetrics && cacheMetrics.cache_hit_rate > 80 && (
                                <div className="flex items-start gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <strong>Excellent cache performance.</strong> Your {cacheMetrics.cache_hit_rate.toFixed(1)}% hit rate
                                        means most questions are being reused, significantly reducing costs.
                                    </div>
                                </div>
                            )}

                            {cacheMetrics && cacheMetrics.cache_hit_rate < 50 && (
                                <div className="flex items-start gap-2">
                                    <TrendingDown className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <strong>Low cache hit rate.</strong> Consider creating more assessments with similar
                                        skills and difficulty levels to increase question reuse and cost savings.
                                    </div>
                                </div>
                            )}

                            {cacheMetrics && cacheMetrics.estimated_cost_savings > 10 && (
                                <div className="flex items-start gap-2">
                                    <DollarSign className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <strong>${cacheMetrics.estimated_cost_savings.toFixed(2)} saved.</strong> Significant costs saved
                                        through caching and deduplication.
                                    </div>
                                </div>
                            )}

                            {topQuestions.length >= 5 && (
                                <div className="flex items-start gap-2">
                                    <Database className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <strong>Active question reuse.</strong> Your top {topQuestions.length} questions have been
                                        used multiple times across assessments.
                                    </div>
                                </div>
                            )}

                            {!cacheMetrics && !topQuestions.length && (
                                <div className="flex items-start gap-2">
                                    <Database className="h-5 w-5 text-warm-brown/40 flex-shrink-0 mt-0.5" />
                                    <div>
                                        Create more assessments to start seeing cache performance metrics and cost savings.
                                        The system will automatically track question reuse and cache efficiency.
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </AnimateOnScroll>
            </main>
        </div>
    )
}
