"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAdminContext, adminContextOptions, hydrateAdminContextFromStorage } from "@/lib/adminContext"

interface HeaderProps {
    className?: string
}

export function Header({ className }: HeaderProps) {
    const router = useRouter()
    const pathname = usePathname()
    const [isScrolled, setIsScrolled] = useState(false)
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
    const { activeContext, setActiveContext } = useAdminContext()

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20)
        }

        window.addEventListener("scroll", handleScroll)
        return () => window.removeEventListener("scroll", handleScroll)
    }, [])

    // Hydrate UI context from client-side storage to avoid SSR/client mismatch
    useEffect(() => {
        hydrateAdminContextFromStorage()
    }, [])

    // Don't show header on home page or login
    if (pathname === "/" || pathname === "/login") {
        return null
    }

    // Determine known admin and candidate base routes. Only show header on these.
    const adminBasePaths = [
        "/dashboard",
        "/add-questions",
        "/initiate-test",
        "/report",
        "/smart-screen",
    ]

    const isCandidateRoute = pathname.startsWith("/candidate")
    const isAdminRoute = adminBasePaths.some((p) => pathname.startsWith(p))

    // If this path isn't recognized as an admin or candidate route, hide header (prevents showing on 404s)
    const isKnownRoute = isAdminRoute || isCandidateRoute || pathname === "/" || pathname === "/login"
    if (!isKnownRoute) return null

    // Hide header on login pages and during assessment
    const hideHeader =
        pathname === "/" || // Admin login page (root of admin app)
        pathname === "/login" || // Admin explicit login page
        pathname === "/candidate" ||  // Candidate login page
        pathname === "/candidate/assessment" ||  // During assessment (avoid distraction)
        pathname === "/candidate/success"  // Success page should also be clean

    if (hideHeader) {
        return null
    }

    const getNavigationItems = () => {
        if (isAdminRoute) {
            return [
                { label: "Dashboard", href: "/dashboard" },
                { label: "Add Questions", href: "/add-questions" },
                { label: "Initiate Test", href: "/initiate-test" },
                { label: "Reports", href: "/report" },
                { label: "Smart Screen", href: "/smart-screen" },
            ]
        }

        if (isCandidateRoute) {
            return [
                { label: "Assessment", href: "/candidate/assessment" },
                { label: "Instructions", href: "/candidate/instructions" },
            ]
        }

        return []
    }

    const navigationItems = getNavigationItems()

    const handleLogout = () => {
        if (isAdminRoute) {
            localStorage.removeItem("adminToken")
            router.push("/login")
        } else if (isCandidateRoute) {
            localStorage.removeItem("candidateToken")
            router.push("/candidate")
        }
    }

    const goHome = () => {
        router.push("/")
    }

    return (
        <>
            <header
                className={cn(
                    "fixed top-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 ease-in-out w-full max-w-7xl px-4",
                    isScrolled ? "scale-95" : "scale-100",
                    className
                )}
            >
                <nav className="glass-nav rounded-2xl px-4 md:px-6 py-3 flex items-center justify-between min-w-fit">
                    {/* Logo / Brand */}
                    <button
                        onClick={goHome}
                        className="text-lg md:text-xl font-bold text-warm-brown hover:text-warm-brown/80 transition-all duration-300 font-system hover:scale-105 active:scale-95"
                    >
                        <span className="gradient-text">AI Assessment</span>
                    </button>

                    {/* Navigation Items */}
                    {navigationItems.length > 0 && (
                        <div className="hidden md:flex items-center space-x-1 mx-8">
                            {navigationItems.map((item) => (
                                <button
                                    key={item.href}
                                    onClick={() => router.push(item.href)}
                                    className={cn(
                                        "px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ease-out nav-link-slide relative",
                                        pathname === item.href
                                            ? "bg-warm-brown/10 text-warm-brown shadow-sm"
                                            : "text-warm-brown/60 hover:text-warm-brown hover:bg-warm-brown/5 hover:shadow-sm hover:-translate-y-0.5"
                                    )}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Desktop Actions */}
                    <div className="hidden md:flex items-center space-x-3">
                        {/* Context Switcher for Admin Routes */}
                        {isAdminRoute && (
                            <div className="flex items-center px-2 py-1 rounded-full bg-warm-brown/5 border border-warm-brown/10">
                                {/* Single slider toggle */}
                                <div
                                    role="switch"
                                    aria-checked={activeContext === "realtime"}
                                    tabIndex={0}
                                    onClick={() => setActiveContext(activeContext === "mock" ? "realtime" : "mock")}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            setActiveContext(activeContext === "mock" ? "realtime" : "mock")
                                        }
                                    }}
                                    className={cn(
                                        "relative inline-flex items-center w-14 h-7 rounded-full cursor-pointer select-none transition-colors duration-200",
                                        activeContext === "realtime" ? "bg-emerald-400/25" : "bg-warm-brown/10"
                                    )}
                                >
                                    <span className={cn(
                                        "absolute left-1 top-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200",
                                        activeContext === "realtime" ? "translate-x-7 ring-2 ring-emerald-300" : "translate-x-0"
                                    )} />
                                </div>
                                <div className="ml-3 text-xs text-warm-brown/70 font-medium">
                                    {activeContext === "mock" ? "Mock" : "Realtime"}
                                </div>
                            </div>
                        )}

                        {(isAdminRoute || isCandidateRoute) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleLogout}
                                className="text-warm-brown/60 hover:text-warm-brown transition-all duration-200 hover:-translate-y-0.5 hover:bg-red-50/50"
                            >
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                                Logout
                            </Button>
                        )}
                    </div>

                    {/* Mobile Menu Button */}
                    <div className="md:hidden flex items-center space-x-2">
                        {(isAdminRoute || isCandidateRoute) && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleLogout}
                                className="text-warm-brown/60 hover:text-warm-brown btn-touch"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                </svg>
                            </Button>
                        )}
                        {navigationItems.length > 0 && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                                className="text-warm-brown/60 hover:text-warm-brown btn-touch"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    {isMobileMenuOpen ? (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                                    ) : (
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                                    )}
                                </svg>
                            </Button>
                        )}
                    </div>
                </nav>
            </header>

            {/* Mobile Menu Overlay */}
            {isMobileMenuOpen && navigationItems.length > 0 && (
                <div className="fixed inset-0 z-40 md:hidden">
                    <div
                        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                    <div className="fixed top-20 left-4 right-4 bg-white/95 backdrop-blur-sm border border-warm-brown/10 rounded-2xl shadow-xl p-4 space-y-2">
                        {navigationItems.map((item) => (
                            <button
                                key={item.href}
                                onClick={() => {
                                    router.push(item.href)
                                    setIsMobileMenuOpen(false)
                                }}
                                className={cn(
                                    "w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 btn-touch",
                                    pathname === item.href
                                        ? "bg-warm-brown/10 text-warm-brown"
                                        : "text-warm-brown/60 hover:text-warm-brown hover:bg-warm-brown/5"
                                )}
                            >
                                {item.label}
                            </button>
                        ))}

                        {/* Mobile Context Switcher */}
                        {isAdminRoute && (
                            <div className="border-t border-warm-brown/10 pt-3 mt-3">
                                <div className="px-4 pb-2">
                                    <span className="text-xs font-medium text-warm-brown/70">Data Source</span>
                                </div>
                                <div className="px-4">
                                    <div className="flex items-center space-x-3">
                                        <div
                                            role="switch"
                                            aria-checked={activeContext === "realtime"}
                                            tabIndex={0}
                                            onClick={() => setActiveContext(activeContext === "mock" ? "realtime" : "mock")}
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter" || e.key === " ") {
                                                    setActiveContext(activeContext === "mock" ? "realtime" : "mock")
                                                }
                                            }}
                                            className={cn(
                                                "relative inline-flex items-center w-14 h-7 rounded-full cursor-pointer select-none transition-colors duration-200",
                                                activeContext === "realtime" ? "bg-emerald-400/25" : "bg-warm-brown/10"
                                            )}
                                        >
                                            <span className={cn(
                                                "absolute left-1 top-1 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200",
                                                activeContext === "realtime" ? "translate-x-7 ring-2 ring-emerald-300" : "translate-x-0"
                                            )} />
                                        </div>
                                        <div className="text-sm font-medium text-warm-brown/70">
                                            {activeContext === "mock" ? "Mock" : "Realtime"}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </>
    )
}
