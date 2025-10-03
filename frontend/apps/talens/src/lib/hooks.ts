/**
 * Custom hooks for Talens (AI Realtime Interview) - Phase 6 Integration
 * 
 * These hooks integrate with backend APIs for:
 * - Assessment readiness checks (live interview)
 * - Timer synchronization (live interview)
 * - Auto-submission state (live interview)
 * - System checks (microphone, internet, WebRTC)
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { apiFetch } from './apiClient'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface AssessmentReadiness {
    ready: boolean
    status: 'ready' | 'generating' | 'partially_generated' | 'generation_failed'
    total_questions: number
    ready_questions: number
    message: string
    retry_recommended?: boolean
}

export interface TimerSyncResponse {
    time_remaining_seconds: number
    time_expired: boolean
    grace_period_active: boolean
    grace_period_remaining: number
    current_server_time: string
}

export interface SubmissionResponse {
    success: boolean
    submission_id: string
    auto_submitted?: boolean
    auto_submit_reason?: string
    auto_submit_timestamp?: string
    submission_timestamp: string
}

export interface BandwidthResult {
    download: number  // Mbps
    upload: number    // Mbps
    latency: number   // ms
}

export interface SystemCheckResult {
    mic_status: 'granted' | 'denied' | 'error'
    mic_level: number
    internet_status: 'good' | 'poor' | 'error'
    bandwidth: BandwidthResult
    webrtc_status: 'supported' | 'unsupported'
}

// ============================================================================
// HOOK: useAssessmentReadiness
// ============================================================================

/**
 * Checks if a live interview assessment is ready to start.
 * Polls the backend readiness endpoint and returns current status.
 * 
 * @param testId - Assessment ID
 * @param enabled - Whether to enable polling (default: true)
 * @returns Readiness state and refresh function
 */
export function useAssessmentReadiness(testId: string | null, enabled: boolean = true) {
    const [readiness, setReadiness] = useState<AssessmentReadiness | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const pollCount = useRef(0)

    const checkReadiness = useCallback(async () => {
        if (!testId || !enabled) {
            setLoading(false)
            return
        }

        try {
            const data = await apiFetch<AssessmentReadiness>(
                `/api/live-interview/assessment/${testId}/readiness`
            )
            setReadiness(data)
            setError(null)
            pollCount.current = 0 // Reset poll count on success
        } catch (err: any) {
            console.error('Readiness check failed:', err)
            setError(err.message || 'Failed to check assessment readiness')
        } finally {
            setLoading(false)
        }
    }, [testId, enabled])

    useEffect(() => {
        // Initial check
        checkReadiness()

        // Poll if status is 'generating' with exponential backoff
        if (readiness?.status === 'generating') {
            pollCount.current++

            // Exponential backoff: 5s, 7.5s, 11.25s, ... max 30s
            const pollInterval = Math.min(5000 * Math.pow(1.5, pollCount.current), 30000)

            const interval = setInterval(checkReadiness, pollInterval)
            return () => clearInterval(interval)
        }
    }, [checkReadiness, readiness?.status])

    return {
        readiness,
        loading,
        error,
        refresh: checkReadiness
    }
}

// ============================================================================
// HOOK: useTimerSync
// ============================================================================

/**
 * Synchronizes local timer with backend every 30 seconds.
 * Handles grace period and auto-submission triggers for live interviews.
 * 
 * @param testId - Assessment ID
 * @param enabled - Whether to enable sync (default: true)
 * @returns Timer state and sync function
 */
