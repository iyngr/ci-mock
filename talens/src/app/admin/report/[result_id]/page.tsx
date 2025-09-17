"use client"

import { useState, useEffect, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"
import AssessmentOverview from "@/components/report/AssessmentOverview"
import TestTakerDetails from "@/components/report/TestTakerDetails"
import SubSkillAnalysis from "@/components/report/SubSkillAnalysis"

interface ReportData {
    // Page 1 data
    assessmentName: string
    candidateName: string
    testDate: string
    email: string
    testTakerId: string

    // Page 2 data
    overallScore: number
    detailedStatus: string
    testFinishTime: string
    lastName: string
    dateOfBirth: string
    contactNo: string
    gender: string
    country: string
    strengths: string[]
    areasOfDevelopment: string[]
    competencyAnalysis: {
        name: string
        score: number
        category: 'unsatisfactory' | 'average' | 'good' | 'exceptional' | 'benchmark'
    }[]

    // Page 3 data
    subSkillAnalysis: {
        skillName: string
        score: number
        category: 'unsatisfactory' | 'average' | 'good' | 'exceptional' | 'benchmark'
    }[]
}

export default function CandidateReport() {
    const params = useParams()
    const router = useRouter()
    const resultId = params.result_id as string
    const [reportData, setReportData] = useState<ReportData | null>(null)
    const [loading, setLoading] = useState(true)
    const [currentPage, setCurrentPage] = useState(1)
    const [useDummyData, setUseDummyData] = useState(true)
    const [generating, setGenerating] = useState(false)
    const reportRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (useDummyData) {
            // Load dummy data for testing
            setReportData(getDummyReportData())
            setLoading(false)
        } else {
            // Load real data from API
            fetchReportData(resultId)
        }
    }, [resultId, useDummyData])

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

    const getDummyReportData = (): ReportData => ({
        // Page 1
        assessmentName: "Python Django Developer Assessment",
        candidateName: "Abc",
        testDate: "July 25, 2023 12:52:33 PM IST",
        email: "ABC@example.com",
        testTakerId: "121404618",

        // Page 2
        overallScore: 75,
        detailedStatus: "Test-taker Completed",
        testFinishTime: "July 25, 2023 12:52:33 PM IST",
        lastName: "Not Filled",
        dateOfBirth: "Jul 8, 1996",
        contactNo: "Not Filled",
        gender: "Not Filled",
        country: "Not Filled",
        strengths: ["Python Django"],
        areasOfDevelopment: ["Hands On Programming", "Python Basics"],
        competencyAnalysis: [
            { name: "Hands On Programming", score: 30, category: "unsatisfactory" },
            { name: "Python Basics", score: 45, category: "average" },
            { name: "Python Django", score: 95, category: "exceptional" }
        ],

        // Page 3
        subSkillAnalysis: [
            { skillName: "Python - Django Framework - String Manipulations - Analyses", score: 100, category: "exceptional" },
            { skillName: "Python - Django Framework - URL mapping - Application", score: 100, category: "exceptional" },
            { skillName: "CodeSkills", score: 0, category: "unsatisfactory" },
            { skillName: "Python - Django Framework - Views - Analyses", score: 100, category: "exceptional" },
            { skillName: "Python - Django Framework - Lists - Analyses", score: 100, category: "exceptional" },
            { skillName: "Python - Django Framework - Forms - Analyses", score: 100, category: "exceptional" },
            { skillName: "Python - Django Framework - Form Validation - Application", score: 100, category: "exceptional" },
            { skillName: "Python - Django Framework - Filters - Analyses", score: 100, category: "exceptional" },
            { skillName: "Python - Django Framework - Models - Analyses", score: 100, category: "exceptional" },
            { skillName: "Python - Django Framework - Functions", score: 50, category: "good" },
            { skillName: "Python - Django Framework - Views - Application", score: 100, category: "exceptional" },
            { skillName: "Python - Django Framework - Basic Files - Analyses", score: 100, category: "exceptional" },
            { skillName: "Python - Django Framework - Template System - Application", score: 100, category: "exceptional" },
            { skillName: "Python - Django Framework - Object Relational Mappers - Analyses", score: 0, category: "unsatisfactory" },
            { skillName: "Python - Django Framework - Views and URLs Conf - Application", score: 0, category: "unsatisfactory" },
            { skillName: "Python - Django Framework - Models - Application", score: 100, category: "exceptional" }
        ]
    })

    const generatePDF = async () => {
        if (!reportData || !reportRef.current) return

        setGenerating(true)

        try {
            // Dynamic import to avoid SSR issues
            const html2canvas = (await import('html2canvas')).default
            const jsPDF = (await import('jspdf')).jsPDF

            const pdf = new jsPDF('p', 'mm', 'a4')
            const pageWidth = pdf.internal.pageSize.getWidth()

            // Generate PDF for each page
            for (let page = 1; page <= 3; page++) {
                setCurrentPage(page)

                // Wait for page to render
                await new Promise(resolve => setTimeout(resolve, 1500))

                // Create a simplified version for PDF capture
                const canvas = await html2canvas(reportRef.current, {
                    scale: 1,
                    useCORS: true,
                    allowTaint: false,
                    backgroundColor: '#ffffff',
                    logging: false,
                    removeContainer: true,
                    foreignObjectRendering: false,
                    imageTimeout: 0,
                    onclone: (clonedDoc) => {
                        // Apply PDF-safe styles to the cloned document
                        const clonedElement = clonedDoc.querySelector('#pdf-content') as HTMLElement
                        if (clonedElement) {
                            // Replace any problematic CSS with basic colors
                            const style = clonedDoc.createElement('style')
                            style.textContent = `
                                * {
                                    color: #000000 !important;
                                    background-color: #ffffff !important;
                                }
                                .bg-blue-50 { background-color: #eff6ff !important; }
                                .bg-blue-600 { background-color: #2563eb !important; }
                                .bg-green-500 { background-color: #10b981 !important; }
                                .bg-red-500 { background-color: #ef4444 !important; }
                                .bg-yellow-500 { background-color: #f59e0b !important; }
                                .bg-gray-50 { background-color: #f9fafb !important; }
                                .text-white { color: #ffffff !important; }
                                .text-blue-600 { color: #2563eb !important; }
                                .text-green-600 { color: #059669 !important; }
                                .text-red-600 { color: #dc2626 !important; }
                            `
                            clonedDoc.head.appendChild(style)
                        }
                    }
                })

                const imgData = canvas.toDataURL('image/png', 0.95)
                const imgWidth = pageWidth - 20
                const imgHeight = (canvas.height * imgWidth) / canvas.width

                if (page > 1) pdf.addPage()

                pdf.addImage(imgData, 'PNG', 10, 10, imgWidth, Math.min(imgHeight, 270))
            }

            // Download the PDF
            pdf.save(`candidate-report-${reportData.candidateName}-${resultId}.pdf`)

        } catch (error) {
            console.error('Error generating PDF:', error)
            const errorMessage = error instanceof Error ? error.message : 'Unknown error'
            alert(`PDF generation failed: ${errorMessage}. Please try again.`)
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
        <div className="min-h-screen bg-warm-background">
            {/* Header */}
            <div className="bg-white/60 backdrop-blur-sm border-b border-warm-brown/10 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <AnimateOnScroll animation="fadeInUp" delay={200}>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center space-x-6">
                                <Button
                                    variant="ghost"
                                    onClick={() => router.push("/admin/dashboard")}
                                    className="text-warm-brown/60 hover:text-warm-brown"
                                >
                                    ← Dashboard
                                </Button>

                                <div>
                                    <h1 className="text-2xl font-light text-warm-brown tracking-tight">
                                        Candidate Report
                                    </h1>
                                    <div className="w-16 h-px bg-warm-brown/30 mt-1"></div>
                                </div>

                                <div className="flex space-x-2">
                                    {[1, 2, 3].map((page) => (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${currentPage === page
                                                    ? "bg-warm-brown text-white shadow-lg"
                                                    : "text-warm-brown/60 hover:text-warm-brown hover:bg-warm-brown/5"
                                                }`}
                                        >
                                            Page {page}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex items-center space-x-3">
                                <Button
                                    variant="ghost"
                                    onClick={() => setUseDummyData(!useDummyData)}
                                    size="sm"
                                    className="text-warm-brown/60 hover:text-warm-brown text-xs"
                                >
                                    {useDummyData ? "Use Real Data" : "Use Dummy Data"}
                                </Button>
                                <Button
                                    onClick={generatePDF}
                                    disabled={generating}
                                    className="h-10 px-6"
                                >
                                    {generating ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                                            Generating...
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2">
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                            Download PDF
                                        </div>
                                    )}
                                </Button>
                            </div>
                        </div>
                    </AnimateOnScroll>
                </div>
            </div>

            {/* Report Content */}
            <div className="max-w-6xl mx-auto px-6 py-8">
                <AnimateOnScroll animation="fadeInUp" delay={400}>
                    <div id="pdf-content" ref={reportRef} className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl shadow-lg overflow-hidden">
                        {currentPage === 1 && <AssessmentOverview data={reportData} />}
                        {currentPage === 2 && <TestTakerDetails data={reportData} />}
                        {currentPage === 3 && <SubSkillAnalysis data={reportData} />}
                    </div>
                </AnimateOnScroll>
            </div>
        </div>
    )
}
