"use client"

import { useState, useEffect, useRef } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
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
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-4 text-lg">Loading candidate report...</p>
                </div>
            </div>
        )
    }

    if (!reportData) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <p className="text-xl text-red-600">Report not found</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen assessment-bg">
            {/* Header */}
            <div className="assessment-card border-b m-0 rounded-none p-4">
                <div className="flex justify-between items-center max-w-7xl mx-auto">
                    <div className="flex items-center space-x-4">
                        <h1 className="text-2xl font-bold assessment-text-primary">Candidate Report</h1>
                        <div className="flex space-x-2">
                            <Button
                                variant={currentPage === 1 ? "default" : "outline"}
                                onClick={() => setCurrentPage(1)}
                                size="sm"
                                className={currentPage === 1 ? "btn-assessment-primary" : "btn-assessment-secondary"}
                            >
                                Page 1
                            </Button>
                            <Button
                                variant={currentPage === 2 ? "default" : "outline"}
                                onClick={() => setCurrentPage(2)}
                                size="sm"
                                className={currentPage === 2 ? "btn-assessment-primary" : "btn-assessment-secondary"}
                            >
                                Page 2
                            </Button>
                            <Button
                                variant={currentPage === 3 ? "default" : "outline"}
                                onClick={() => setCurrentPage(3)}
                                size="sm"
                                className={currentPage === 3 ? "btn-assessment-primary" : "btn-assessment-secondary"}
                            >
                                Page 3
                            </Button>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <Button
                            variant="outline"
                            onClick={() => setUseDummyData(!useDummyData)}
                            size="sm"
                        >
                            {useDummyData ? "Use Real Data" : "Use Dummy Data"}
                        </Button>
                        <Button onClick={generatePDF} variant="default" disabled={generating}>
                            {generating ? "Generating PDF..." : "Download PDF"}
                        </Button>
                    </div>
                </div>
            </div>

            {/* Report Content */}
            <div className="max-w-5xl mx-auto p-6">
                <div id="pdf-content" ref={reportRef} className="bg-white rounded-lg shadow-lg">
                    {currentPage === 1 && <AssessmentOverview data={reportData} />}
                    {currentPage === 2 && <TestTakerDetails data={reportData} />}
                    {currentPage === 3 && <SubSkillAnalysis data={reportData} />}
                </div>
            </div>
        </div>
    )
}
