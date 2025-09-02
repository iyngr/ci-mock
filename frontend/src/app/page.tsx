"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function Home() {
  const [activeRipples, setActiveRipples] = useState<Array<{ id: number; x: number; y: number }>>([])
  const router = useRouter()

  const createRipple = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const newRipple = { id: Date.now(), x, y }

    setActiveRipples(prev => [...prev, newRipple])

    setTimeout(() => {
      setActiveRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id))
    }, 800)
  }

  return (
    <div
      className="min-h-screen surface-container-lowest flex items-center justify-center relative overflow-hidden cursor-default"
      onMouseMove={createRipple}
    >
      {/* Material Design 3 Background Pattern */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Geometric Material You shapes */}
        <div className="absolute top-20 left-20 w-32 h-32 rounded-full opacity-20"
             style={{ background: `rgb(var(--md-sys-color-primary))` }}></div>
        <div className="absolute bottom-20 right-20 w-24 h-24 rounded-full opacity-15"
             style={{ background: `rgb(var(--md-sys-color-secondary))` }}></div>
        <div className="absolute top-1/2 left-1/4 w-20 h-20 rounded-full opacity-10"
             style={{ background: `rgb(var(--md-sys-color-tertiary))` }}></div>
        
        {/* Material ripple effects */}
        {activeRipples.map(ripple => (
          <div
            key={ripple.id}
            className="absolute pointer-events-none"
            style={{
              left: ripple.x - 60,
              top: ripple.y - 60,
            }}
          >
            <div 
              className="w-30 h-30 rounded-full animate-ping opacity-20"
              style={{ background: `rgb(var(--md-sys-color-primary))` }}
            ></div>
          </div>
        ))}
      </div>

      {/* Main content with Material Design 3 styling */}
      <div className="relative z-10 max-w-2xl mx-auto text-center px-6 md-animate-slide-in-up">
        <div className="mb-16">
          {/* Material Design 3 Logo/Icon */}
          <div className="mx-auto w-20 h-20 rounded-full mb-8 surface-container-high flex items-center justify-center"
               style={{ boxShadow: 'var(--md-sys-elevation-level2)' }}>
            <span className="material-symbols-outlined text-4xl text-primary">
              psychology
            </span>
          </div>
          
          <h1 className="display-medium font-roboto text-on-surface mb-4 tracking-tight">
            Smart Mock
          </h1>
          
          <p className="body-large text-on-surface-variant mb-8 leading-relaxed max-w-md mx-auto">
            Internal Technical Assessment Platform built with Material Design 3
          </p>
          
          {/* Material Design 3 accent line */}
          <div className="w-24 h-1 mx-auto rounded-full"
               style={{ background: `rgb(var(--md-sys-color-primary))` }}></div>
        </div>

        <div className="space-y-8">
          <p className="title-medium text-on-surface-variant mb-12">
            Choose your role to continue
          </p>

          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
            {/* Material Design 3 Filled Button */}
            <button
              className="md-button-filled md-ripple w-full sm:w-56 h-14 flex flex-col items-center justify-center gap-1 md-animate-in"
              onClick={() => router.push('/candidate')}
              style={{ animationDelay: '0.1s' }}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">
                  quiz
                </span>
                <span className="label-large">Take Assessment</span>
              </div>
              <span className="label-small opacity-90">Test Taker</span>
            </button>

            {/* Material Design 3 Outlined Button */}
            <button
              className="md-button-outlined md-ripple w-full sm:w-56 h-14 flex flex-col items-center justify-center gap-1 md-animate-in"
              onClick={() => router.push('/admin')}
              style={{ animationDelay: '0.2s' }}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">
                  admin_panel_settings
                </span>
                <span className="label-large">Manage Tests</span>
              </div>
              <span className="label-small opacity-90">Moderator</span>
            </button>
          </div>
        </div>

        {/* Material Design 3 Footer */}
        <div className="mt-16 text-on-surface-variant md-animate-in" style={{ animationDelay: '0.3s' }}>
          <p className="body-small">
            Employee Portal • Secure Assessment Environment
          </p>
        </div>
      </div>
    </div>
  )
}
