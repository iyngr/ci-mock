"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"

interface AssessmentReport {
    id: string
    candidateName: string
    candidateEmail: string
    role: string
    status: "completed" | "in-progress" | "expired"
    score?: number
    completedAt?: string
    duration?: number
    totalQuestions: number
    correctAnswers?: number
}

export default function ReportsPage() {
    const [reports, setReports] = useState<AssessmentReport[]>([])
    const [filteredReports, setFilteredReports] = useState<AssessmentReport[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState("")
    const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "in-progress" | "expired">("all")
    const router = useRouter()

    useEffect(() => {
        // Check if admin is logged in
        const token = localStorage.getItem("adminToken")
        if (!token) {
            router.push("/admin")
            return
        }

        fetchReports()
    }, [router])

    useEffect(() => {
        // Filter reports based on search and status
        let filtered = reports

        if (searchTerm) {
            filtered = filtered.filter(
                report =>
                    report.candidateName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    report.candidateEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    report.role.toLowerCase().includes(searchTerm.toLowerCase())
            )
        }

        if (statusFilter !== "all") {
            filtered = filtered.filter(report => report.status === statusFilter)
        }

        setFilteredReports(filtered)
    }, [reports, searchTerm, statusFilter])

    const fetchReports = async () => {
        try {
            setLoading(true)

            // Mock data for now - replace with actual API call
            const mockReports: AssessmentReport[] = [
                {
                    id: "1",
                    candidateName: "John Doe",
                    candidateEmail: "john.doe@example.com",
                    role: "Python Backend Developer",
                    status: "completed",
                    score: 85,
                    completedAt: "2024-03-15T10:30:00Z",
                    duration: 120,
                    totalQuestions: 10,
                    correctAnswers: 8
                },
                {
                    id: "2",
                    candidateName: "Jane Smith",
                    candidateEmail: "jane.smith@example.com",
                    role: "React Frontend Developer",
                    status: "completed",
                    score: 92,
                    completedAt: "2024-03-14T14:20:00Z",
                    duration: 105,
                    totalQuestions: 12,
                    correctAnswers: 11
                },
                {
                    id: "3",
                    candidateName: "Mike Johnson",
                    candidateEmail: "mike.johnson@example.com",
                    role: "Full Stack JavaScript Developer",
                    status: "in-progress",
                    totalQuestions: 15
                },
                {
                    id: "4",
                    candidateName: "Sarah Wilson",
                    candidateEmail: "sarah.wilson@example.com",
                    role: "DevOps Engineer",
                    status: "expired",
                    totalQuestions: 8
                }
            ]

            // Simulate API delay
            setTimeout(() => {
                setReports(mockReports)
                setLoading(false)
            }, 500)

        } catch (error) {
            console.error("Failed to fetch reports:", error)
            setLoading(false)
        }
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        })
    }

    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60)
        const mins = minutes % 60
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "completed":
                return "text-green-600 bg-green-50 border-green-200"
            case "in-progress":
                return "text-blue-600 bg-blue-50 border-blue-200"
            case "expired":
                return "text-red-600 bg-red-50 border-red-200"
            default:
                return "text-gray-600 bg-gray-50 border-gray-200"
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-warm-background flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-2 border-warm-brown/20 border-t-warm-brown rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-lg text-warm-brown/70 font-light">Loading reports...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-warm-background">
            <div className="max-w-7xl mx-auto px-6 pt-24 pb-8">{/* Increased top padding to account for floating nav */}
                {/* Header */}
                <AnimateOnScroll animation="fadeInUp" delay={200}>
                    <div className="mb-12">
                        <h1 className="text-4xl lg:text-5xl font-light text-warm-brown mb-4 tracking-tight">
                            Assessment Reports
                        </h1>
                        <div className="w-24 h-px bg-warm-brown/30 mb-4"></div>
                        <p className="text-lg text-warm-brown/60 font-light max-w-2xl">
                            View and analyze assessment results and candidate performance
                        </p>
                    </div>
                </AnimateOnScroll>

                {/* Filters and Search */}
                <AnimateOnScroll animation="fadeInUp" delay={400}>
                    <div className="mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="flex flex-col sm:flex-row gap-4 flex-1">
                            <Input
                                placeholder="Search by name, email, or role..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="max-w-md"
                            />
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value as "all" | "completed" | "in-progress" | "expired")}
                                className="px-4 py-2 rounded-lg border border-warm-brown/20 bg-white text-warm-brown focus:outline-none focus:ring-2 focus:ring-warm-brown/30"
                            >
                                <option value="all">All Status</option>
                                <option value="completed">Completed</option>
                                <option value="in-progress">In Progress</option>
                                <option value="expired">Expired</option>
                            </select>
                        </div>
                        <div className="text-sm text-warm-brown/60">
                            {filteredReports.length} of {reports.length} reports
                        </div>
                    </div>
                </AnimateOnScroll>

                {/* Reports Table */}
                <AnimateOnScroll animation="fadeInUp" delay={600}>
                    <div className="bg-white rounded-2xl shadow-sm border border-warm-brown/10 overflow-hidden">
                        {filteredReports.length === 0 ? (
                            <div className="p-12 text-center">
                                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-warm-brown/5 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-warm-brown/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                </div>
                                <p className="text-warm-brown/60 font-light">No reports found</p>
                                <p className="text-sm text-warm-brown/40 mt-1">
                                    {searchTerm || statusFilter !== "all" ? "Try adjusting your filters" : "Reports will appear here once assessments are completed"}
                                </p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-warm-brown/5 border-b border-warm-brown/10">
                                        <tr>
                                            <th className="px-6 py-4 text-left text-sm font-medium text-warm-brown">Candidate</th>
                                            <th className="px-6 py-4 text-left text-sm font-medium text-warm-brown">Role</th>
                                            <th className="px-6 py-4 text-left text-sm font-medium text-warm-brown">Status</th>
                                            <th className="px-6 py-4 text-left text-sm font-medium text-warm-brown">Score</th>
                                            <th className="px-6 py-4 text-left text-sm font-medium text-warm-brown">Completed</th>
                                            <th className="px-6 py-4 text-left text-sm font-medium text-warm-brown">Duration</th>
                                            <th className="px-6 py-4 text-left text-sm font-medium text-warm-brown">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-warm-brown/5">
                                        {filteredReports.map((report) => (
                                            <tr key={report.id} className="hover:bg-warm-brown/2 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div>
                                                        <div className="font-medium text-warm-brown">{report.candidateName}</div>
                                                        <div className="text-sm text-warm-brown/60">{report.candidateEmail}</div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-warm-brown/80">{report.role}</td>
                                                <td className="px-6 py-4">
                                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(report.status)}`}>
                                                        {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-warm-brown/80">
                                                    {report.score !== undefined ? (
                                                        <span className={`font-medium ${report.score >= 80 ? 'text-green-600' : report.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                                                            {report.score}%
                                                        </span>
                                                    ) : (
                                                        <span className="text-warm-brown/40">-</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-warm-brown/80">
                                                    {report.completedAt ? formatDate(report.completedAt) : <span className="text-warm-brown/40">-</span>}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-warm-brown/80">
                                                    {report.duration ? formatDuration(report.duration) : <span className="text-warm-brown/40">-</span>}
                                                </td>
                                                <td className="px-6 py-4">
                                                    {report.status === "completed" ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => router.push(`/admin/report/${report.id}`)}
                                                            className="text-warm-brown hover:text-warm-brown/80"
                                                        >
                                                            View Details
                                                        </Button>
                                                    ) : (
                                                        <span className="text-warm-brown/40 text-sm">N/A</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </AnimateOnScroll>

                {/* Summary Stats */}
                {reports.length > 0 && (
                    <AnimateOnScroll animation="fadeInUp" delay={800}>
                        <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
                            <div className="bg-white rounded-xl p-6 border border-warm-brown/10">
                                <div className="text-2xl font-light text-warm-brown mb-2">
                                    {reports.length}
                                </div>
                                <div className="text-sm text-warm-brown/60">Total Assessments</div>
                            </div>
                            <div className="bg-white rounded-xl p-6 border border-warm-brown/10">
                                <div className="text-2xl font-light text-green-600 mb-2">
                                    {reports.filter(r => r.status === "completed").length}
                                </div>
                                <div className="text-sm text-warm-brown/60">Completed</div>
                            </div>
                            <div className="bg-white rounded-xl p-6 border border-warm-brown/10">
                                <div className="text-2xl font-light text-blue-600 mb-2">
                                    {reports.filter(r => r.status === "in-progress").length}
                                </div>
                                <div className="text-sm text-warm-brown/60">In Progress</div>
                            </div>
                            <div className="bg-white rounded-xl p-6 border border-warm-brown/10">
                                <div className="text-2xl font-light text-warm-brown mb-2">
                                    {reports.filter(r => r.status === "completed").length > 0
                                        ? Math.round(reports.filter(r => r.score !== undefined).reduce((acc, r) => acc + (r.score || 0), 0) / reports.filter(r => r.score !== undefined).length)
                                        : 0}%
                                </div>
                                <div className="text-sm text-warm-brown/60">Average Score</div>
                            </div>
                        </div>
                    </AnimateOnScroll>
                )}
            </div>
        </div>
    )
}
