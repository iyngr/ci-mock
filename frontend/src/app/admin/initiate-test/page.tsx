"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
      const response = await fetch("http://localhost:8000/api/admin/tests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
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

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <Button
                  variant="outline"
                  onClick={() => router.push("/admin/dashboard")}
                >
                  ← Back to Dashboard
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto py-12 px-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="mb-6">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-4">
              Test Created Successfully!
            </h1>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">Login Code</h3>
              <div className="text-2xl font-mono font-bold text-blue-600 bg-white px-4 py-2 rounded border">
                {loginCode}
              </div>
              <p className="text-sm text-blue-700 mt-2">
                Share this code with the candidate to start their assessment
              </p>
            </div>

            <div className="space-y-3 text-left">
              <p><strong>Candidate:</strong> {candidateEmail}</p>
              <p><strong>Questions:</strong> {selectedQuestions.length} selected</p>
              <p><strong>Duration:</strong> {durationHours} hours</p>
            </div>

            <div className="mt-8 space-x-4">
              <Button onClick={resetForm}>
                Create Another Test
              </Button>
              <Button variant="outline" onClick={() => router.push("/admin/dashboard")}>
                Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen assessment-bg">
      {/* Header */}
      <div className="assessment-card m-6 rounded-none">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Button
                variant="outline"
                onClick={() => router.push("/admin/dashboard")}
                className="btn-assessment-secondary"
              >
                ← Back to Dashboard
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto py-8 px-4">
        <div className="assessment-card">
          <div className="px-6 py-4 assessment-border">
            <h1 className="text-xl font-semibold assessment-text-primary">
              Initiate Test
            </h1>
            <p className="mt-1 text-sm assessment-text-muted">
              Create a new assessment for a candidate by selecting questions and setting duration.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Candidate Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Candidate Email
              </label>
              <Input
                id="email"
                type="email"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                placeholder="candidate@example.com"
                required
                className="mt-1"
              />
            </div>

            {/* Duration */}
            <div>
              <label htmlFor="duration" className="block text-sm font-medium text-gray-700">
                Duration (hours)
              </label>
              <Input
                id="duration"
                type="number"
                min="1"
                max="8"
                value={durationHours}
                onChange={(e) => setDurationHours(parseInt(e.target.value))}
                className="mt-1 w-32"
              />
            </div>

            {/* Question Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Questions ({selectedQuestions.length} selected)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mockQuestions.map((question) => (
                  <div
                    key={question.id}
                    className={`border rounded-lg p-4 cursor-pointer transition-colors ${selectedQuestions.includes(question.id)
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-300 hover:border-gray-400"
                      }`}
                    onClick={() => handleQuestionToggle(question.id)}
                  >
                    <div className="flex items-start space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedQuestions.includes(question.id)}
                        onChange={() => handleQuestionToggle(question.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{question.title}</h4>
                        <p className="text-sm text-gray-600 mt-1">Type: {question.type}</p>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {question.tags.map((tag) => (
                            <span
                              key={tag}
                              className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {error && (
              <div className="text-red-600 text-sm">{error}</div>
            )}

            <div className="flex justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/admin/dashboard")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !candidateEmail.trim() || selectedQuestions.length === 0}
              >
                {loading ? "Creating..." : "Create Test"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}