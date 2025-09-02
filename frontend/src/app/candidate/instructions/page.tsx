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
    <div className="min-h-screen surface-container-lowest flex items-center justify-center p-4">
      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-4"
             style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="md-card-elevated surface-container-low p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto md-animate-scale-in">
            <div className="text-center mb-6">
              {/* Material Design 3 Instructions Icon */}
              <div className="mx-auto w-16 h-16 rounded-full mb-6 tertiary-container flex items-center justify-center"
                   style={{ boxShadow: 'var(--md-sys-elevation-level2)' }}>
                <span className="material-symbols-outlined text-3xl text-[rgb(var(--md-sys-color-on-tertiary-container))]">
                  assignment
                </span>
              </div>
              
              <h2 className="headline-small text-on-surface mb-2">
                Assessment Instructions
              </h2>
            </div>

            <div className="space-y-6 mb-8">
              {/* Do's Section */}
              <div className="surface-container rounded-lg p-4">
                <h3 className="title-medium mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[rgb(var(--md-sys-color-tertiary))]">
                    check_circle
                  </span>
                  <span className="text-[rgb(var(--md-sys-color-tertiary))]">Guidelines to Follow</span>
                </h3>
                <ul className="space-y-2">
                  {instructions.slice(0, 4).map((instruction, index) => (
                    <li key={index} className="flex items-start gap-3 body-medium text-on-surface">
                      <span className="material-symbols-outlined text-sm text-[rgb(var(--md-sys-color-tertiary))] mt-0.5">
                        chevron_right
                      </span>
                      {instruction}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Important Notices */}
              <div className="surface-container rounded-lg p-4">
                <h3 className="title-medium mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[rgb(var(--md-sys-color-error))]">
                    warning
                  </span>
                  <span className="text-[rgb(var(--md-sys-color-error))]">Important Notices</span>
                </h3>
                <ul className="space-y-2">
                  {instructions.slice(4).map((instruction, index) => (
                    <li key={index} className="flex items-start gap-3 body-medium text-on-surface">
                      <span className="material-symbols-outlined text-sm text-[rgb(var(--md-sys-color-error))] mt-0.5">
                        chevron_right
                      </span>
                      {instruction}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Warning Card */}
            <div className="p-4 rounded-lg mb-6" 
                 style={{ backgroundColor: 'rgb(var(--md-sys-color-secondary-container))', color: 'rgb(var(--md-sys-color-on-secondary-container))' }}>
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-[rgb(var(--md-sys-color-secondary))] mt-0.5">
                  info
                </span>
                <div>
                  <p className="body-medium">
                    <span className="label-medium">Important:</span> Once you start the assessment, it will enter fullscreen mode.
                    Any attempt to exit fullscreen or switch applications will be recorded.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-center">
              <Button
                onClick={startAssessment}
                className="px-8 h-12"
              >
                <span className="label-large">I Understand - Start Assessment</span>
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="text-center md-animate-in">
        <div className="mx-auto w-20 h-20 rounded-full mb-8 surface-container-high flex items-center justify-center"
             style={{ boxShadow: 'var(--md-sys-elevation-level2)' }}>
          <span className="material-symbols-outlined text-4xl text-primary animate-spin"
                style={{ animationDuration: '2s' }}>
            hourglass_empty
          </span>
        </div>
        
        <h1 className="headline-medium text-on-surface mb-4">
          Preparing Your Assessment
        </h1>
        <p className="body-large text-on-surface-variant">
          Please wait while we load the instructions...
        </p>
      </div>
    </div>
  )
}