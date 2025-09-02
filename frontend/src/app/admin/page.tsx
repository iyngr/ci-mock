"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AdminLoginRequest } from "@/lib/schema"

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
    <div className="min-h-screen surface-container-lowest flex items-center justify-center p-4">
      <div className="md-card-elevated surface-container-low p-8 max-w-md w-full space-y-8 md-animate-slide-in-up">
        <div className="text-center">
          {/* Material Design 3 Admin Icon */}
          <div className="mx-auto w-16 h-16 rounded-full mb-6 surface-container-high flex items-center justify-center"
               style={{ boxShadow: 'var(--md-sys-elevation-level2)' }}>
            <span className="material-symbols-outlined text-3xl text-primary">
              admin_panel_settings
            </span>
          </div>
          
          <h2 className="headline-small text-on-surface mb-2">
            Admin Portal
          </h2>
          <p className="body-medium text-on-surface-variant">
            Manage assessments and view analytics
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>
          
          {error && (
            <div className="p-3 rounded-lg" style={{ backgroundColor: 'rgb(var(--md-sys-color-error-container))', color: 'rgb(var(--md-sys-color-on-error-container))' }}>
              <p className="body-small">{error}</p>
            </div>
          )}
          
          <div>
            <Button
              type="submit"
              disabled={loading || !email.trim() || !password.trim()}
              className="w-full h-12"
            >
              <span className="label-large">
                {loading ? "Signing in..." : "Sign In"}
              </span>
            </Button>
          </div>
          
          <div className="p-3 rounded-lg surface-container-highest text-center">
            <p className="body-small text-on-surface-variant">
              Demo credentials: admin@example.com / admin123
            </p>
          </div>
        </form>
      </div>
    </div>
  )
}