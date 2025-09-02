"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoginRequest } from "@/lib/schema"

export default function CandidateLogin() {
  const [loginCode, setLoginCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch("http://localhost:8000/api/candidate/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ login_code: loginCode } as LoginRequest),
      })

      const data = await response.json()

      if (data.success) {
        // Store test ID and redirect to instructions
        localStorage.setItem("testId", data.testId)
        router.push("/candidate/instructions")
      } else {
        setError(data.message || "Invalid login code")
      }
    } catch (err) {
      setError("Failed to connect to server")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen assessment-bg flex items-center justify-center p-4">
      <div className="assessment-card p-8 max-w-md w-full space-y-8 animate-fade-in-up">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-3xl font-bold assessment-text-primary mb-2">
            Assessment
          </h2>
          <p className="assessment-text-muted">
            Enter your assessment code to begin
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div>
            <Input
              type="text"
              placeholder="Enter your login code"
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value)}
              className="input-assessment text-center text-lg py-3"
              required
            />
          </div>
          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}
          <div>
            <Button
              type="submit"
              disabled={loading || !loginCode.trim()}
              className="w-full btn-assessment-primary"
            >
              {loading ? "Verifying..." : "Start Assessment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}