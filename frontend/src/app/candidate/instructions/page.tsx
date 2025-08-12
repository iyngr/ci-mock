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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold text-center mb-6">
              Assessment Instructions
            </h2>
            
            <div className="space-y-4 mb-8">
              <h3 className="text-lg font-semibold text-green-600">Do's:</h3>
              <ul className="list-disc list-inside space-y-2 text-sm">
                {instructions.slice(0, 4).map((instruction, index) => (
                  <li key={index} className="text-gray-700">{instruction}</li>
                ))}
              </ul>
              
              <h3 className="text-lg font-semibold text-red-600">Don'ts:</h3>
              <ul className="list-disc list-inside space-y-2 text-sm">
                {instructions.slice(4).map((instruction, index) => (
                  <li key={index} className="text-gray-700">{instruction}</li>
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
                className="px-8 py-3 text-lg"
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