export function useTimerSync(testId: string | null, enabled: boolean = true) {
    const [timeRemaining, setTimeRemaining] = useState<number>(0)
    const [graceActive, setGraceActive] = useState(false)
    const [graceRemaining, setGraceRemaining] = useState(0)
    const [timeExpired, setTimeExpired] = useState(false)
    const [syncing, setSyncing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const lastSyncTime = useRef<number>(Date.now())

    const syncTimer = useCallback(async () => {
        if (!testId || !enabled) return

        setSyncing(true)
        try {
            const data = await apiFetch<TimerSyncResponse>(
                `/api/live-interview/assessment/${testId}/timer`
            )

            if (data.time_expired) {
                setTimeExpired(true)

                if (data.grace_period_active) {
                    setGraceActive(true)
                    setGraceRemaining(data.grace_period_remaining)
                } else {
                    // Grace period ended, trigger auto-submission
                    setGraceActive(false)
                    setGraceRemaining(0)
                }
            } else {
                // Smooth sync: only update if difference is > 5 seconds
                const currentTime = timeRemaining
                const newTime = data.time_remaining_seconds
                const diff = Math.abs(newTime - currentTime)

                if (diff > 5 || currentTime === 0) {
                    setTimeRemaining(newTime)
                }

                setTimeExpired(false)
                setGraceActive(false)
            }

            lastSyncTime.current = Date.now()
            setError(null)
        } catch (err: any) {
            console.error('Timer sync failed:', err)
            setError(err.message || 'Failed to sync timer')
        } finally {
            setSyncing(false)
        }
    }, [testId, enabled, timeRemaining])

    useEffect(() => {
        if (!enabled) return

        // Initial sync
        syncTimer()

        // Sync every 30 seconds (more frequent for realtime interviews)
        const syncInterval = setInterval(syncTimer, 30000)

        // Local countdown every second
        const countdownInterval = setInterval(() => {
            setTimeRemaining(prev => {
                if (prev <= 0) return 0
                return prev - 1
            })

            if (graceActive) {
                setGraceRemaining(prev => {
                    if (prev <= 0) return 0
                    return prev - 1
                })
            }
        }, 1000)

        return () => {
            clearInterval(syncInterval)
            clearInterval(countdownInterval)
        }
    }, [enabled, syncTimer, graceActive])

    return {
        timeRemaining,
        graceActive,
        graceRemaining,
        timeExpired,
        syncing,
        error,
        syncTimer
    }
}

// ============================================================================
// HOOK: useAutoSubmission
// ============================================================================

/**
 * Reads auto-submission data from localStorage.
 * Used on success page to show submission details.
 * 
 * @returns Auto-submission data
 */
export function useAutoSubmission() {
    const [submissionData, setSubmissionData] = useState<{
        auto_submitted: boolean
        auto_submit_reason: string | null
        auto_submit_timestamp: number | null
    }>({
        auto_submitted: false,
        auto_submit_reason: null,
        auto_submit_timestamp: null
    })

    useEffect(() => {
        if (typeof window === 'undefined') return

        // Read from localStorage (set during submission)
        const data = localStorage.getItem('talens_submission_data')
        if (data) {
            try {
                setSubmissionData(JSON.parse(data))
            } catch (err) {
                console.error('Failed to parse submission data:', err)
            }
        }
    }, [])

    return submissionData
}

// ============================================================================
// HOOK: useSystemCheck
// ============================================================================

/**
 * Validates microphone, internet, and WebRTC before interview starts.
 * 
 * @returns System check functions and state
 */
export function useSystemCheck() {
    const [micStatus, setMicStatus] = useState<'checking' | 'granted' | 'denied' | 'error'>('checking')
    const [micLevel, setMicLevel] = useState(0)
    const [internetStatus, setInternetStatus] = useState<'checking' | 'good' | 'poor' | 'error'>('checking')
    const [bandwidth, setBandwidth] = useState<BandwidthResult>({ download: 0, upload: 0, latency: 0 })
    const [webrtcStatus, setWebrtcStatus] = useState<'checking' | 'supported' | 'unsupported'>('checking')

    // Microphone check
    const checkMicrophone = useCallback(async () => {
        setMicStatus('checking')

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            })

            setMicStatus('granted')

            // Audio level monitoring
            const audioContext = new AudioContext()
            const analyser = audioContext.createAnalyser()
            const microphone = audioContext.createMediaStreamSource(stream)
            microphone.connect(analyser)
            analyser.fftSize = 256

            const dataArray = new Uint8Array(analyser.frequencyBinCount)

            const updateLevel = () => {
                analyser.getByteFrequencyData(dataArray)
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length
                setMicLevel(Math.round((average / 255) * 100))
            }

            const levelInterval = setInterval(updateLevel, 100)

            // Cleanup function
            return () => {
                clearInterval(levelInterval)
                stream.getTracks().forEach(track => track.stop())
                audioContext.close()
            }
        } catch (err: any) {
            console.error('Microphone check failed:', err)
            setMicStatus(err.name === 'NotAllowedError' ? 'denied' : 'error')
        }
    }, [])

    // Internet bandwidth check
    const checkInternet = useCallback(async () => {
        setInternetStatus('checking')

        try {
            // Download test (500KB sample)
            const downloadStart = performance.now()
            const downloadResponse = await fetch('https://httpbin.org/bytes/500000')
            await downloadResponse.arrayBuffer()
            const downloadTime = (performance.now() - downloadStart) / 1000
            const downloadSpeed = (500000 * 8) / (downloadTime * 1000000) // Mbps

            // Upload test (100KB)
            const uploadStart = performance.now()
            await fetch('https://httpbin.org/post', {
                method: 'POST',
                body: new Blob([new ArrayBuffer(100000)])
            })
            const uploadTime = (performance.now() - uploadStart) / 1000
            const uploadSpeed = (100000 * 8) / (uploadTime * 1000000) // Mbps

            // Latency test (3 pings for average)
            const latencies = []
            for (let i = 0; i < 3; i++) {
                const pingStart = performance.now()
                await fetch('https://httpbin.org/get', { method: 'HEAD' })
                latencies.push(performance.now() - pingStart)
            }
            const avgLatency = latencies.reduce((a, b) => a + b) / latencies.length

            setBandwidth({
                download: Math.round(downloadSpeed * 10) / 10,
                upload: Math.round(uploadSpeed * 10) / 10,
                latency: Math.round(avgLatency)
            })

            // Determine status based on requirements
            const isGood =
                downloadSpeed >= 1.5 &&
                uploadSpeed >= 0.5 &&
                avgLatency <= 150

            setInternetStatus(isGood ? 'good' : 'poor')
        } catch (err) {
            console.error('Internet check failed:', err)
            setInternetStatus('error')
        }
    }, [])

    // WebRTC connectivity test
    const checkWebRTC = useCallback(async () => {
        setWebrtcStatus('checking')

        try {
            // 1. Check browser support
            const hasRTC = !!(window.RTCPeerConnection && navigator.mediaDevices)
            if (!hasRTC) {
                setWebrtcStatus('unsupported')
                return
            }

            // 2. Test STUN server connectivity
            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' }
                ]
            })

            // 3. Create dummy data channel
            pc.createDataChannel('test')

            // 4. Create offer and gather ICE candidates
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)

            // 5. Wait for ICE candidates
            const candidates: RTCIceCandidate[] = []

            const candidatePromise = new Promise<void>((resolve) => {
                pc.onicecandidate = (event) => {
                    if (event.candidate) {
                        candidates.push(event.candidate)
                    } else {
                        resolve()
                    }
                }

                setTimeout(resolve, 5000) // 5s timeout
            })

            await candidatePromise
            pc.close()

            // 6. Determine success
            setWebrtcStatus(candidates.length > 0 ? 'supported' : 'unsupported')

        } catch (err) {
            console.error('WebRTC check failed:', err)
            setWebrtcStatus('unsupported')
        }
    }, [])

    return {
        micStatus,
        micLevel,
        internetStatus,
        bandwidth,
        webrtcStatus,
        checkMicrophone,
        checkInternet,
        checkWebRTC
    }
}

// ============================================================================
// UTILITY: Format time remaining
// ============================================================================

export function formatTimeRemaining(seconds: number): string {
    if (seconds <= 0) return '00:00:00'

    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60

    return [hours, minutes, secs]
        .map(n => n.toString().padStart(2, '0'))
        .join(':')
}
