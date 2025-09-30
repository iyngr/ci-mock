"use client"

import { useEffect, useRef } from "react"

interface TestTakerDetailsProps {
    data: {
        candidateName: string
        email: string
        testTakerId: string
        overallScore: number
        detailedStatus: string
        testFinishTime: string | null
        strengths: string[]
        areasOfDevelopment: string[]
        competencyAnalysis: { name: string; score: number; category: 'unsatisfactory' | 'average' | 'good' | 'exceptional' | 'benchmark' }[]
        lifecycleEvents?: { event: string; timestamp: string }[]
    }
}

export default function TestTakerDetails({ data }: TestTakerDetailsProps) {
    const overallScoreRef = useRef<HTMLCanvasElement>(null)
    const competencyChartRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        // Draw overall score donut chart
        if (overallScoreRef.current) {
            drawOverallScoreChart(overallScoreRef.current, data.overallScore)
        }

        // Draw competency analysis chart
        if (competencyChartRef.current) {
            drawCompetencyChart(competencyChartRef.current, data.competencyAnalysis)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data])

    const drawOverallScoreChart = (canvas: HTMLCanvasElement, score: number) => {
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const centerX = canvas.width / 2
        const centerY = canvas.height / 2
        const radius = Math.min(centerX, centerY) - 20

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        // Background circle
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI)
        ctx.strokeStyle = '#e5e7eb'
        ctx.lineWidth = 20
        ctx.stroke()

        // Score arc
        const scoreAngle = (score / 100) * 2 * Math.PI
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius, -Math.PI / 2, -Math.PI / 2 + scoreAngle)
        ctx.strokeStyle = getScoreColor(score)
        ctx.lineWidth = 20
        ctx.lineCap = 'round'
        ctx.stroke()

        // Score text
        ctx.fillStyle = '#1f2937'
        ctx.font = 'bold 36px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(`${score}%`, centerX, centerY + 10)
    }

    const drawCompetencyChart = (canvas: HTMLCanvasElement, competencies: typeof data.competencyAnalysis) => {
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const barHeight = 30
        const barSpacing = 40
        const startY = 20
        const maxBarWidth = canvas.width - 200

        competencies.forEach((comp, index) => {
            const y = startY + (index * barSpacing)
            const barWidth = (comp.score / 100) * maxBarWidth

            // Background bar
            ctx.fillStyle = '#f3f4f6'
            ctx.fillRect(150, y, maxBarWidth, barHeight)

            // Score bar
            ctx.fillStyle = getCategoryColor(comp.category)
            ctx.fillRect(150, y, barWidth, barHeight)

            // Competency name
            ctx.fillStyle = '#374151'
            ctx.font = '14px Arial'
            ctx.textAlign = 'right'
            ctx.fillText(comp.name, 140, y + 20)

            // Score text
            ctx.fillStyle = '#1f2937'
            ctx.font = 'bold 12px Arial'
            ctx.textAlign = 'left'
            ctx.fillText(`${comp.score}%`, 150 + barWidth + 10, y + 20)
        })
    }

    const getScoreColor = (score: number) => {
        if (score >= 80) return '#10b981' // green
        if (score >= 60) return '#3b82f6' // blue
        if (score >= 40) return '#f59e0b' // yellow
        return '#ef4444' // red
    }

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'exceptional': return '#10b981'
            case 'good': return '#3b82f6'
            case 'average': return '#f59e0b'
            case 'unsatisfactory': return '#ef4444'
            case 'benchmark': return '#8b5cf6'
            default: return '#6b7280'
        }
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <h3 className="text-3xl font-bold text-gray-800 mb-2">Test Taker Details</h3>
                <div className="w-16 h-1 bg-blue-600"></div>
            </div>

            {/* Test Taker Info */}
            <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="bg-blue-50 p-6 rounded-lg">
                    <div className="flex items-center mb-4">
                        <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                            {data.candidateName.charAt(0)}
                        </div>
                        <div className="ml-4">
                            <h2 className="text-xl font-semibold">{data.candidateName}</h2>
                            <p className="text-sm text-gray-600">Email Address: {data.email}</p>
                            <p className="text-sm text-gray-600">Test Taker ID: {data.testTakerId}</p>
                        </div>
                    </div>

                    {/* Removed personal demographic fields */}
                </div>

                <div className="bg-white border border-gray-200 p-6 rounded-lg">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <span className="text-gray-600">Overall Status:</span>
                            <span className="ml-2 font-medium text-green-600">{data.detailedStatus}</span>
                        </div>
                        <div>
                            <span className="text-gray-600">Detailed Status:</span>
                            <span className="ml-2 font-medium">{data.detailedStatus}</span>
                        </div>
                        <div className="col-span-2">
                            <span className="text-gray-600">Test Finish Time:</span>
                            <span className="ml-2 font-medium">{data.testFinishTime || '—'}</span>
                        </div>
                        {data.lifecycleEvents && data.lifecycleEvents.length > 0 && (
                            <div className="col-span-2 mt-4">
                                <span className="text-gray-600 block mb-1">Lifecycle:</span>
                                <ol className="text-xs text-gray-500 space-y-1">
                                    {data.lifecycleEvents.map((e, i) => (<li key={i}>{e.event} • {e.timestamp}</li>))}
                                </ol>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Overall Assessment Score */}
            <div className="mb-8">
                <h3 className="text-2xl font-semibold mb-4">Overall Assessment Score:</h3>
                <div className="flex items-center">
                    <canvas
                        ref={overallScoreRef}
                        width={200}
                        height={200}
                        className="mr-8"
                    />
                    <div className="text-sm text-gray-600">
                        <p className="mb-2">Values shown in above chart are percentages</p>
                        <div className="flex flex-wrap gap-4">
                            <div className="flex items-center">
                                <div className="w-4 h-4 bg-red-500 mr-2"></div>
                                <span>Unsatisfactory(0 - 30)</span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-4 h-4 bg-yellow-500 mr-2"></div>
                                <span>Average(30 - 50)</span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-4 h-4 bg-green-500 mr-2"></div>
                                <span>Good(50 - 80)</span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-4 h-4 bg-blue-500 mr-2"></div>
                                <span>Exceptional(80 - 100)</span>
                            </div>
                            <div className="flex items-center">
                                <div className="w-4 h-4 bg-purple-500 mr-2"></div>
                                <span>Benchmark/Group Average</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Strength and Areas of Development */}
            <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                    <h3 className="text-xl font-semibold mb-4">Strength</h3>
                    {data.strengths.map((strength, index) => (
                        <div key={index} className="flex items-center mb-2">
                            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                {index + 1}
                            </div>
                            <span className="ml-3 font-medium">{strength}</span>
                        </div>
                    ))}
                </div>

                <div>
                    <h3 className="text-xl font-semibold mb-4">Areas of Development</h3>
                    {data.areasOfDevelopment.map((area, index) => (
                        <div key={index} className="flex items-center mb-2">
                            <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                                {index + 1}
                            </div>
                            <span className="ml-3 font-medium">{area}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Competency Wise Analysis */}
            <div>
                <h3 className="text-2xl font-semibold mb-4">Competency Wise Analysis:</h3>
                <canvas
                    ref={competencyChartRef}
                    width={800}
                    height={data.competencyAnalysis.length * 40 + 40}
                    className="border border-gray-200 rounded"
                />
                <div className="mt-4 text-sm text-gray-600">
                    <p className="mb-2">Values shown in above chart are percentages</p>
                    <div className="flex flex-wrap gap-4">
                        <div className="flex items-center">
                            <div className="w-4 h-4 bg-red-500 mr-2"></div>
                            <span>Unsatisfactory(0 - 30)</span>
                        </div>
                        <div className="flex items-center">
                            <div className="w-4 h-4 bg-yellow-500 mr-2"></div>
                            <span>Average(30 - 50)</span>
                        </div>
                        <div className="flex items-center">
                            <div className="w-4 h-4 bg-green-500 mr-2"></div>
                            <span>Good(50 - 80)</span>
                        </div>
                        <div className="flex items-center">
                            <div className="w-4 h-4 bg-blue-500 mr-2"></div>
                            <span>Exceptional(80 - 100)</span>
                        </div>
                        <div className="flex items-center">
                            <div className="w-4 h-4 bg-purple-500 mr-2"></div>
                            <span>Benchmark/Group Average</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
