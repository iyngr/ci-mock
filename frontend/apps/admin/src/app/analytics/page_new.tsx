"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { buildApiUrl } from "@/lib/apiClient"
import { Button } from "@/components/ui/button"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"

interface CacheMetrics {
    cache_hit_rate: number
    total_requests: number
    cache_hits: number
    cache_misses: number
    avg_response_time_ms: number
    popular_skills: Array<{ skill: string; count: number }>
    estimated_cost_savings?: number
    cached_questions?: number
    total_questions?: number
}

interface TopReusedQuestion {
    question_id: string
    question_text: string
    skill: string
    type: string
    reuse_count: number
    last_used: string
}

export default function AnalyticsPage() {
    const [cacheMetrics, setCacheMetrics] = useState<CacheMetrics | null>(null)
    const [topQuestions, setTopQuestions] = useState<TopReusedQuestion[]>([])
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)
    const router = useRouter()

    useEffect(() => {
        const token = localStorage.getItem("adminToken")
        if (!token) {
            router.push("/admin")
            return
        }

        fetchAnalytics()
    }, [router])

    const fetchAnalytics = async () => {
        try {
            const adminToken = localStorage.getItem("adminToken")

            // Fetch cache metrics
            const cacheUrl = buildApiUrl('/api/admin/analytics/cache-metrics')
            const cacheResponse = await fetch(cacheUrl, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${adminToken}`
                }
            })

            if (cacheResponse.ok) {
                const cacheData = await cacheResponse.json()
                setCacheMetrics(cacheData)
            }

            // Fetch top reused questions  
            const questionsUrl = buildApiUrl('/api/admin/analytics/top-reused-questions?limit=10')
            const questionsResponse = await fetch(questionsUrl, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${adminToken}`
                }
            })

            if (questionsResponse.ok) {
                const questionsData = await questionsResponse.json()
                setTopQuestions(questionsData.questions || [])
            }

            setLoading(false)
            setRefreshing(false)
        } catch (error) {
            console.error("Failed to fetch analytics:", error)
            setLoading(false)
            setRefreshing(false)
        }
    }

    const handleRefresh = () => {
        setRefreshing(true)
        fetchAnalytics()
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-warm-background flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-warm-brown/20 border-t-warm-brown rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-lg text-warm-brown/70 font-light">Loading analytics...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-warm-background">
            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 pt-24 pb-8">
                {/* Header Section - Matching Dashboard Exactly */}
                <AnimateOnScroll animation="fadeInUp" delay={200}>
                    <div className="mb-12">
                        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
                            <div>
                                <h1 className="text-4xl lg:text-5xl font-light text-warm-brown mb-4 tracking-tight">
                                    Analytics Dashboard
                                </h1>
                                <div className="w-24 h-px bg-warm-brown/30 mb-4"></div>
                                <p className="text-lg text-warm-brown/60 font-light max-w-2xl">
                                    Comprehensive question cache analytics and usage patterns
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <Button
                                    onClick={() => router.push("/dashboard")}
                                    variant="outline"
                                    className="border-warm-brown/20 text-warm-brown hover:bg-warm-brown/5"
                                >
                                    ← Back to Dashboard
                                </Button>
                                <Button
                                    onClick={handleRefresh}
                                    disabled={refreshing}
                                    className="bg-warm-brown hover:bg-warm-brown/90 text-white"
                                >
                                    {refreshing ? "Refreshing..." : "Refresh"}
                                </Button>
                            </div>
                        </div>
                    </div>
                </AnimateOnScroll>

                {/* KPI Cards - Cache Metrics */}
                {cacheMetrics && (
                    <AnimateOnScroll animation="fadeInUp" delay={300}>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                            <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-6 hover:bg-white/80 transition-colors duration-300">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-light text-warm-brown/60 mb-2">Cache Hit Rate</p>
                                        <p className="text-3xl font-light text-warm-brown">
                                            {Math.round(cacheMetrics.cache_hit_rate * 100)}%
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 bg-warm-brown/10 rounded-full flex items-center justify-center">
                                        <span className="text-warm-brown/60 font-light">%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-6 hover:bg-white/80 transition-colors duration-300">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-light text-warm-brown/60 mb-2">Total Requests</p>
                                        <p className="text-3xl font-light text-warm-brown">{cacheMetrics.total_requests}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-warm-brown/10 rounded-full flex items-center justify-center">
                                        <span className="text-warm-brown/60 font-light">R</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-6 hover:bg-white/80 transition-colors duration-300">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-light text-warm-brown/60 mb-2">Cache Hits</p>
                                        <p className="text-3xl font-light text-warm-brown">{cacheMetrics.cache_hits}</p>
                                    </div>
                                    <div className="w-12 h-12 bg-warm-brown/10 rounded-full flex items-center justify-center">
                                        <span className="text-warm-brown/60 font-light">H</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-6 hover:bg-white/80 transition-colors duration-300">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-light text-warm-brown/60 mb-2">Avg Response Time</p>
                                        <p className="text-3xl font-light text-warm-brown">
                                            {Math.round(cacheMetrics.avg_response_time_ms)}ms
                                        </p>
                                    </div>
                                    <div className="w-12 h-12 bg-warm-brown/10 rounded-full flex items-center justify-center">
                                        <span className="text-warm-brown/60 font-light">T</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </AnimateOnScroll>
                )}

                {/* Main Content - Two Column Layout Matching Dashboard */}
                <div className="flex flex-col lg:flex-row gap-6 w-full items-stretch">
                    {/* Popular Skills - Fixed width on desktop */}
                    {cacheMetrics && cacheMetrics.popular_skills && cacheMetrics.popular_skills.length > 0 && (
                        <AnimateOnScroll animation="fadeInUp" delay={400} className="w-full lg:max-w-sm lg:flex-none min-w-0">
                            <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-6 h-full w-full">
                                <h3 className="text-xl font-light text-warm-brown mb-6">Popular Skills</h3>
                                <div className="space-y-3">
                                    {cacheMetrics.popular_skills.slice(0, 10).map((skill, index) => (
                                        <div key={index} className="flex items-center justify-between p-3 bg-white/40 rounded-xl border border-warm-brown/5">
                                            <span className="font-medium text-warm-brown text-sm">{skill.skill}</span>
                                            <span className="text-sm text-warm-brown/60">{skill.count} uses</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </AnimateOnScroll>
                    )}

                    {/* Top Reused Questions - Flexes to fill remaining width */}
                    <AnimateOnScroll animation="fadeInUp" delay={500} className="flex-1 min-w-0">
                        <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-6 h-full w-full min-w-0">
                            <h3 className="text-xl font-light text-warm-brown mb-6">Top Reused Questions</h3>

                            <div className="space-y-3 w-full lg:max-h-[60vh] overflow-y-auto">
                                {topQuestions.length > 0 ? (
                                    topQuestions.map((question, index) => (
                                        <div key={index} className="flex items-center justify-between p-4 bg-white/40 rounded-xl border border-warm-brown/5 hover:bg-white/60 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <p className="font-medium text-warm-brown text-sm truncate">{question.question_text}</p>
                                                <div className="flex items-center gap-4 mt-1">
                                                    <p className="text-xs text-warm-brown/60">{question.skill}</p>
                                                    <p className="text-xs text-warm-brown/50">{question.type}</p>
                                                    {question.last_used && (
                                                        <p className="text-xs text-warm-brown/40">
                                                            Last used: {new Date(question.last_used).toLocaleDateString()}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 ml-4">
                                                <span className="px-3 py-1 rounded-full text-xs font-light border bg-warm-brown/5 text-warm-brown border-warm-brown/20">
                                                    {question.reuse_count} reuses
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-center py-12">
                                        <p className="text-warm-brown/60 font-light">No reused questions yet</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </AnimateOnScroll>
                </div>
            </div>
        </div>
    )
}
