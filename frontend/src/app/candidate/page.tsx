"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoginRequest } from "@/lib/schema"

export default function CandidateLogin() {
  const [loginCode, setLoginCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [particles, setParticles] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([])
  const router = useRouter()

  // Generate floating particles for background animation
  useEffect(() => {
    const newParticles = Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      delay: Math.random() * 3
    }))
    setParticles(newParticles)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch("http://localhost:8000/api/candidate/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ login_code: loginCode } as LoginRequest),
      })

      const data = await response.json()

      if (data.success) {
        // Store test ID and redirect to instructions
        localStorage.setItem("testId", data.testId)
        router.push("/candidate/instructions")
      } else {
        setError(data.message || "Invalid login code")
      }
    } catch (err) {
      setError("Failed to connect to server")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{
        background: `
          linear-gradient(135deg, 
            rgb(var(--md-sys-color-primary-container)) 0%, 
            rgb(var(--md-sys-color-surface-container-lowest)) 30%,
            rgb(var(--md-sys-color-tertiary-container)) 70%,
            rgb(var(--md-sys-color-surface-container-lowest)) 100%
          )
        `
      }}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden">
        {particles.map(particle => (
          <div
            key={particle.id}
            className="absolute w-2 h-2 rounded-full opacity-30"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              background: `rgb(var(--md-sys-color-primary))`,
              animation: `float 4s ease-in-out infinite ${particle.delay}s`
            }}
          />
        ))}
        
        {/* Large decorative shapes */}
        <div 
          className="absolute -top-20 -left-20 w-40 h-40 rounded-full opacity-10"
          style={{ background: `rgb(var(--md-sys-color-primary))` }}
        />
        <div 
          className="absolute -bottom-20 -right-20 w-60 h-60 rounded-full opacity-10"
          style={{ background: `rgb(var(--md-sys-color-tertiary))` }}
        />
      </div>

      {/* Main content */}
      <div className="relative z-10 w-full max-w-md">
        <div 
          className="backdrop-blur-lg p-10 rounded-3xl border md-animate-slide-in-up"
          style={{
            background: `rgba(var(--md-sys-color-surface-container-low), 0.95)`,
            boxShadow: 'var(--md-sys-elevation-level5)',
            borderColor: `rgba(var(--md-sys-color-outline-variant), 0.3)`
          }}
        >
          {/* Header Section */}
          <div className="text-center mb-10">
            {/* Enhanced Assessment Icon */}
            <div 
              className="mx-auto w-20 h-20 rounded-full mb-8 flex items-center justify-center md-animate-scale-in"
              style={{ 
                background: `linear-gradient(135deg, rgb(var(--md-sys-color-primary)), rgb(var(--md-sys-color-tertiary)))`,
                boxShadow: 'var(--md-sys-elevation-level4)'
              }}
            >
              <span className="material-symbols-outlined text-white text-4xl">
                quiz
              </span>
            </div>
            
            <h2 className="headline-medium text-on-surface mb-4">
              Assessment Portal
            </h2>
            <p className="body-large text-on-surface-variant leading-relaxed">
              Enter your unique assessment code to begin your technical evaluation
            </p>
            
            {/* Progress indicator */}
            <div className="flex justify-center mt-6 space-x-2">
              <div className="w-8 h-1 rounded-full" style={{ background: `rgb(var(--md-sys-color-primary))` }}></div>
              <div className="w-2 h-1 rounded-full opacity-30" style={{ background: `rgb(var(--md-sys-color-primary))` }}></div>
              <div className="w-2 h-1 rounded-full opacity-30" style={{ background: `rgb(var(--md-sys-color-primary))` }}></div>
            </div>
          </div>

          <form className="space-y-8" onSubmit={handleLogin}>
            {/* Enhanced Input Field */}
            <div className="space-y-2">
              <label className="label-medium text-on-surface-variant block">
                Assessment Code
              </label>
              <div className="relative">
                <Input
                  type="text"
                  placeholder="Enter your login code"
                  value={loginCode}
                  onChange={(e) => setLoginCode(e.target.value)}
                  className="text-center text-xl py-6 rounded-2xl border-2 transition-all duration-300"
                  style={{
                    background: `rgba(var(--md-sys-color-surface-container-highest), 0.8)`,
                    borderColor: loginCode ? `rgb(var(--md-sys-color-primary))` : `rgb(var(--md-sys-color-outline-variant))`
                  }}
                  required
                />
                {loginCode && (
                  <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    <span className="material-symbols-outlined text-xl" style={{ color: `rgb(var(--md-sys-color-primary))` }}>
                      check_circle
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Error Display */}
            {error && (
              <div 
                className="p-4 rounded-2xl border md-animate-in"
                style={{ 
                  backgroundColor: 'rgb(var(--md-sys-color-error-container))', 
                  color: 'rgb(var(--md-sys-color-on-error-container))',
                  borderColor: 'rgb(var(--md-sys-color-error))'
                }}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-xl">error</span>
                  <p className="body-medium">{error}</p>
                </div>
              </div>
            )}
            
            {/* Submit Button */}
            <div>
              <Button
                type="submit"
                disabled={loading || !loginCode.trim()}
                className="w-full h-14 text-lg rounded-2xl transition-all duration-300"
                style={{
                  background: loading || !loginCode.trim() 
                    ? `rgba(var(--md-sys-color-on-surface), 0.12)` 
                    : `linear-gradient(135deg, rgb(var(--md-sys-color-primary)), rgb(var(--md-sys-color-tertiary)))`,
                  color: loading || !loginCode.trim() 
                    ? `rgba(var(--md-sys-color-on-surface), 0.38)` 
                    : 'white',
                  boxShadow: loading || !loginCode.trim() ? 'none' : 'var(--md-sys-elevation-level2)'
                }}
              >
                <div className="flex items-center gap-3">
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span className="label-large">Verifying Code...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xl">play_arrow</span>
                      <span className="label-large">Start Assessment</span>
                    </>
                  )}
                </div>
              </Button>
            </div>
          </form>

          {/* Footer info */}
          <div className="mt-8 pt-6 border-t border-opacity-20" style={{ borderColor: `rgb(var(--md-sys-color-outline-variant))` }}>
            <div className="flex items-center justify-center gap-6 text-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm" style={{ color: `rgb(var(--md-sys-color-primary))` }}>timer</span>
                <span className="body-small text-on-surface-variant">Timed Assessment</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm" style={{ color: `rgb(var(--md-sys-color-primary))` }}>security</span>
                <span className="body-small text-on-surface-variant">Secure Environment</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          33% { transform: translateY(-10px) rotate(120deg); }
          66% { transform: translateY(5px) rotate(240deg); }
        }
      `}</style>
    </div>
  )
}