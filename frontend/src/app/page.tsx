"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function Home() {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([])
  const router = useRouter()

  const createRipple = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const newRipple = { id: Date.now(), x, y }

    setRipples(prev => [...prev, newRipple])

    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id))
    }, 600)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 relative overflow-hidden cursor-default"
      onMouseMove={createRipple}
    >
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-1/2 w-80 h-80 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Ripple effects */}
      {ripples.map(ripple => (
        <div
          key={ripple.id}
          className="absolute pointer-events-none"
          style={{
            left: ripple.x - 50,
            top: ripple.y - 50,
          }}
        >
          <div className="w-24 h-24 bg-white/30 rounded-full animate-ping"></div>
          <div className="absolute inset-0 w-24 h-24 bg-white/20 rounded-full animate-pulse"></div>
        </div>
      ))}

      {/* Main content */}
      <div className="relative z-10 max-w-2xl mx-auto text-center px-6">
        <div className="mb-12">
          <h1 className="text-6xl font-bold text-gray-900 mb-4 tracking-tight">
            Smart Mock
          </h1>
          <p className="text-xl text-gray-600 mb-8 leading-relaxed">
            Internal Technical Assessment Platform
          </p>
          <div className="w-24 h-1 bg-gradient-to-r from-blue-500 to-purple-500 mx-auto rounded-full"></div>
        </div>

        <div className="space-y-6">
          <p className="text-lg text-gray-700 mb-8">
            Choose your role to continue
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Button
              size="lg"
              className="w-full sm:w-48 h-14 text-lg font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              onClick={() => router.push('/candidate')}
            >
              <div className="flex flex-col items-center">
                <span>Take Assessment</span>
                <span className="text-sm opacity-90">Test Taker</span>
              </div>
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-48 h-14 text-lg font-semibold border-2 border-purple-600 text-purple-600 hover:bg-purple-600 hover:text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              onClick={() => router.push('/admin')}
            >
              <div className="flex flex-col items-center">
                <span>Manage Tests</span>
                <span className="text-sm opacity-90">Moderator</span>
              </div>
            </Button>
          </div>
        </div>

        <div className="mt-12 text-sm text-gray-500">
          <p>Employee Portal • Secure Assessment Environment</p>
        </div>
      </div>
    </div>
  )
}
