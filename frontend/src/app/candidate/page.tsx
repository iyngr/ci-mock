"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoginRequest } from "@/lib/schema"

export default function CandidateLogin() {
  const [loginCode, setLoginCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

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
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Enter Assessment Code
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Please enter the login code provided by your assessment administrator
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div>
            <Input
              type="text"
              placeholder="Enter your login code"
              value={loginCode}
              onChange={(e) => setLoginCode(e.target.value)}
              className="text-center text-lg py-3"
              required
            />
          </div>
          {error && (
            <div className="text-red-600 text-sm text-center">{error}</div>
          )}
          <div>
            <Button
              type="submit"
              disabled={loading || !loginCode.trim()}
              className="w-full"
            >
              {loading ? "Verifying..." : "Start Assessment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}