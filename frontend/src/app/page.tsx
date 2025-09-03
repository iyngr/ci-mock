"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function Home() {
  const [ripples, setRipples] = useState<Array<{ id: string; x: number; y: number }>>([])
  const router = useRouter()

  const createRipple = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top

    // Create truly unique ID using crypto.randomUUID() or Math.random()
    const uniqueId = `ripple-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newRipple = { id: uniqueId, x, y }

    setRipples(prev => [...prev, newRipple])

    // Remove ripple after animation
    setTimeout(() => {
      setRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id))
    }, 400)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-assessment-background via-accent/10 to-secondary/20 relative overflow-hidden cursor-default"
      onMouseMove={createRipple}
    >
      {/* Material 3 Expressive animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/30 rounded-full mix-blend-multiply filter blur-xl opacity-60 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-secondary/40 rounded-full mix-blend-multiply filter blur-xl opacity-60 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-1/2 w-80 h-80 bg-tertiary/30 rounded-full mix-blend-multiply filter blur-xl opacity-60 animate-blob animation-delay-4000"></div>
      </div>

      {/* Ripple effects with Material 3 colors */}
      {ripples.map(ripple => (
        <div
          key={ripple.id}
          className="absolute pointer-events-none"
          style={{
            left: ripple.x - 8,
            top: ripple.y - 8,
          }}
        >
          <div className="w-4 h-4 bg-primary/20 rounded-full animate-ping"></div>
          <div className="absolute inset-0 w-8 h-8 bg-primary/10 rounded-full animate-pulse"></div>
        </div>
      ))}

      {/* Main content */}
      <div className="relative z-10 max-w-2xl mx-auto text-center px-6">
        <div className="mb-12">
          <h1 className="text-6xl font-bold text-foreground mb-4 tracking-tight font-fraunces">
            Smart Mock
          </h1>
          <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
            Intelligent Technical Assessment
          </p>
          <div className="w-24 h-1 bg-gradient-to-r from-primary to-secondary mx-auto rounded-full"></div>
        </div>

        <div className="space-y-6">
          <p className="text-lg text-muted-foreground mb-8">
            Choose your role to continue
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            <Button
              size="lg"
              className="w-full sm:w-48 h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              onClick={() => router.push('/candidate')}
            >
              <div className="flex flex-col items-center">
                <span>Interviewee</span>
              </div>
            </Button>

            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-48 h-14 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              onClick={() => router.push('/admin')}
            >
              <div className="flex flex-col items-center">
                <span>Moderator</span>
              </div>
            </Button>
          </div>
        </div>

        <div className="mt-12 text-sm text-muted-foreground">
          <p>Secure Assessment</p>
        </div>
      </div>
    </div>
  )
}
