"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"

export default function Home() {
  const [activeRipples, setActiveRipples] = useState<Array<{ id: number; x: number; y: number }>>([])
  const [floatingShapes, setFloatingShapes] = useState<Array<{ id: number; x: number; y: number; color: string; size: number; delay: number }>>([])
  const router = useRouter()

  // Generate floating animation shapes
  useEffect(() => {
    const shapes = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      color: ['primary', 'secondary', 'tertiary'][Math.floor(Math.random() * 3)],
      size: Math.random() * 120 + 80,
      delay: Math.random() * 3
    }))
    setFloatingShapes(shapes)
  }, [])

  const createRipple = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = event.clientX - rect.left
    const y = event.clientY - rect.top
    const newRipple = { id: Date.now(), x, y }

    setActiveRipples(prev => [...prev, newRipple])

    setTimeout(() => {
      setActiveRipples(prev => prev.filter(ripple => ripple.id !== newRipple.id))
    }, 1200)
  }

  return (
    <div
      className="min-h-screen relative overflow-hidden cursor-default"
      onMouseMove={createRipple}
      style={{
        background: `
          linear-gradient(135deg, 
            rgb(var(--md-sys-color-primary-container)) 0%, 
            rgb(var(--md-sys-color-surface-container-lowest)) 25%,
            rgb(var(--md-sys-color-tertiary-container)) 50%,
            rgb(var(--md-sys-color-surface-container-lowest)) 75%,
            rgb(var(--md-sys-color-secondary-container)) 100%
          )
        `
      }}
    >
      {/* Dynamic Material You Background */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Animated floating shapes */}
        {floatingShapes.map(shape => (
          <div
            key={shape.id}
            className="absolute rounded-full opacity-20 animate-pulse"
            style={{
              left: `${shape.x}%`,
              top: `${shape.y}%`,
              width: `${shape.size}px`,
              height: `${shape.size}px`,
              background: `rgb(var(--md-sys-color-${shape.color}))`,
              animation: `float 6s ease-in-out infinite ${shape.delay}s`,
              filter: 'blur(1px)'
            }}
          />
        ))}
        
        {/* Gradient overlays for depth */}
        <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-black/5"></div>
        <div className="absolute inset-0 bg-gradient-to-tl from-transparent via-transparent to-white/10"></div>
        
        {/* Interactive ripple effects */}
        {activeRipples.map(ripple => (
          <div
            key={ripple.id}
            className="absolute pointer-events-none"
            style={{
              left: ripple.x - 80,
              top: ripple.y - 80,
            }}
          >
            <div 
              className="w-40 h-40 rounded-full opacity-30"
              style={{ 
                background: `radial-gradient(circle, rgb(var(--md-sys-color-primary)) 0%, transparent 70%)`,
                animation: 'ripple 1.2s ease-out'
              }}
            ></div>
          </div>
        ))}
      </div>

      {/* Main content container */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-6">
        <div className="max-w-4xl mx-auto">
          {/* Hero section with elevated card */}
          <div className="text-center mb-12">
            {/* Main content card */}
            <div 
              className="mx-auto p-12 rounded-3xl backdrop-blur-sm border md-animate-slide-in-up"
              style={{
                background: `rgba(var(--md-sys-color-surface-container-low), 0.9)`,
                boxShadow: 'var(--md-sys-elevation-level5)',
                borderColor: `rgba(var(--md-sys-color-outline-variant), 0.5)`
              }}
            >
              {/* Brand section */}
              <div className="mb-12">
                {/* Material Design 3 Logo with gradient */}
                <div 
                  className="mx-auto w-28 h-28 rounded-full mb-8 flex items-center justify-center md-animate-scale-in"
                  style={{ 
                    background: `linear-gradient(135deg, rgb(var(--md-sys-color-primary)), rgb(var(--md-sys-color-tertiary)))`,
                    boxShadow: 'var(--md-sys-elevation-level4)'
                  }}
                >
                  <span className="material-symbols-outlined text-white text-5xl">
                    psychology
                  </span>
                </div>
                
                <h1 className="display-medium font-roboto text-on-surface mb-6 tracking-tight">
                  Smart Mock
                </h1>
                
                <p className="title-large text-on-surface-variant mb-8 leading-relaxed max-w-2xl mx-auto">
                  Advanced Technical Assessment Platform
                </p>
                
                <div className="flex items-center justify-center gap-4 mb-8">
                  <div className="w-16 h-1 rounded-full" style={{ background: `rgb(var(--md-sys-color-primary))` }}></div>
                  <div className="w-2 h-2 rounded-full" style={{ background: `rgb(var(--md-sys-color-secondary))` }}></div>
                  <div className="w-16 h-1 rounded-full" style={{ background: `rgb(var(--md-sys-color-tertiary))` }}></div>
                </div>
                
                <p className="body-large text-on-surface-variant mb-8">
                  Built with Material Design 3 • AI-Powered Evaluation • Real-time Proctoring
                </p>
              </div>

              {/* Role selection cards */}
              <div className="space-y-8">
                <p className="title-medium text-on-surface-variant mb-8">
                  Choose your role to continue
                </p>

                <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
                  {/* Candidate Card */}
                  <div 
                    className="group cursor-pointer md-animate-in"
                    style={{ animationDelay: '0.2s' }}
                    onClick={() => router.push('/candidate')}
                  >
                    <div 
                      className="p-8 rounded-2xl border transition-all duration-300 group-hover:scale-105"
                      style={{
                        background: `linear-gradient(135deg, rgb(var(--md-sys-color-primary-container)), rgb(var(--md-sys-color-surface-container-high)))`,
                        borderColor: `rgb(var(--md-sys-color-outline-variant))`,
                        boxShadow: 'var(--md-sys-elevation-level2)'
                      }}
                    >
                      <div className="text-center">
                        <div 
                          className="mx-auto w-16 h-16 rounded-full mb-6 flex items-center justify-center"
                          style={{ 
                            background: `rgb(var(--md-sys-color-primary))`,
                            boxShadow: 'var(--md-sys-elevation-level2)'
                          }}
                        >
                          <span className="material-symbols-outlined text-white text-2xl">
                            quiz
                          </span>
                        </div>
                        
                        <h3 className="title-large mb-3" style={{ color: `rgb(var(--md-sys-color-on-primary-container))` }}>
                          Take Assessment
                        </h3>
                        
                        <p className="body-medium opacity-80" style={{ color: `rgb(var(--md-sys-color-on-primary-container))` }}>
                          Start your technical evaluation
                        </p>
                        
                        <div className="mt-6">
                          <div 
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all group-hover:shadow-lg"
                            style={{
                              background: `rgb(var(--md-sys-color-primary))`,
                              color: `rgb(var(--md-sys-color-on-primary))`
                            }}
                          >
                            <span>Test Taker Portal</span>
                            <span className="material-symbols-outlined text-lg">arrow_forward</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Admin Card */}
                  <div 
                    className="group cursor-pointer md-animate-in"
                    style={{ animationDelay: '0.3s' }}
                    onClick={() => router.push('/admin')}
                  >
                    <div 
                      className="p-8 rounded-2xl border transition-all duration-300 group-hover:scale-105"
                      style={{
                        background: `linear-gradient(135deg, rgb(var(--md-sys-color-secondary-container)), rgb(var(--md-sys-color-surface-container-high)))`,
                        borderColor: `rgb(var(--md-sys-color-outline-variant))`,
                        boxShadow: 'var(--md-sys-elevation-level2)'
                      }}
                    >
                      <div className="text-center">
                        <div 
                          className="mx-auto w-16 h-16 rounded-full mb-6 flex items-center justify-center"
                          style={{ 
                            background: `rgb(var(--md-sys-color-secondary))`,
                            boxShadow: 'var(--md-sys-elevation-level2)'
                          }}
                        >
                          <span className="material-symbols-outlined text-white text-2xl">
                            admin_panel_settings
                          </span>
                        </div>
                        
                        <h3 className="title-large mb-3" style={{ color: `rgb(var(--md-sys-color-on-secondary-container))` }}>
                          Manage Tests
                        </h3>
                        
                        <p className="body-medium opacity-80" style={{ color: `rgb(var(--md-sys-color-on-secondary-container))` }}>
                          Admin dashboard and analytics
                        </p>
                        
                        <div className="mt-6">
                          <div 
                            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-medium transition-all group-hover:shadow-lg"
                            style={{
                              background: `rgb(var(--md-sys-color-secondary))`,
                              color: `rgb(var(--md-sys-color-on-secondary))`
                            }}
                          >
                            <span>Moderator Portal</span>
                            <span className="material-symbols-outlined text-lg">arrow_forward</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Footer with features */}
              <div className="mt-12 pt-8 border-t border-opacity-20" style={{ borderColor: `rgb(var(--md-sys-color-outline-variant))` }}>
                <div className="flex flex-wrap justify-center gap-8 text-center">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg" style={{ color: `rgb(var(--md-sys-color-primary))` }}>shield</span>
                    <span className="body-small text-on-surface-variant">Secure Environment</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg" style={{ color: `rgb(var(--md-sys-color-primary))` }}>smart_toy</span>
                    <span className="body-small text-on-surface-variant">AI Evaluation</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lg" style={{ color: `rgb(var(--md-sys-color-primary))` }}>analytics</span>
                    <span className="body-small text-on-surface-variant">Real-time Analytics</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-20px) scale(1.05); }
        }
        
        @keyframes ripple {
          0% { transform: scale(0); opacity: 0.6; }
          100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
