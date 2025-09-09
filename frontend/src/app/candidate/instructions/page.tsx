"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"

export default function Instructions() {
  const [showModal, setShowModal] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Check if user has valid test ID
    const testId = localStorage.getItem("testId")
    if (!testId) {
      router.push("/candidate")
    }

    // Show instructions modal after a brief delay
    setTimeout(() => setShowModal(true), 500)
  }, [router])

  const startAssessment = async () => {
    setIsStarting(true)

    try {
      const testId = localStorage.getItem("testId")
      const candidateToken = localStorage.getItem("candidateToken")
      const candidateId = localStorage.getItem("candidateId")

      if (!testId || !candidateToken || !candidateId) {
        throw new Error("Missing authentication data")
      }

      // Call the start assessment endpoint with authentication
      const response = await fetch("http://localhost:8000/api/candidate/assessment/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${candidateToken}`
        },
        body: JSON.stringify({
          assessment_id: testId,
          candidate_id: candidateId
        })
      })

      if (!response.ok) {
        throw new Error("Failed to start assessment")
      }

      const data = await response.json()

      // Store submission data in localStorage
      localStorage.setItem("submissionId", data.submission_id)
      localStorage.setItem("expirationTime", data.expirationTime)
      localStorage.setItem("durationMinutes", data.durationMinutes.toString())
      localStorage.setItem("assessmentStartTime", new Date().toISOString())

      // Enter fullscreen mode
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen().catch(err => {
          console.log("Could not enter fullscreen:", err)
        })
      }

      // Navigate to assessment
      router.push("/candidate/assessment")
    } catch (error) {
      console.error("Failed to start assessment:", error)
      alert("Failed to start assessment. Please try again.")
      setIsStarting(false)
    }
  }

  const instructions = [
    {
      type: "do",
      items: [
        "Ensure you have a stable internet connection throughout the assessment",
        "Answer all questions to the best of your ability",
        "Use the provided code execution environment for programming questions",
        "Manage your time wisely - the time limit will be enforced"
      ]
    },
    {
      type: "dont",
      items: [
        "Do not switch tabs or minimize the browser window",
        "Do not use external resources or assistance",
        "Do not attempt to copy or paste from external sources",
        "Do not exit fullscreen mode during the assessment"
      ]
    }
  ]

  return (
    <div className="min-h-screen bg-warm-background flex items-center justify-center p-6">
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
          <AnimateOnScroll animation="fadeInUp" delay={200}>
            <div className="bg-white/95 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-8 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <div className="text-center mb-8">
                <div className="mx-auto w-20 h-20 bg-gradient-to-br from-warm-brown to-warm-brown/80 rounded-full flex items-center justify-center mb-6">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h2 className="text-3xl font-light text-warm-brown mb-3 tracking-tight">
                  Assessment Guidelines
                </h2>
                <div className="w-24 h-px bg-warm-brown/30 mx-auto"></div>
              </div>

              <div className="grid md:grid-cols-2 gap-8 mb-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-green-600">Guidelines</h3>
                  </div>
                  <ul className="space-y-3">
                    {instructions[0].items.map((item, index) => (
                      <li key={index} className="flex items-start gap-3 text-sm text-warm-brown/70 font-light">
                        <div className="w-1.5 h-1.5 bg-green-400 rounded-full mt-2 flex-shrink-0"></div>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-medium text-red-600">Restrictions</h3>
                  </div>
                  <ul className="space-y-3">
                    {instructions[1].items.map((item, index) => (
                      <li key={index} className="flex items-start gap-3 text-sm text-warm-brown/70 font-light">
                        <div className="w-1.5 h-1.5 bg-red-400 rounded-full mt-2 flex-shrink-0"></div>
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="bg-amber-50/80 border border-amber-200/50 rounded-xl p-6 mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-amber-800 mb-2">Important Notice</h4>
                    <p className="text-sm text-amber-700 font-light leading-relaxed">
                      Once you start the assessment, it will enter fullscreen mode for security purposes.
                      Any attempt to exit fullscreen or switch applications will be recorded and may result
                      in automatic submission of your assessment.
                    </p>
                  </div>
                </div>
              </div>

              <div className="text-center">
                <Button
                  onClick={startAssessment}
                  disabled={isStarting}
                  size="lg"
                  className="h-14 px-12 text-lg font-light tracking-wide"
                >
                  {isStarting ? (
                    <div className="flex items-center gap-3">
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
                      Starting Assessment...
                    </div>
                  ) : (
                    "I Understand - Start Assessment"
                  )}
                </Button>
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      )}

      <div className="text-center">
        <AnimateOnScroll animation="fadeInUp">
          <div className="w-16 h-16 border-4 border-warm-brown/20 border-t-warm-brown rounded-full animate-spin mx-auto mb-6"></div>
          <h1 className="text-3xl font-light text-warm-brown mb-4 tracking-tight">
            Preparing Your Assessment
          </h1>
          <p className="text-warm-brown/60 font-light">
            Please wait while we load the instructions...
          </p>
        </AnimateOnScroll>
      </div>
    </div>
  )
}