"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"
import { DashboardStats, TestSummary } from "@/lib/schema"
import { Doughnut } from "react-chartjs-2"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from "chart.js"

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
)

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [tests, setTests] = useState<TestSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const router = useRouter()

  useEffect(() => {
    // Check if admin is logged in
    const token = localStorage.getItem("adminToken")
    if (!token) {
      router.push("/admin")
      return
    }

    fetchDashboardData()
  }, [router])

  const fetchDashboardData = async () => {
    try {
      const adminToken = localStorage.getItem("adminToken")
      const response = await fetch("http://localhost:8000/api/admin/dashboard", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${adminToken}`
        }
      })
      const data = await response.json()

      setStats(data.stats)
      setTests(data.tests)
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTests = tests.filter(test =>
    test.candidateEmail.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const statusData = {
    labels: ["Completed", "Pending", "In Progress"],
    datasets: [
      {
        data: [
          stats?.completedTests || 0,
          stats?.pendingTests || 0,
          ((stats?.totalTests ?? 0) - (stats?.completedTests ?? 0) - (stats?.pendingTests ?? 0))
        ],
        backgroundColor: ["rgba(42,24,22,0.8)", "rgba(42,24,22,0.5)", "rgba(42,24,22,0.3)"],
        borderWidth: 0,
      },
    ],
  }

  const getStatusBadge = (status: string) => {
    const statusColors = {
      completed: "bg-warm-brown/10 text-warm-brown border-warm-brown/20",
      pending: "bg-amber-50 text-amber-700 border-amber-200",
      in_progress: "bg-blue-50 text-blue-700 border-blue-200",
      expired: "bg-red-50 text-red-700 border-red-200"
    }
    return statusColors[status as keyof typeof statusColors] || "bg-gray-50 text-gray-700 border-gray-200"
  }

  const logout = () => {
    localStorage.removeItem("adminToken")
    localStorage.removeItem("adminUser")
    router.push("/admin")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-warm-brown/20 border-t-warm-brown rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-lg text-warm-brown/70 font-light">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-warm-background">
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 pt-24 pb-8">{/* Increased top padding to account for floating nav */}
        {/* Header Section */}
        <AnimateOnScroll animation="fadeInUp" delay={200}>
          <div className="mb-12">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
              <div>
                <h1 className="text-4xl lg:text-5xl font-light text-warm-brown mb-4 tracking-tight">
                  Dashboard
                </h1>
                <div className="w-24 h-px bg-warm-brown/30 mb-4"></div>
                <p className="text-lg text-warm-brown/60 font-light max-w-2xl">
                  Comprehensive assessment analytics and management
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={logout}
                  className="bg-warm-brown/90 hover:bg-warm-brown text-white px-6 py-3 rounded-xl font-light transition-colors duration-300"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </AnimateOnScroll>

        {/* KPI Cards */}
        <AnimateOnScroll animation="fadeInUp" delay={300}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
            <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-6 hover:bg-white/80 transition-colors duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-light text-warm-brown/60 mb-2">Total Tests</p>
                  <p className="text-3xl font-light text-warm-brown">{stats?.totalTests || 0}</p>
                </div>
                <div className="w-12 h-12 bg-warm-brown/10 rounded-full flex items-center justify-center">
                  <span className="text-warm-brown/60 font-light">T</span>
                </div>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-6 hover:bg-white/80 transition-colors duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-light text-warm-brown/60 mb-2">Completed</p>
                  <p className="text-3xl font-light text-warm-brown">{stats?.completedTests || 0}</p>
                </div>
                <div className="w-12 h-12 bg-warm-brown/10 rounded-full flex items-center justify-center">
                  <span className="text-warm-brown/60 font-light">C</span>
                </div>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-6 hover:bg-white/80 transition-colors duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-light text-warm-brown/60 mb-2">Pending</p>
                  <p className="text-3xl font-light text-warm-brown">{stats?.pendingTests || 0}</p>
                </div>
                <div className="w-12 h-12 bg-warm-brown/10 rounded-full flex items-center justify-center">
                  <span className="text-warm-brown/60 font-light">P</span>
                </div>
              </div>
            </div>

            <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-6 hover:bg-white/80 transition-colors duration-300">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-light text-warm-brown/60 mb-2">Success Rate</p>
                  <p className="text-3xl font-light text-warm-brown">
                    {stats?.completedTests && stats?.totalTests
                      ? Math.round((stats.completedTests / stats.totalTests) * 100)
                      : 0}%
                  </p>
                </div>
                <div className="w-12 h-12 bg-warm-brown/10 rounded-full flex items-center justify-center">
                  <span className="text-warm-brown/60 font-light">%</span>
                </div>
              </div>
            </div>
          </div>
        </AnimateOnScroll>

        {/* Charts and Recent Tests - Responsive Flex Layout */}
        <div className="flex flex-col lg:flex-row gap-6 w-full items-stretch">
          {/* Status Chart - fixed width on desktop */}
          <AnimateOnScroll animation="fadeInUp" delay={400} className="w-full lg:max-w-sm lg:flex-none min-w-0">
            <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-6 h-full w-full">
              <h3 className="text-xl font-light text-warm-brown mb-6">Test Status Distribution</h3>
              <div className="h-64 flex items-center justify-center">
                <Doughnut
                  data={statusData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: {
                          font: {
                            size: 12,
                            weight: 300
                          },
                          color: 'rgba(42,24,22,0.7)',
                          padding: 16
                        }
                      }
                    }
                  }}
                />
              </div>
            </div>
          </AnimateOnScroll>

          {/* Recent Tests - flexes to fill remaining width */}
          <AnimateOnScroll animation="fadeInUp" delay={500} className="flex-1 min-w-0">
            <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-6 h-full w-full min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 w-full">
                <h3 className="text-xl font-light text-warm-brown">Recent Tests</h3>
                <Input
                  type="text"
                  placeholder="Search by email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="sm:w-64"
                />
              </div>

              <div className="space-y-3 w-full lg:max-h-[60vh] overflow-y-auto">{/* Expand on desktop, cap height sensibly */}
                {filteredTests.length > 0 ? (
                  filteredTests.slice(0, 12).map((test, index) => (/* Show more tests due to increased space */
                    <div key={index} className="flex items-center justify-between p-4 bg-white/40 rounded-xl border border-warm-brown/5 hover:bg-white/60 transition-colors">
                      <div className="flex-1 min-w-0">{/* Added min-w-0 for better text truncation */}
                        <p className="font-medium text-warm-brown text-sm truncate">{test.candidateEmail}</p>
                        <div className="flex items-center gap-4 mt-1">
                          <p className="text-xs text-warm-brown/60">
                            {new Date(test.createdAt).toLocaleDateString()}
                          </p>
                          {/* Add time information */}
                          <p className="text-xs text-warm-brown/50">
                            {new Date(test.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-light border ${getStatusBadge(test.status)}`}>
                          {test.status.replace('_', ' ')}
                        </span>
                        {test.overallScore && (
                          <span className="text-sm font-medium text-warm-brown min-w-[3rem] text-right">
                            {Math.round(test.overallScore)}%
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12">
                    <p className="text-warm-brown/60 font-light">No tests found</p>
                  </div>
                )}
              </div>
            </div>
          </AnimateOnScroll>
        </div>
      </div>
    </div>
  )
}
