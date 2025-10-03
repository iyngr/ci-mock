"use client"

import { useEffect, useState } from "react"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"
// Phase 6: Enhanced auto-submission display
import { AutoSubmissionBadge } from "@/components/AssessmentStatusComponents"
import { apiFetch } from "@/lib/apiClient"

interface SubmissionDetails {
  auto_submitted: boolean
  reason?: 'time_expired' | 'window_violations' | 'manual_submission' | 'grace_period_expired'
  submitted_at: string
  time_remaining?: number
}

export default function Success() {
  const [wasAutoSubmitted, setWasAutoSubmitted] = useState(false)
  const [submissionDetails, setSubmissionDetails] = useState<SubmissionDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Ensure we exit fullscreen immediately on load
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { /* ignore */ })
    }

    // Phase 6: Fetch detailed submission information
    const fetchSubmissionDetails = async () => {
      try {
        const testId = localStorage.getItem("testId")
        if (!testId) {
          setLoading(false)
          return
        }

        const response = await apiFetch<SubmissionDetails>(`/api/candidate/assessment/${testId}/submission`)
        if (response) {
          setSubmissionDetails(response)
          setWasAutoSubmitted(response.auto_submitted)
        }
      } catch (error) {
        console.error("Failed to fetch submission details:", error)
        // Fallback to localStorage check
        const autoSubmitFlag = localStorage.getItem("wasAutoSubmitted")
        if (autoSubmitFlag === "true") {
          setWasAutoSubmitted(true)
          localStorage.removeItem("wasAutoSubmitted")
        }
      } finally {
        setLoading(false)
      }
    }

    fetchSubmissionDetails()
  }, [])

  return (
    <div className="min-h-screen bg-warm-background flex items-center justify-center p-6">
      <AnimateOnScroll animation="fadeInUp" delay={200}>
        <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-8 text-center max-w-lg w-full shadow-lg">
          <div className="mb-8">
            <div className="mx-auto w-24 h-24 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center mb-6">
              <svg
                className="w-12 h-12 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>

            <h1 className="text-3xl font-light text-warm-brown mb-4 tracking-tight">
              Assessment {wasAutoSubmitted ? "Auto-Submitted" : "Completed"}
            </h1>
            <div className="w-24 h-px bg-warm-brown/30 mx-auto mb-4"></div>
          </div>

          {/* Phase 6: Enhanced auto-submission display */}
          {!loading && submissionDetails && submissionDetails.auto_submitted && (
            <div className="mb-6">
              <AutoSubmissionBadge
                reason={submissionDetails.reason || 'time_expired'}
                timestamp={submissionDetails.submitted_at}
              />
            </div>
          )}

          {/* Fallback for legacy auto-submission flag */}
          {!loading && wasAutoSubmitted && !submissionDetails && (
            <div className="bg-orange-50/80 border border-orange-200/50 rounded-xl p-6 text-left mb-6">
              <div className="flex items-start gap-4">
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-orange-600" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-orange-800 mb-2">Automatic Submission Notice</h3>
                  <p className="text-sm text-orange-700 font-light">
                    Your assessment was automatically submitted. Your responses up to that point have been recorded and will be evaluated.
                  </p>
                </div>
              </div>
            </div>
          )}

          <p className="text-warm-brown/70 font-light leading-relaxed mb-8">
            Thank you for completing the technical assessment. Your responses have been recorded
            and will be evaluated by our team. You will be contacted with the results within the next few days.
          </p>

          <div className="bg-green-50/80 border border-green-200/50 rounded-xl p-6 text-left mb-8">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-green-800 mb-3">What happens next?</h3>
                <ul className="space-y-2 text-sm text-green-700 font-light">
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                    Your answers are being processed and evaluated
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                    You&apos;ll receive an email with your results
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1 h-1 bg-green-500 rounded-full"></div>
                    You can safely close this browser tab now
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-warm-brown/5 border border-warm-brown/10 rounded-xl p-6">
            <p className="text-sm text-warm-brown/60 font-light">
              You may now close this browser tab or navigate away. Press{" "}
              <kbd className="px-2 py-1 bg-warm-brown/10 border border-warm-brown/20 rounded text-xs font-mono">
                Ctrl+W
              </kbd>{" "}
              (Windows/Linux) or{" "}
              <kbd className="px-2 py-1 bg-warm-brown/10 border border-warm-brown/20 rounded text-xs font-mono">
                Cmd+W
              </kbd>{" "}
              (Mac) to close the tab quickly.
            </p>
          </div>
        </div>
      </AnimateOnScroll>
    </div>
  )
}