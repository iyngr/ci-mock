"use client"

import { create } from "zustand"

export type AdminSource = "mock" | "realtime"

interface AdminContextState {
    activeContext: AdminSource
    setActiveContext: (context: AdminSource) => void
}

const DEFAULT_SOURCE: AdminSource = "mock"

// Initialize store with server-safe default. We'll hydrate from localStorage on mount
export const useAdminContext = create<AdminContextState>((set) => ({
    activeContext: DEFAULT_SOURCE,
    setActiveContext: (context: AdminSource) => {
        set({ activeContext: context })
        try {
            if (typeof window !== "undefined") {
                localStorage.setItem("adminSource", context)
            }
        } catch (e) {
            // ignore
        }
    },
}))

// Hydrate the Zustand store from localStorage on client mount to avoid
// reading localStorage during module evaluation (which causes hydration mismatches).
export const hydrateAdminContextFromStorage = () => {
    try {
        if (typeof window === "undefined") return
        const s = localStorage.getItem("adminSource") as AdminSource | null
        if (s === "mock" || s === "realtime") {
            useAdminContext.getState().setActiveContext(s)
        }
    } catch (e) {
        // ignore
    }
}

export const adminContextOptions: Array<{ value: AdminSource; label: string }> = [
    { value: "mock", label: "Mock" },
    { value: "realtime", label: "Realtime" },
]

// Backend canonical source strings expected by the API
export type BackendSource = "smart-mock" | "talens-interview"

const UI_TO_BACKEND: Record<AdminSource, BackendSource> = {
    mock: "smart-mock",
    realtime: "talens-interview",
}

export const uiToBackend = (ui: AdminSource): BackendSource => UI_TO_BACKEND[ui]

// Returns the backend-canonical source string for API calls
export const getActiveAdminSource = (): BackendSource => {
    const ui = useAdminContext.getState().activeContext
    return uiToBackend(ui)
}