"use client"

import { useEffect } from "react"

export default function Success() {
  useEffect(() => {
    // Ensure we exit fullscreen immediately on load
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => { /* ignore */ })
    }
  }, [])

  return (
    <div className="min-h-screen assessment-bg flex items-center justify-center p-4">
      <div className="assessment-card p-8 text-center max-w-md w-full animate-fade-in-up">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-bold assessment-text-primary mb-4">
          Assessment Submitted Successfully!
        </h1>

        <p className="assessment-text-muted mb-6">
          Thank you for completing the technical assessment. Your responses have been recorded
          and will be evaluated. You will be contacted with the results within the next few days.
        </p>

        <div className="bg-green-50 border-l-4 border-green-400 p-4 text-left mb-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-green-700">
                <strong>What happens next?</strong><br />
                • Your answers are being processed and evaluated<br />
                • You'll receive an email with your results<br />
                • You can safely close this browser tab now
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 border rounded-md p-4 text-left">
          <p className="text-sm text-gray-600">
            You may now simply close this browser tab or navigate away. Press <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Ctrl+W</kbd> (Windows/Linux) or <kbd className="px-1 py-0.5 bg-gray-200 rounded text-xs">Cmd+W</kbd> (Mac) to close the tab quickly.
          </p>
        </div>
      </div>
    </div>
  )
}