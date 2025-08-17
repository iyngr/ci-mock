"use client"

import { useEffect } from "react"

export default function Success() {
  useEffect(() => {
    // Exit fullscreen mode
    if (document.fullscreenElement) {
      document.exitFullscreen()
    }
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-green-600"
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
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Assessment Submitted Successfully!
        </h1>
        
        <p className="text-gray-600 mb-6">
          Thank you for completing the technical assessment. Your responses have been recorded 
          and will be evaluated. You will be contacted with the results within the next few days.
        </p>
        
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 text-left">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>What happens next?</strong><br />
                • Your answers are being processed and evaluated<br />
                • You'll receive an email with your results<br />
                • Feel free to close this browser window
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}