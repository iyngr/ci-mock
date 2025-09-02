"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { DashboardStats, TestSummary } from "@/lib/schema"
import { Doughnut, Bar } from "react-chartjs-2"
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
      const response = await fetch("http://localhost:8000/api/admin/dashboard")
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
        backgroundColor: ["#10B981", "#F59E0B", "#3B82F6"],
        borderWidth: 0,
      },
    ],
  }

  const performanceData = {
    labels: ["Excellent (90-100)", "Good (70-89)", "Average (50-69)", "Below Average (<50)"],
    datasets: [
      {
        data: [12, 18, 8, 2], // Mock data
        backgroundColor: ["#059669", "#10B981", "#F59E0B", "#EF4444"],
        borderWidth: 0,
      },
    ],
  }

  const getStatusBadge = (status: string) => {
    const statusStyles = {
      completed: "bg-[rgb(var(--md-sys-color-tertiary-container))] text-[rgb(var(--md-sys-color-on-tertiary-container))]",
      pending: "bg-[rgb(var(--md-sys-color-secondary-container))] text-[rgb(var(--md-sys-color-on-secondary-container))]",
      in_progress: "bg-[rgb(var(--md-sys-color-primary-container))] text-[rgb(var(--md-sys-color-on-primary-container))]",
      expired: "bg-[rgb(var(--md-sys-color-error-container))] text-[rgb(var(--md-sys-color-on-error-container))]"
    }
    return statusStyles[status as keyof typeof statusStyles] || "bg-[rgb(var(--md-sys-color-surface-variant))] text-[rgb(var(--md-sys-color-on-surface-variant))]"
  }

  const logout = () => {
    localStorage.removeItem("adminToken")
    localStorage.removeItem("adminUser")
    router.push("/admin")
  }

  if (loading) {
    return (
      <div className="min-h-screen surface-container-lowest flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 surface-container-high rounded-full flex items-center justify-center"
               style={{ boxShadow: 'var(--md-sys-elevation-level2)' }}>
            <span className="material-symbols-outlined text-3xl text-primary animate-spin"
                  style={{ animationDuration: '1s' }}>
              sync
            </span>
          </div>
          <p className="title-medium text-on-surface">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen surface-container-lowest">
      {/* Material Design 3 Header */}
      <div className="md-card-elevated surface-container-low m-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <span className="material-symbols-outlined text-primary mr-3">
                dashboard
              </span>
              <h1 className="title-large text-on-surface">
                Assessment Admin Portal
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={() => router.push("/admin/initiate-test")}
                className="flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">
                  add_circle
                </span>
                <span>Initiate New Test</span>
              </Button>
              <Button 
                variant="outline"
                onClick={logout}
                className="flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">
                  logout
                </span>
                <span>Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Material Design 3 KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="md-card-elevated surface-container-low p-5 md-animate-in">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full flex items-center justify-center"
                     style={{ backgroundColor: 'rgb(var(--md-sys-color-primary-container))', color: 'rgb(var(--md-sys-color-on-primary-container))' }}>
                  <span className="material-symbols-outlined">
                    assignment
                  </span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="body-medium text-on-surface-variant truncate">
                    Total Tests
                  </dt>
                  <dd className="headline-small text-on-surface">
                    {stats?.totalTests || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="md-card-elevated surface-container-low p-5 md-animate-in" style={{ animationDelay: '0.1s' }}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full flex items-center justify-center"
                     style={{ backgroundColor: 'rgb(var(--md-sys-color-tertiary-container))', color: 'rgb(var(--md-sys-color-on-tertiary-container))' }}>
                  <span className="material-symbols-outlined">
                    check_circle
                  </span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="body-medium text-on-surface-variant truncate">
                    Completed
                  </dt>
                  <dd className="headline-small text-on-surface">
                    {stats?.completedTests || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="md-card-elevated surface-container-low p-5 md-animate-in" style={{ animationDelay: '0.2s' }}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full flex items-center justify-center"
                     style={{ backgroundColor: 'rgb(var(--md-sys-color-secondary-container))', color: 'rgb(var(--md-sys-color-on-secondary-container))' }}>
                  <span className="material-symbols-outlined">
                    pending
                  </span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="body-medium text-on-surface-variant truncate">
                    Pending
                  </dt>
                  <dd className="headline-small text-on-surface">
                    {stats?.pendingTests || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>

          <div className="md-card-elevated surface-container-low p-5 md-animate-in" style={{ animationDelay: '0.3s' }}>
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-12 h-12 rounded-full flex items-center justify-center"
                     style={{ backgroundColor: 'rgb(var(--md-sys-color-primary-container))', color: 'rgb(var(--md-sys-color-on-primary-container))' }}>
                  <span className="material-symbols-outlined">
                    analytics
                  </span>
                </div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="body-medium text-on-surface-variant truncate">
                    Avg Score
                  </dt>
                  <dd className="headline-small text-on-surface">
                    {stats?.averageScore?.toFixed(1) || 0}%
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>

        {/* Material Design 3 Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="md-card-elevated surface-container-low p-6 md-animate-in" style={{ animationDelay: '0.4s' }}>
            <h3 className="title-medium text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">
                pie_chart
              </span>
              Status Summary
            </h3>
            <div className="w-full h-64 flex items-center justify-center">
              <Doughnut
                data={statusData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                    },
                  },
                }}
              />
            </div>
          </div>

          <div className="md-card-elevated surface-container-low p-6 md-animate-in" style={{ animationDelay: '0.5s' }}>
            <h3 className="title-medium text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">
                analytics
              </span>
              Performance Category
            </h3>
            <div className="w-full h-64 flex items-center justify-center">
              <Doughnut
                data={performanceData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                    },
                  },
                }}
              />
            </div>
          </div>
        </div>

        {/* Material Design 3 Tests Table */}
        <div className="md-card-elevated surface-container-low md-animate-in" style={{ animationDelay: '0.6s' }}>
          <div className="px-4 py-5 sm:p-6">
            <div className="sm:flex sm:items-center sm:justify-between mb-4">
              <h3 className="title-medium text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  people
                </span>
                Test Takers
              </h3>
              <div className="mt-3 sm:mt-0 sm:ml-4">
                <Input
                  type="text"
                  placeholder="Search by email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64"
                />
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-[rgb(var(--md-sys-color-outline-variant))]">
              <table className="min-w-full divide-y divide-[rgb(var(--md-sys-color-outline-variant))]">
                <thead className="surface-container-high">
                  <tr>
                    <th className="px-6 py-3 text-left label-small text-on-surface-variant uppercase tracking-wider">
                      Candidate
                    </th>
                    <th className="px-6 py-3 text-left label-small text-on-surface-variant uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left label-small text-on-surface-variant uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left label-small text-on-surface-variant uppercase tracking-wider">
                      Score
                    </th>
                    <th className="px-6 py-3 text-left label-small text-on-surface-variant uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="surface divide-y divide-[rgb(var(--md-sys-color-outline-variant))]">
                  {filteredTests.map((test) => (
                    <tr key={test._id} className="hover:surface-container-highest transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="body-medium text-on-surface font-medium">
                          {test.candidateEmail}
                        </div>
                        <div className="body-small text-on-surface-variant">
                          Initiated by: {test.initiatedBy}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-3 py-1 label-small rounded-full ${getStatusBadge(test.status)}`}>
                          {test.status.replace('_', ' ').toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap body-medium text-on-surface">
                        {new Date(test.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap body-medium text-on-surface">
                        {test.overallScore ? `${test.overallScore.toFixed(1)}%` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {test.status === 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/admin/report/${test._id}`)}
                            className="flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">
                              visibility
                            </span>
                            <span>View Report</span>
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}