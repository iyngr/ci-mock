"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function LiveInterviewsDeprecated() {
    const router = useRouter()

    useEffect(() => {
        const t = setTimeout(() => router.replace('/admin/report'), 50)
        return () => clearTimeout(t)
    }, [router])

    return (
        <div className="min-h-screen bg-warm-background flex items-center justify-center p-6">
            <div className="bg-white/70 backdrop-blur-md border border-warm-brown/10 rounded-2xl p-8 text-center max-w-lg w-full">
                <h1 className="text-2xl font-light text-warm-brown mb-2">Live Interviews moved</h1>
                <p className="text-warm-brown/70 font-light mb-6">
                    This page has been replaced by the Reports section. Redirecting…
                </p>
                <button
                    onClick={() => router.replace('/admin/report')}
                    className="px-4 py-2 rounded-lg bg-warm-brown/90 text-white"
                >
                    Go to Reports
                </button>
            </div>
        </div>
    )
}