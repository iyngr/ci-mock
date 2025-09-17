"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"

export default function CandidateLogin() {
  const [loginCode, setLoginCode] = useState("")
  const [consent, setConsent] = useState(false)
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
        body: JSON.stringify({ loginCode: loginCode }),
      })

      const data = await response.json()

      if (data.success) {
        // Store authentication data and test info
        localStorage.setItem("candidateToken", data.token)
        localStorage.setItem("candidateId", data.candidateId)
        localStorage.setItem("submissionId", data.submissionId)
        localStorage.setItem("testId", data.testId)
        localStorage.setItem("testTitle", data.testTitle)
        localStorage.setItem("durationMinutes", data.duration.toString())
        router.push("/candidate/instructions")
      } else {
        setError(data.message || "Invalid login code")
      }
    } catch {
      setError("Failed to connect to server")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-warm-background flex items-center justify-center p-4 sm:p-6">
      <AnimateOnScroll animation="fadeInUp" delay={200}>
        <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-6 sm:p-8 max-w-sm sm:max-w-md w-full shadow-lg">
          <div className="text-center mb-6 sm:mb-8">
            <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-warm-brown to-warm-brown/80 rounded-full flex items-center justify-center mb-4 sm:mb-6">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl sm:text-3xl font-light text-warm-brown mb-2 sm:mb-3 tracking-tight">
              Technical Assessment
            </h2>
            <div className="w-20 sm:w-24 h-px bg-warm-brown/30 mx-auto mb-3 sm:mb-4"></div>
            <p className="text-sm sm:text-base text-warm-brown/60 font-light px-4">
              Enter your assessment code to begin
            </p>
          </div>

          <form className="space-y-4 sm:space-y-6" onSubmit={handleLogin}>
            <div>
              <Input
                type="text"
                placeholder="Assessment Code"
                value={loginCode}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setLoginCode(e.target.value)}
                className="text-center text-base sm:text-lg h-12 sm:h-14 font-light tracking-wide btn-touch"
                required
              />
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 text-sm text-warm-brown/70 font-light leading-relaxed">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConsent(e.target.checked)}
                  className="mt-0.5 rounded border-warm-brown/30 text-warm-brown focus:ring-warm-brown/20"
                  required
                />
                <span>
                  By continuing, you acknowledge that this interview will be conducted using AI technology. Your voice will be processed in real-time, and a transcript may be retained for evaluation purposes. Please ensure you&apos;re in a quiet environment for optimal audio quality.
                </span>
              </label>
            </div>

            {error && (
              <AnimateOnScroll animation="fadeInUp">
                <div className="bg-red-50/80 border border-red-200/50 rounded-xl p-3 sm:p-4 text-center">
                  <p className="text-red-700 text-sm font-light">{error}</p>
                </div>
              </AnimateOnScroll>
            )}

            <Button
              type="submit"
              disabled={loading || !loginCode.trim() || !consent}
              className="w-full h-12 sm:h-14 text-base sm:text-lg font-light tracking-wide btn-touch"
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 sm:w-5 sm:h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Verifying...
                </div>
              ) : (
                "Start Assessment"
              )}
            </Button>
          </form>

          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-warm-brown/10">
            <p className="text-xs text-warm-brown/50 text-center font-light leading-relaxed px-2">
              Make sure you have a stable internet connection and uninterrupted time to complete the assessment
            </p>
          </div>
        </div>
      </AnimateOnScroll>
    </div>
  )
}