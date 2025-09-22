"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"
import AssessmentOverview from "@/components/report/AssessmentOverview"
import TestTakerDetails from "@/components/report/TestTakerDetails"
import SubSkillAnalysis from "@/components/report/SubSkillAnalysis"

interface ReportData {
    assessmentName: string
    candidateName: string
    testDate: string | null
    email: string
    testTakerId: string
    overallScore: number
    detailedStatus: string
    testFinishTime: string | null
    strengths: string[]
    areasOfDevelopment: string[]
    competencyAnalysis: { name: string; score: number; category: 'unsatisfactory' | 'average' | 'good' | 'exceptional' | 'benchmark' }[]
    subSkillAnalysis: { skillName: string; score: number; category: 'unsatisfactory' | 'average' | 'good' | 'exceptional' | 'benchmark' }[]
    lifecycleEvents?: { event: string; timestamp: string }[]
}

export default function CandidateReport() {
    const params = useParams()
    const router = useRouter()
    const resultId = params.result_id as string
    const [reportData, setReportData] = useState<ReportData | null>(null)
    const [loading, setLoading] = useState(true)
    // Removed dummy toggle; always fetch real data
    const [generating, setGenerating] = useState(false)
    const reportRef = useRef<HTMLDivElement>(null)

    useEffect(() => { fetchReportData(resultId) }, [resultId])

    const fetchReportData = async (id: string) => {
        try {
            const adminToken = localStorage.getItem("adminToken")

            if (!adminToken) {
                console.error("No admin token found")
                setLoading(false)
                return
            }

            const response = await fetch(`http://localhost:8000/api/admin/report/${id}`, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${adminToken}`
                }
            })
            const data = await response.json()

            if (data.success) {
                setReportData(data.report)
            }
        } catch (error) {
            console.error("Failed to fetch report data:", error)
        } finally {
            setLoading(false)
        }
    }

    // Removed dummy data generator

    const generatePDF = async () => {
        if (!reportData) return
        setGenerating(true)
        try {
            const { jsPDF } = await import('jspdf')
            // We'll also use a lightweight in-browser canvas for drawing charts (no external libs)

            // Color palette consistent with categories
            const categoryColors: Record<string, string> = {
                unsatisfactory: '#d32f2f',
                average: '#f57c00',
                good: '#1976d2',
                exceptional: '#2e7d32',
                benchmark: '#6d28d9'
            }

            const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
            const pageWidth = pdf.internal.pageSize.getWidth()
            const pageHeight = pdf.internal.pageSize.getHeight()
            const marginX = 12
            const marginTop = 14
            const contentWidth = pageWidth - marginX * 2
            let cursorY = marginTop
            const pageNumbers: { page: number }[] = []

            const registerPage = () => { pageNumbers.push({ page: pdf.getNumberOfPages() }) }
            registerPage()

            // Helpers
            const addPageIfNeeded = (needed: number) => {
                if (cursorY + needed > pageHeight - 14) {
                    pdf.addPage();
                    cursorY = marginTop
                }
            }

            const sectionTitle = (title: string) => {
                addPageIfNeeded(10)
                pdf.setFont('helvetica', 'bold')
                pdf.setFontSize(14)
                pdf.text(title, marginX, cursorY)
                cursorY += 6
                pdf.setDrawColor(60)
                pdf.setLineWidth(0.4)
                pdf.line(marginX, cursorY, marginX + contentWidth, cursorY)
                cursorY += 4
            }

            const normalText = (text: string, size = 10, options: { bold?: boolean } = {}) => {
                addPageIfNeeded(6)
                pdf.setFont('helvetica', options.bold ? 'bold' : 'normal')
                pdf.setFontSize(size)
                const lines = pdf.splitTextToSize(text, contentWidth)
                const height = lines.length * 5
                addPageIfNeeded(height)
                pdf.text(lines, marginX, cursorY)
                cursorY += height + 1
            }

            const keyValueRows = (rows: [string, string | number | null | undefined][], cols = 2) => {
                const colWidth = contentWidth / cols
                const rowHeight = 6
                rows.forEach((row, idx) => {
                    const [k, vRaw] = row
                    const v = (vRaw === undefined || vRaw === null || vRaw === '') ? '-' : String(vRaw)
                    addPageIfNeeded(rowHeight)
                    const xBase = marginX + (idx % cols) * colWidth
                    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9)
                    pdf.text(k + ':', xBase, cursorY)
                    pdf.setFont('helvetica', 'normal')
                    pdf.text(v, xBase + 2, cursorY + 4)
                    if ((idx % cols) === cols - 1) cursorY += rowHeight
                })
                if (rows.length % cols !== 0) cursorY += 6
                cursorY += 2
            }

            const table = (headers: string[], rows: (string | number)[][]) => {
                const headerHeight = 7
                const rowHeight = 6
                const colWidths = headers.map(() => Math.floor(contentWidth / headers.length))
                const adjust = contentWidth - colWidths.reduce((a, b) => a + b, 0)
                if (adjust && colWidths.length) colWidths[colWidths.length - 1] += adjust
                // Header
                addPageIfNeeded(headerHeight + rowHeight)
                pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9)
                let x = marginX
                headers.forEach((h, i) => {
                    pdf.text(h, x + 1, cursorY + 5)
                    x += colWidths[i]
                })
                pdf.setDrawColor(30)
                pdf.setLineWidth(0.3)
                pdf.line(marginX, cursorY + headerHeight, marginX + contentWidth, cursorY + headerHeight)
                cursorY += headerHeight
                pdf.setFont('helvetica', 'normal')
                rows.forEach(r => {
                    addPageIfNeeded(rowHeight)
                    let cx = marginX
                    r.forEach((cell, i) => {
                        const txt = String(cell)
                        const truncated = txt.length > 40 ? txt.slice(0, 37) + '...' : txt
                        pdf.text(truncated, cx + 1, cursorY + 4)
                        cx += colWidths[i]
                    })
                    cursorY += rowHeight
                })
                cursorY += 2
            }

            // Header band
            pdf.setFillColor(30, 30, 30)
            pdf.rect(0, 0, pageWidth, 18, 'F')
            pdf.setTextColor(255)
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(16)
            pdf.text(reportData.assessmentName || 'Assessment Report', marginX, 11)
            pdf.setFontSize(10)
            pdf.setFont('helvetica', 'normal')
            pdf.text(`Generated: ${new Date().toLocaleString()}`, pageWidth - marginX, 6, { align: 'right' })
            pdf.text(`Result ID: ${resultId}`, pageWidth - marginX, 11, { align: 'right' })
            pdf.setTextColor(0)
            cursorY = 24

            // Overview section with donut chart for overall score
            const donutSize = 38
            const donutCenterX = marginX + donutSize / 2
            const donutCenterY = cursorY + donutSize / 2
            const score = Math.max(0, Math.min(100, Math.round(reportData.overallScore || 0)))
            // Draw donut via canvas to get an image (avoids arc math duplication)
            const donutCanvas = document.createElement('canvas')
            donutCanvas.width = 200
            donutCanvas.height = 200
            const dctx = donutCanvas.getContext('2d')!
            const radius = 90
            // background track
            dctx.lineWidth = 28
            dctx.strokeStyle = '#eee'
            dctx.beginPath()
            dctx.arc(100, 100, radius, 0, Math.PI * 2)
            dctx.stroke()
            // score arc
            dctx.strokeStyle = '#2563eb'
            dctx.beginPath()
            dctx.arc(100, 100, radius, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * (score / 100)))
            dctx.stroke()
            // inner cutout
            dctx.globalCompositeOperation = 'destination-out'
            dctx.beginPath()
            dctx.arc(100, 100, radius - 40, 0, Math.PI * 2)
            dctx.fill()
            dctx.globalCompositeOperation = 'source-over'
            // Text overlay
            dctx.fillStyle = '#111'
            dctx.font = 'bold 46px sans-serif'
            dctx.textAlign = 'center'
            dctx.textBaseline = 'middle'
            dctx.fillText(String(score), 100, 95)
            dctx.font = '16px sans-serif'
            dctx.fillText('/100', 100, 125)
            const donutImg = donutCanvas.toDataURL('image/png')
            pdf.addImage(donutImg, 'PNG', marginX, cursorY, donutSize, donutSize)

            // Candidate textual details to the right of donut
            pdf.setFontSize(11)
            pdf.setFont('helvetica', 'bold')
            const textBlockX = marginX + donutSize + 6
            pdf.text('Candidate Overview', textBlockX, cursorY + 5)
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(9)
            const details = [
                `Name: ${reportData.candidateName}`,
                `Email: ${reportData.email || '-'}`,
                `Test Date: ${reportData.testDate || '-'}`,
                `Finished: ${reportData.testFinishTime || '-'}`,
                `Status: ${reportData.detailedStatus}`,
            ]
            let dy = 11
            details.forEach(line => { pdf.text(line, textBlockX, cursorY + dy); dy += 5 })
            cursorY += donutSize + 6

            // Legend
            pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10)
            pdf.text('Category Legend', marginX, cursorY)
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9)
            let lx = marginX; let ly = cursorY + 4
            Object.entries(categoryColors).forEach(([cat, color]) => {
                pdf.setFillColor(color)
                pdf.rect(lx, ly, 5, 5, 'F')
                pdf.setTextColor(0)
                pdf.text(cat, lx + 7, ly + 4)
                lx += 32
                if (lx + 30 > marginX + contentWidth) { lx = marginX; ly += 7 }
            })
            cursorY = ly + 10

            // Summary Key/Values
            sectionTitle('Summary')
            keyValueRows([
                ['Test Date', reportData.testDate],
                ['Finished At', reportData.testFinishTime],
                ['Detailed Status', reportData.detailedStatus],
                ['Result ID', resultId],
            ])

            // Strengths & Areas
            sectionTitle('Strengths')
            if (reportData.strengths?.length) {
                reportData.strengths.forEach(s => normalText('• ' + s))
            } else { normalText('No strengths identified.') }

            sectionTitle('Areas of Development')
            if (reportData.areasOfDevelopment?.length) {
                reportData.areasOfDevelopment.forEach(a => normalText('• ' + a))
            } else { normalText('No areas listed.') }

            // Competency Analysis Table
            if (reportData.competencyAnalysis?.length) {
                sectionTitle('Competency Analysis')
                // Bar chart (horizontal) for competencies
                const chartHeight = 6 * reportData.competencyAnalysis.length + 12
                addPageIfNeeded(chartHeight + 10)
                const chartX = marginX
                const chartY = cursorY
                const barAreaWidth = contentWidth * 0.55
                const maxScore = 100
                pdf.setFontSize(8)
                reportData.competencyAnalysis.forEach((c, idx) => {
                    const y = chartY + idx * 6
                    const barWidth = (c.score / maxScore) * (barAreaWidth - 2)
                    pdf.setFillColor(categoryColors[c.category] || '#444')
                    pdf.rect(chartX, y, barWidth, 4, 'F')
                    pdf.setTextColor(255)
                    pdf.text(c.score.toFixed(1), chartX + barWidth - 2, y + 3, { align: 'right' })
                    pdf.setTextColor(0)
                    pdf.text(c.name, chartX + barAreaWidth + 4, y + 3)
                })
                cursorY = chartY + reportData.competencyAnalysis.length * 6 + 6

                // Table version beneath
                const compRows = reportData.competencyAnalysis.map(c => [c.name, c.score.toFixed(1), c.category])
                table(['Competency', 'Score', 'Category'], compRows)
            }

            // Sub Skill Analysis Table
            if (reportData.subSkillAnalysis?.length) {
                sectionTitle('Sub-skill Analysis')
                // Condensed bar chart
                const subset = reportData.subSkillAnalysis.slice(0, 15) // limit to avoid overflow
                const chartHeight = 5 * subset.length + 10
                addPageIfNeeded(chartHeight + 10)
                const chartX = marginX
                const chartY = cursorY
                const barAreaWidth = contentWidth * 0.55
                pdf.setFontSize(7.5)
                subset.forEach((s, idx) => {
                    const y = chartY + idx * 5
                    const barWidth = (s.score / 100) * (barAreaWidth - 2)
                    pdf.setFillColor(categoryColors[s.category] || '#555')
                    pdf.rect(chartX, y, barWidth, 3.5, 'F')
                    pdf.setTextColor(255)
                    pdf.text(s.score.toFixed(1), chartX + barWidth - 1, y + 2.8, { align: 'right' })
                    pdf.setTextColor(0)
                    pdf.text(s.skillName, chartX + barAreaWidth + 4, y + 2.8)
                })
                cursorY = chartY + subset.length * 5 + 6
                const subRows = reportData.subSkillAnalysis.map(s => [s.skillName, s.score.toFixed(1), s.category])
                table(['Sub-skill', 'Score', 'Category'], subRows)
            }

            // Lifecycle events
            if (reportData.lifecycleEvents?.length) {
                sectionTitle('Lifecycle Events')
                reportData.lifecycleEvents.forEach(evt => {
                    normalText(`${evt.timestamp} - ${evt.event}`)
                })
            }

            // Footer & page numbers
            const totalPages = pdf.getNumberOfPages()
            for (let i = 1; i <= totalPages; i++) {
                pdf.setPage(i)
                pdf.setFontSize(8)
                pdf.setTextColor(120)
                pdf.text(`Page ${i} / ${totalPages}`, pageWidth / 2, pageHeight - 8, { align: 'center' })
                pdf.text('Generated programmatically - visualization enhanced', marginX, pageHeight - 8)
            }

            pdf.setPage(totalPages)
            pdf.save(`candidate-report-${reportData.candidateName}-${resultId}.pdf`)
        } catch (e) {
            console.error('PDF generation failed', e)
        } finally {
            setGenerating(false)
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-warm-background flex items-center justify-center">
                <AnimateOnScroll animation="fadeInUp">
                    <div className="text-center">
                        <div className="w-16 h-16 border-4 border-warm-brown/20 border-t-warm-brown rounded-full animate-spin mx-auto mb-6"></div>
                        <p className="text-lg font-light text-warm-brown">Loading candidate report...</p>
                    </div>
                </AnimateOnScroll>
            </div>
        )
    }

    if (!reportData) {
        return (
            <div className="min-h-screen bg-warm-background flex items-center justify-center">
                <AnimateOnScroll animation="fadeInUp">
                    <div className="text-center">
                        <p className="text-xl text-red-600 font-light">Report not found</p>
                        <Button
                            variant="ghost"
                            onClick={() => router.push("/admin/dashboard")}
                            className="mt-4 text-warm-brown/60 hover:text-warm-brown"
                        >
                            ← Back to Dashboard
                        </Button>
                    </div>
                </AnimateOnScroll>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-warm-background relative">
            <div className="max-w-6xl mx-auto px-6 py-12">
                <AnimateOnScroll animation="fadeInUp" delay={300}>
                    <div id="pdf-content" ref={reportRef} className="bg-white/80 backdrop-blur border border-warm-brown/10 rounded-2xl shadow p-8 space-y-10">
                        <AssessmentOverview data={reportData} />
                        <TestTakerDetails data={reportData} />
                        <SubSkillAnalysis data={reportData} />
                    </div>
                </AnimateOnScroll>
            </div>
            <Button onClick={generatePDF} disabled={generating} style={{ position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 1000 }} className="shadow-lg rounded-full h-14 w-14 p-0 flex items-center justify-center" aria-label="Download PDF">
                {generating ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                )}
            </Button>
        </div>
    )
}
