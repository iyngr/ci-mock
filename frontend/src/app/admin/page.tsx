"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AdminLoginRequest } from "@/lib/schema"

export default function AdminLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [gridAnimation, setGridAnimation] = useState<Array<{ id: number; x: number; y: number; delay: number }>>([])
  const router = useRouter()

  // Generate grid animation
  useEffect(() => {
    const grid = Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: (i % 5) * 20,
      y: Math.floor(i / 5) * 20,
      delay: Math.random() * 2
    }))
    setGridAnimation(grid)
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch("http://localhost:8000/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password } as AdminLoginRequest),
      })

      const data = await response.json()

      if (data.success) {
        // Store admin token and redirect to dashboard
        localStorage.setItem("adminToken", data.token)
        localStorage.setItem("adminUser", JSON.stringify(data.admin))
        router.push("/admin/dashboard")
      } else {
        setError(data.message || "Invalid credentials")
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
            rgb(var(--md-sys-color-secondary-container)) 0%, 
            rgb(var(--md-sys-color-surface-container-lowest)) 25%,
            rgb(var(--md-sys-color-primary-container)) 50%,
            rgb(var(--md-sys-color-surface-container-lowest)) 75%,
            rgb(var(--md-sys-color-tertiary-container)) 100%
          )
        `
      }}
    >
      {/* Animated grid background */}
      <div className="absolute inset-0 overflow-hidden opacity-20">
        {gridAnimation.map(item => (
          <div
            key={item.id}
            className="absolute w-1 h-1 rounded-full"
            style={{
              left: `${item.x}%`,
              top: `${item.y}%`,
              background: `rgb(var(--md-sys-color-secondary))`,
              animation: `pulse 3s ease-in-out infinite ${item.delay}s`
            }}
          />
        ))}
        
        {/* Admin themed decorations */}
        <div 
          className="absolute top-10 right-10 w-32 h-32 rounded-lg opacity-10 rotate-12"
          style={{ background: `rgb(var(--md-sys-color-secondary))` }}
        />
        <div 
          className="absolute bottom-10 left-10 w-24 h-24 rounded-lg opacity-15 -rotate-12"
          style={{ background: `rgb(var(--md-sys-color-primary))` }}
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
            {/* Enhanced Admin Icon */}
            <div 
              className="mx-auto w-20 h-20 rounded-full mb-8 flex items-center justify-center md-animate-scale-in"
              style={{ 
                background: `linear-gradient(135deg, rgb(var(--md-sys-color-secondary)), rgb(var(--md-sys-color-primary)))`,
                boxShadow: 'var(--md-sys-elevation-level4)'
              }}
            >
              <span className="material-symbols-outlined text-white text-4xl">
                admin_panel_settings
              </span>
            </div>
            
            <h2 className="headline-medium text-on-surface mb-4">
              Admin Portal
            </h2>
            <p className="body-large text-on-surface-variant leading-relaxed">
              Access the administrator dashboard to manage assessments and view analytics
            </p>
            
            {/* Admin badge */}
            <div 
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mt-4"
              style={{ 
                background: `rgba(var(--md-sys-color-secondary), 0.2)`,
                color: `rgb(var(--md-sys-color-on-secondary-container))`
              }}
            >
              <span className="material-symbols-outlined text-sm">verified_user</span>
              <span className="label-small font-medium">ADMINISTRATOR ACCESS</span>
            </div>
          </div>

          <form className="space-y-8" onSubmit={handleLogin}>
            {/* Email Field */}
            <div className="space-y-2">
              <label className="label-medium text-on-surface-variant block">
                Email Address
              </label>
              <div className="relative">
                <Input
                  type="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-12 py-4 rounded-2xl border-2 transition-all duration-300"
                  style={{
                    background: `rgba(var(--md-sys-color-surface-container-highest), 0.8)`,
                    borderColor: email ? `rgb(var(--md-sys-color-secondary))` : `rgb(var(--md-sys-color-outline-variant))`
                  }}
                  required
                />
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                  <span className="material-symbols-outlined text-xl text-on-surface-variant">
                    email
                  </span>
                </div>
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-2">
              <label className="label-medium text-on-surface-variant block">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-12 pr-12 py-4 rounded-2xl border-2 transition-all duration-300"
                  style={{
                    background: `rgba(var(--md-sys-color-surface-container-highest), 0.8)`,
                    borderColor: password ? `rgb(var(--md-sys-color-secondary))` : `rgb(var(--md-sys-color-outline-variant))`
                  }}
                  required
                />
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                  <span className="material-symbols-outlined text-xl text-on-surface-variant">
                    lock
                  </span>
                </div>
                <button
                  type="button"
                  className="absolute right-4 top-1/2 transform -translate-y-1/2"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-symbols-outlined text-xl text-on-surface-variant hover:text-on-surface transition-colors">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
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
                disabled={loading || !email.trim() || !password.trim()}
                className="w-full h-14 text-lg rounded-2xl transition-all duration-300"
                style={{
                  background: loading || !email.trim() || !password.trim()
                    ? `rgba(var(--md-sys-color-on-surface), 0.12)` 
                    : `linear-gradient(135deg, rgb(var(--md-sys-color-secondary)), rgb(var(--md-sys-color-primary)))`,
                  color: loading || !email.trim() || !password.trim()
                    ? `rgba(var(--md-sys-color-on-surface), 0.38)` 
                    : 'white',
                  boxShadow: loading || !email.trim() || !password.trim() ? 'none' : 'var(--md-sys-elevation-level2)'
                }}
              >
                <div className="flex items-center gap-3">
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span className="label-large">Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xl">login</span>
                      <span className="label-large">Sign In</span>
                    </>
                  )}
                </div>
              </Button>
            </div>
          </form>

          {/* Demo Credentials */}
          <div 
            className="mt-8 p-4 rounded-2xl border"
            style={{ 
              background: `rgba(var(--md-sys-color-tertiary-container), 0.3)`,
              borderColor: `rgba(var(--md-sys-color-outline-variant), 0.3)`
            }}
          >
            <div className="flex items-start gap-3">
              <span className="material-symbols-outlined text-lg" style={{ color: `rgb(var(--md-sys-color-tertiary))` }}>
                info
              </span>
              <div>
                <p className="body-small font-medium text-on-surface mb-1">Demo Credentials</p>
                <p className="label-small text-on-surface-variant">
                  Email: admin@example.com<br />
                  Password: admin123
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-opacity-20" style={{ borderColor: `rgb(var(--md-sys-color-outline-variant))` }}>
            <div className="flex items-center justify-center gap-6 text-center">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm" style={{ color: `rgb(var(--md-sys-color-secondary))` }}>shield</span>
                <span className="body-small text-on-surface-variant">Secure Access</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-sm" style={{ color: `rgb(var(--md-sys-color-secondary))` }}>analytics</span>
                <span className="body-small text-on-surface-variant">Admin Dashboard</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.5); }
        }
      `}</style>
    </div>
  )
}