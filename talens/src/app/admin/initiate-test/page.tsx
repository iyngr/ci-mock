"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"
import { TestInitiationRequest } from "@/lib/schema"

export default function InitiateTest() {
  const [candidateEmail, setCandidateEmail] = useState("")
  const [selectedRole, setSelectedRole] = useState("")
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [loginCode, setLoginCode] = useState("")
  const [error, setError] = useState("")
  const router = useRouter()

  const developerRoles = [
    "Python Backend Developer",
    "Java Backend Developer",
    "Node.js Backend Developer",
    "React Frontend Developer",
    "Full Stack JavaScript Developer",
    "DevOps Engineer",
    "Mobile Developer",
    "Data Scientist"
  ]

  useEffect(() => {
    // Check if admin is logged in
    const token = localStorage.getItem("adminToken")
    if (!token) {
      router.push("/admin")
    }
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (!candidateEmail.trim()) {
      setError("Email address is required")
      setLoading(false)
      return
    }

    if (!selectedRole) {
      setError("Please select a developer role")
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
          developer_role: selectedRole,
          duration_hours: 2 // Default 2 hours
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
    setSelectedRole("")
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

              <div className="grid md:grid-cols-2 gap-6 text-left mb-8">
                <div className="bg-white/40 rounded-xl p-4">
                  <p className="text-sm font-light text-warm-brown/60 mb-1">Candidate</p>
                  <p className="font-medium text-warm-brown">{candidateEmail}</p>
                </div>
                <div className="bg-white/40 rounded-xl p-4">
                  <p className="text-sm font-light text-warm-brown/60 mb-1">Role</p>
                  <p className="font-medium text-warm-brown">{selectedRole}</p>
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
      <div className="max-w-4xl mx-auto px-6 pt-24 pb-8">{/* Increased top padding to account for floating nav */}
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
              <h2 className="text-xl font-light text-warm-brown mb-6">Assessment Information</h2>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-light text-warm-brown/70 mb-2">
                    Candidate Email Address
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
                    Developer Role
                  </label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                    className="w-full h-12 px-4 rounded-lg border border-warm-brown/20 bg-white text-warm-brown focus:outline-none focus:ring-2 focus:ring-warm-brown/30"
                    required
                  >
                    <option value="">Select a role</option>
                    {developerRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </AnimateOnScroll>

          {/* Error Display */}
          {error && (
            <AnimateOnScroll animation="fadeInUp" delay={400}>
              <div className="bg-red-50/80 border border-red-200/50 rounded-xl p-4">
                <p className="text-red-700 text-sm font-light">{error}</p>
              </div>
            </AnimateOnScroll>
          )}

          {/* Submit Button */}
          <AnimateOnScroll animation="fadeInUp" delay={500}>
            <div className="flex justify-center">
              <Button
                type="submit"
                disabled={loading || !candidateEmail.trim() || !selectedRole}
                className="px-12 py-4 text-lg font-light bg-warm-brown hover:bg-warm-brown/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {loading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Creating Assessment...
                  </div>
                ) : (
                  "Create Assessment"
                )}
              </Button>
            </div>
          </AnimateOnScroll>
        </form>
      </div>
    </div>
  )
}
