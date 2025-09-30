"use client"

import { useEffect, useRef } from "react"

interface SubSkillAnalysisProps {
    data: {
        subSkillAnalysis: {
            skillName: string
            score: number
            category: 'unsatisfactory' | 'average' | 'good' | 'exceptional' | 'benchmark'
        }[]
    }
}

export default function SubSkillAnalysis({ data }: SubSkillAnalysisProps) {
    const chartRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        if (chartRef.current) {
            drawSubSkillChart(chartRef.current, data.subSkillAnalysis)
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data])

    const drawSubSkillChart = (canvas: HTMLCanvasElement, skills: typeof data.subSkillAnalysis) => {
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const barHeight = 25
        const barSpacing = 35
        const startY = 20
        const labelWidth = 320
        const maxBarWidth = canvas.width - labelWidth - 100

        skills.forEach((skill, index) => {
            const y = startY + (index * barSpacing)
            const barWidth = (skill.score / 100) * maxBarWidth

            // Background bar
            ctx.fillStyle = '#f3f4f6'
            ctx.fillRect(labelWidth, y, maxBarWidth, barHeight)

            // Score bar
            ctx.fillStyle = getCategoryColor(skill.category)
            ctx.fillRect(labelWidth, y, barWidth, barHeight)

            // Skill name (wrap if too long)
            ctx.fillStyle = '#374151'
            ctx.font = '12px Arial'
            ctx.textAlign = 'right'

            const maxLabelWidth = labelWidth - 10
            const words = skill.skillName.split(' ')
            let line = ''
            let lineY = y + 16

            for (let n = 0; n < words.length; n++) {
                const testLine = line + words[n] + ' '
                const metrics = ctx.measureText(testLine)
                const testWidth = metrics.width

                if (testWidth > maxLabelWidth && n > 0) {
                    ctx.fillText(line, labelWidth - 10, lineY)
                    line = words[n] + ' '
                    lineY += 14
                } else {
                    line = testLine
                }
            }
            ctx.fillText(line, labelWidth - 10, lineY)

            // Score text
            ctx.fillStyle = '#1f2937'
            ctx.font = 'bold 12px Arial'
            ctx.textAlign = 'left'
            ctx.fillText(`${skill.score}`, labelWidth + barWidth + 10, y + 16)
        })
    }

    const getCategoryColor = (category: string) => {
        switch (category) {
            case 'exceptional': return '#3b82f6' // blue
            case 'good': return '#10b981' // green  
            case 'average': return '#f59e0b' // yellow
            case 'unsatisfactory': return '#ef4444' // red
            case 'benchmark': return '#8b5cf6' // purple
            default: return '#6b7280'
        }
    }

    return (
        <div className="p-8">
            {/* Header */}
            <div className="mb-8">
                <h3 className="text-3xl font-bold text-gray-800 mb-2">Sub-Skill Wise Analysis:</h3>
                <div className="w-16 h-1 bg-blue-600"></div>
            </div>

            {/* Chart */}
            <div className="mb-6">
                <canvas
                    ref={chartRef}
                    width={1000}
                    height={data.subSkillAnalysis.length * 35 + 40}
                    className="border border-gray-200 rounded bg-white"
                />
            </div>

            {/* Legend */}
            <div className="text-sm text-gray-600">
                <p className="mb-4 font-medium">Values shown in above chart are percentages</p>
                <div className="flex flex-wrap gap-6">
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

            {/* Skills Summary Table */}
            <div className="mt-8">
                <h3 className="text-xl font-semibold mb-4">Skills Summary</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white border border-gray-200 rounded-lg">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Skill Name
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Score
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Category
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {data.subSkillAnalysis.map((skill, index) => (
                                <tr key={index} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                                        {skill.skillName}
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-900">
                                        {skill.score}%
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${skill.category === 'exceptional' ? 'bg-blue-100 text-blue-800' :
                                            skill.category === 'good' ? 'bg-green-100 text-green-800' :
                                                skill.category === 'average' ? 'bg-yellow-100 text-yellow-800' :
                                                    skill.category === 'unsatisfactory' ? 'bg-red-100 text-red-800' :
                                                        'bg-purple-100 text-purple-800'
                                            }`}>
                                            {skill.category.charAt(0).toUpperCase() + skill.category.slice(1)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
