"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function Instructions() {
  const [showModal, setShowModal] = useState(false)
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

  const startAssessment = () => {
    // Enter fullscreen mode
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen()
    }

    // Navigate to assessment
    router.push("/candidate/assessment")
  }

  const instructions = [
    "Ensure you have a stable internet connection throughout the assessment",
    "Do not switch tabs or minimize the browser window",
    "Do not use external resources or assistance",
    "Answer all questions to the best of your ability",
    "Code execution environment will be provided for programming questions",
    "Your activity will be monitored for security purposes",
    "Submit your assessment only when you are completely done",
    "Time limit will be enforced - manage your time wisely"
  ]

  return (
    <div className="min-h-screen assessment-bg flex items-center justify-center p-4">
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="assessment-card p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto animate-slide-in-right">
            <div className="text-center mb-6">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold assessment-text-primary">
                Assessment Instructions
              </h2>
            </div>

            <div className="space-y-4 mb-8">
              <h3 className="text-lg font-semibold text-green-600">Do's:</h3>
              <ul className="list-disc list-inside space-y-2 text-sm assessment-text-primary">
                {instructions.slice(0, 4).map((instruction, index) => (
                  <li key={index}>{instruction}</li>
                ))}
              </ul>

              <h3 className="text-lg font-semibold text-red-600">Don'ts:</h3>
              <ul className="list-disc list-inside space-y-2 text-sm assessment-text-primary">
                {instructions.slice(4).map((instruction, index) => (
                  <li key={index}>{instruction}</li>
                ))}
              </ul>
            </div>

            <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-6">
              <div className="flex">
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">
                    <strong>Important:</strong> Once you start the assessment, it will enter fullscreen mode.
                    Any attempt to exit fullscreen or switch applications will be recorded.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                onClick={startAssessment}
                className="px-8 py-3 text-lg btn-assessment-primary"
              >
                I Understand - Start Assessment
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          Preparing Your Assessment
        </h1>
        <p className="text-gray-600">
          Please wait while we load the instructions...
        </p>
      </div>
    </div>
  )
}