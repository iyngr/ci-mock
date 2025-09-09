"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"
import { TestInitiationRequest } from "@/lib/schema"

// Mock questions for selection
const mockQuestions = [
    { id: "q1", title: "Binary Search Complexity", type: "MCQ", tags: ["algorithms", "complexity"] },
    { id: "q2", title: "HTTP vs HTTPS", type: "Descriptive", tags: ["networking", "security"] },
    { id: "q3", title: "Find Maximum Element", type: "Coding", tags: ["programming", "arrays"] },
    { id: "q4", title: "React Components", type: "MCQ", tags: ["react", "frontend"] },
    { id: "q5", title: "Database Normalization", type: "Descriptive", tags: ["database", "sql"] },
    { id: "q6", title: "Sorting Algorithm", type: "Coding", tags: ["algorithms", "sorting"] },
]

export default function InitiateTest() {
    const [candidateEmail, setCandidateEmail] = useState("")
    const [selectedQuestions, setSelectedQuestions] = useState<string[]>([])
    const [durationHours, setDurationHours] = useState(2)
    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [loginCode, setLoginCode] = useState("")
    const [error, setError] = useState("")
    const router = useRouter()

    useEffect(() => {
        // Check if admin is logged in
        const token = localStorage.getItem("adminToken")
        if (!token) {
            router.push("/admin")
        }
    }, [router])

    const handleQuestionToggle = (questionId: string) => {
        setSelectedQuestions(prev =>
            prev.includes(questionId)
                ? prev.filter(id => id !== questionId)
                : [...prev, questionId]
        )
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")

        if (selectedQuestions.length === 0) {
            setError("Please select at least one question")
            setLoading(false)
            return
        }

        try {
            const adminToken = localStorage.getItem("adminToken")

            if (!adminToken) {
                setError("Not authenticated. Please log in again.")
                setLoading(false)
                return
            }

            const response = await fetch("http://localhost:8000/api/admin/tests", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${adminToken}`
                },
                body: JSON.stringify({
                    candidate_email: candidateEmail,
                    question_ids: selectedQuestions,
                    duration_hours: durationHours
                } as TestInitiationRequest),
            })

            const data = await response.json()

            if (data.success) {
                setLoginCode(data.loginCode)
                setSuccess(true)
            } else {
                setError(data.message || "Failed to create test")
            }
        } catch {
            setError("Failed to connect to server")
        } finally {
            setLoading(false)
        }
    }

    const resetForm = () => {
        setCandidateEmail("")
        setSelectedQuestions([])
        setDurationHours(2)
        setSuccess(false)
        setLoginCode("")
        setError("")
    }

    const getQuestionTypeBadge = (type: string) => {
        const typeColors = {
            MCQ: "bg-blue-50 text-blue-700 border-blue-200",
            Descriptive: "bg-green-50 text-green-700 border-green-200",
            Coding: "bg-purple-50 text-purple-700 border-purple-200"
        }
        return typeColors[type as keyof typeof typeColors] || "bg-gray-50 text-gray-700 border-gray-200"
    }

    if (success) {
        return (
            <div className="min-h-screen bg-warm-background">
                <div className="max-w-3xl mx-auto px-6 py-12">
                    <AnimateOnScroll animation="fadeInUp" delay={200}>
                        <div className="text-center mb-8">
                            <Button
                                variant="ghost"
                                onClick={() => router.push("/admin/dashboard")}
                                className="mb-6 text-warm-brown/60 hover:text-warm-brown"
                            >
                                ← Back to Dashboard
                            </Button>
                        </div>

                        <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-8 text-center">
                            <div className="mb-8">
                                <div className="mx-auto w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mb-6">
                                    <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>

                                <h1 className="text-3xl font-light text-warm-brown mb-4 tracking-tight">
                                    Assessment Created
                                </h1>
                                <div className="w-16 h-px bg-warm-brown/30 mx-auto mb-6"></div>
                                <p className="text-lg text-warm-brown/70 font-light">
                                    Your assessment has been successfully created and is ready for the candidate
                                </p>
                            </div>

                            <div className="bg-warm-brown/5 border border-warm-brown/10 rounded-xl p-6 mb-8">
                                <h3 className="text-xl font-light text-warm-brown mb-4">Access Code</h3>
                                <div className="bg-white border border-warm-brown/20 rounded-lg p-4 mb-4">
                                    <div className="text-3xl font-mono font-medium text-warm-brown tracking-wider">
                                        {loginCode}
                                    </div>
                                </div>
                                <p className="text-sm text-warm-brown/60 font-light">
                                    Share this code with the candidate to begin their assessment
                                </p>
                            </div>

                            <div className="grid md:grid-cols-3 gap-6 text-left mb-8">
                                <div className="bg-white/40 rounded-xl p-4">
                                    <p className="text-sm font-light text-warm-brown/60 mb-1">Candidate</p>
                                    <p className="font-medium text-warm-brown">{candidateEmail}</p>
                                </div>
                                <div className="bg-white/40 rounded-xl p-4">
                                    <p className="text-sm font-light text-warm-brown/60 mb-1">Questions</p>
                                    <p className="font-medium text-warm-brown">{selectedQuestions.length} selected</p>
                                </div>
                                <div className="bg-white/40 rounded-xl p-4">
                                    <p className="text-sm font-light text-warm-brown/60 mb-1">Duration</p>
                                    <p className="font-medium text-warm-brown">{durationHours} hours</p>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row gap-4 justify-center">
                                <Button
                                    onClick={resetForm}
                                    variant="secondary"
                                    className="h-12 px-8"
                                >
                                    Create Another Test
                                </Button>
                                <Button
                                    onClick={() => router.push("/admin/dashboard")}
                                    className="h-12 px-8"
                                >
                                    Return to Dashboard
                                </Button>
                            </div>
                        </div>
                    </AnimateOnScroll>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-warm-background">
            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Header */}
                <AnimateOnScroll animation="fadeInUp" delay={200}>
                    <div className="mb-12">
                        <Button
                            variant="ghost"
                            onClick={() => router.push("/admin/dashboard")}
                            className="mb-6 text-warm-brown/60 hover:text-warm-brown"
                        >
                            ← Back to Dashboard
                        </Button>

                        <h1 className="text-4xl lg:text-5xl font-light text-warm-brown mb-4 tracking-tight">
                            Initiate Assessment
                        </h1>
                        <div className="w-24 h-px bg-warm-brown/30 mb-4"></div>
                        <p className="text-lg text-warm-brown/60 font-light max-w-2xl">
                            Create a new technical assessment for a candidate
                        </p>
                    </div>
                </AnimateOnScroll>

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Candidate Details */}
                    <AnimateOnScroll animation="fadeInUp" delay={300}>
                        <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-6">
                            <h2 className="text-xl font-light text-warm-brown mb-6">Candidate Information</h2>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-light text-warm-brown/70 mb-2">
                                        Email Address
                                    </label>
                                    <Input
                                        type="email"
                                        placeholder="candidate@example.com"
                                        value={candidateEmail}
                                        onChange={(e) => setCandidateEmail(e.target.value)}
                                        className="h-12"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-light text-warm-brown/70 mb-2">
                                        Duration (hours)
                                    </label>
                                    <Input
                                        type="number"
                                        min="1"
                                        max="8"
                                        value={durationHours}
                                        onChange={(e) => setDurationHours(parseInt(e.target.value))}
                                        className="h-12"
                                        required
                                    />
                                </div>
                            </div>
                        </div>
                    </AnimateOnScroll>

                    {/* Question Selection */}
                    <AnimateOnScroll animation="fadeInUp" delay={400}>
                        <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-light text-warm-brown">Question Selection</h2>
                                <span className="text-sm text-warm-brown/60 font-light">
                                    {selectedQuestions.length} selected
                                </span>
                            </div>

                            <div className="grid gap-4">
                                {mockQuestions.map((question) => {
                                    const isSelected = selectedQuestions.includes(question.id)

                                    return (
                                        <div
                                            key={question.id}
                                            className={`p-4 rounded-xl border transition-all duration-200 cursor-pointer ${isSelected
                                                    ? "bg-warm-brown/5 border-warm-brown/20"
                                                    : "bg-white/40 border-warm-brown/10 hover:bg-white/60"
                                                }`}
                                            onClick={() => handleQuestionToggle(question.id)}
                                        >
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-2">
                                                        <h3 className="font-medium text-warm-brown">{question.title}</h3>
                                                        <span className={`px-2 py-1 rounded-full text-xs font-light border ${getQuestionTypeBadge(question.type)}`}>
                                                            {question.type}
                                                        </span>
                                                    </div>
                                                    <div className="flex gap-2">
                                                        {question.tags.map((tag) => (
                                                            <span key={tag} className="text-xs text-warm-brown/50 bg-warm-brown/5 px-2 py-1 rounded">
                                                                {tag}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>

                                                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${isSelected
                                                        ? "bg-warm-brown border-warm-brown"
                                                        : "border-warm-brown/30"
                                                    }`}>
                                                    {isSelected && (
                                                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </AnimateOnScroll>

                    {/* Error Display */}
                    {error && (
                        <AnimateOnScroll animation="fadeInUp" delay={500}>
                            <div className="bg-red-50/80 border border-red-200/50 rounded-xl p-4">
                                <p className="text-red-700 text-sm font-light">{error}</p>
                            </div>
                        </AnimateOnScroll>
                    )}

                    {/* Submit Button */}
                    <AnimateOnScroll animation="fadeInUp" delay={600}>
                        <div className="flex justify-end">
                            <Button
                                type="submit"
                                disabled={loading || !candidateEmail.trim() || selectedQuestions.length === 0}
                                size="lg"
                                className="h-14 px-8"
                            >
                                {loading ? "Creating Assessment..." : "Create Assessment"}
                            </Button>
                        </div>
                    </AnimateOnScroll>
                </form>
            </div>
        </div>
    )
}
