"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"
import { AdminLoginRequest } from "@/lib/schema"
import { buildApiUrl } from "@/lib/apiClient"

export default function AdminLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    try {
      const response = await fetch(buildApiUrl("/api/admin/login"), {
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
        // Redirect to admin dashboard (root-level route)
        router.push("/dashboard")
      } else {
        setError(data.message || "Invalid credentials")
      }
    } catch {
      setError("Failed to connect to server")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-warm-background flex items-center justify-center p-4 sm:p-6">
      {/* Background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 right-1/4 w-2 h-2 bg-warm-brown/10 rounded-full animate-float"></div>
        <div className="absolute bottom-1/3 left-1/3 w-1 h-1 bg-warm-brown/20 rounded-full animate-float-delayed"></div>
        <div className="absolute top-2/3 right-1/2 w-1.5 h-1.5 bg-warm-brown/15 rounded-full animate-float"></div>
      </div>

      <div className="relative z-10 w-full max-w-sm sm:max-w-md">
        <AnimateOnScroll animation="fadeInUp" delay={200}>
          <div className="text-center mb-8 sm:mb-12">
            {/* Minimal admin icon */}
            <div className="mx-auto w-16 h-16 sm:w-20 sm:h-20 bg-warm-brown/10 rounded-full flex items-center justify-center mb-6 sm:mb-8 group hover:bg-warm-brown/20 transition-colors duration-300">
              <svg className="w-8 h-8 sm:w-10 sm:h-10 text-warm-brown/60 group-hover:text-warm-brown/80 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>

            <h1 className="text-3xl sm:text-4xl md:text-5xl font-light text-warm-brown mb-3 sm:mb-4 tracking-tight">
              Authenticate
            </h1>
            <div className="w-12 sm:w-16 h-px bg-warm-brown/30 mx-auto mb-4 sm:mb-6"></div>
            <p className="text-base sm:text-lg text-warm-brown/60 font-light px-4">
              Manage assessments and analytics
            </p>
          </div>
        </AnimateOnScroll>

        <AnimateOnScroll animation="fadeInUp" delay={400}>
          <form className="space-y-6 sm:space-y-8 px-4 sm:px-0" onSubmit={handleLogin}>
            <div className="space-y-4 sm:space-y-6">
              <div>
                <Input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 sm:h-14 text-base sm:text-lg btn-touch"
                  required
                />
              </div>
              <div>
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 sm:h-14 text-base sm:text-lg btn-touch"
                  required
                />
              </div>
            </div>

            {error && (
              <div className="text-red-500/80 text-sm text-center font-light bg-red-50/50 p-3 rounded-lg border border-red-200/30 mx-4 sm:mx-0">
                {error}
              </div>
            )}

            <div className="px-4 sm:px-0">
              <Button
                type="submit"
                disabled={loading || !email.trim() || !password.trim()}
                size="lg"
                className="w-full h-12 sm:h-14 text-base sm:text-lg font-medium btn-touch"
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </div>

            <div className="text-center px-4 sm:px-0">
              <p className="text-xs text-warm-brown/50 font-light">
                Demo credentials
              </p>
              <p className="text-sm text-warm-brown/60 font-light mt-1">
                admin@example.com / admin123
              </p>
            </div>
          </form>
        </AnimateOnScroll>
      </div>
    </div>
  )
}