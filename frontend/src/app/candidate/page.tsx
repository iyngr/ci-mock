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
    <div className="min-h-screen surface-container-lowest flex items-center justify-center p-4">
      <div className="md-card-elevated surface-container-low p-8 max-w-md w-full space-y-8 md-animate-slide-in-up">
        <div className="text-center">
          {/* Material Design 3 Assessment Icon */}
          <div className="mx-auto w-16 h-16 rounded-full mb-6 primary-container flex items-center justify-center"
               style={{ boxShadow: 'var(--md-sys-elevation-level2)' }}>
            <span className="material-symbols-outlined text-3xl text-[rgb(var(--md-sys-color-on-primary-container))]">
              quiz
            </span>
          </div>
          
          <h2 className="headline-small text-on-surface mb-2">
            Assessment Portal
          </h2>
          <p className="body-medium text-on-surface-variant">
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
              className="text-center text-lg py-4"
              required
            />
          </div>
          
          {error && (
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(var(--md-sys-color-error-container))', color: 'rgb(var(--md-sys-color-on-error-container))' }}>
              <p className="body-small">{error}</p>
            </div>
          )}
          
          <div>
            <Button
              type="submit"
              disabled={loading || !loginCode.trim()}
              className="w-full h-12"
            >
              <span className="label-large">
                {loading ? "Verifying..." : "Start Assessment"}
              </span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}