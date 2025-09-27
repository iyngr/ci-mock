"use client"

import React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"
import { ProctoringEvent } from "@/lib/schema"
import Editor from "@monaco-editor/react"

// Cryptographically secure random string generator
function generateSecureRandomString(length: number): string {
    if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
        const bytes = new Uint8Array(length);
        window.crypto.getRandomValues(bytes);
        // Encode as base36 for similarity to original, filter out any leading zeros
        return Array.from(bytes).map(b => b.toString(36)).join('').substr(0, length);
    } else {
        // If crypto is not available, throw an error instead of falling back to insecure randomness
        throw new Error("Secure random number generator is not available.");
    }
}

// Types for speech-to-speech
type EphemeralKey = {
    sessionId: string
    ephemeralKey: string
    webrtcUrl: string
    voice: string
    expiresAt: number
}

type Plan = {
    assessmentId: string
    role?: string
    duration_minutes: number
    sections: Array<{ title: string; items: unknown[] }>
}

type AIState = 'idle' | 'speaking' | 'listening' | 'thinking'

// AI Avatar Component
const AIAvatar = ({ state }: { state: AIState }) => {
    const avatarClasses = {
        idle: "bg-neutral-700 border-neutral-600",
        speaking: "bg-amber-500 border-amber-400 animate-pulse shadow-lg shadow-amber-500/50",
        listening: "bg-blue-500 border-blue-400 animate-pulse shadow-lg shadow-blue-500/50",
        thinking: "bg-purple-500 border-purple-400 animate-bounce shadow-lg shadow-purple-500/50"
    }

    const statusText = {
        idle: "Ready",
        speaking: "Speaking...",
        listening: "Listening...",
        thinking: "Thinking..."
    }

    return (
        <div className="flex flex-col items-center space-y-4">
            <div className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all duration-300 ${avatarClasses[state]}`}>
                <div className="text-white text-4xl">🤖</div>
            </div>
            <div className="text-center">
                <p className="text-lg font-medium text-neutral-200">{statusText[state]}</p>
                <p className="text-sm text-neutral-400">AI Technical Interviewer</p>
            </div>
        </div>
    )
}

// Warning Modal Component - designed to work in fullscreen
const WarningModal = ({ onContinue, violationCount }: { onContinue: () => void, violationCount: number }) => (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999]" style={{ zIndex: 2147483647 }}>
        <AnimateOnScroll animation="fadeInUp">
            <div className="bg-white/95 backdrop-blur-sm border border-red-200/50 rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </div>
                <h2 className="text-xl font-medium text-red-600 mb-4">Warning {violationCount} of 3</h2>
                <p className="text-warm-brown/70 font-light mb-4 leading-relaxed">
                    You attempted to exit the assessment window. This is not allowed during the test.
                </p>
                <p className="text-sm text-warm-brown/60 font-light mb-6">
                    You have <strong>{3 - violationCount}</strong> warning{3 - violationCount !== 1 ? 's' : ''} remaining before your assessment will be automatically submitted.
                </p>
                <Button onClick={onContinue} className="w-full h-12 font-light">
                    Return to Assessment
                </Button>
            </div>
        </AnimateOnScroll>
    </div>
)

// Notification Component for copy/paste attempts
const Notification = ({ message, onClose }: { message: string, onClose: () => void }) => (
    <AnimateOnScroll animation="fadeInUp">
        <div className="fixed top-6 right-6 bg-red-500/95 backdrop-blur-sm text-white px-6 py-4 rounded-xl shadow-lg z-50 flex items-center space-x-3 border border-red-400/20">
            <div className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
            </div>
            <span className="text-sm font-light">{message}</span>
            <button onClick={onClose} className="text-white/80 hover:text-white font-light text-lg">×</button>
        </div>
    </AnimateOnScroll>
)

export default function AIInterviewPage() {
    const [testData, setTestData] = useState<{ id: string } | null>(null)
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
    const [answers, setAnswers] = useState<{ [key: number]: { code?: string; language?: string; output?: string; error?: string } }>({})
    const [timeRemaining, setTimeRemaining] = useState<number>(0)
    const [isFullscreen, setIsFullscreen] = useState(false)
    const [proctoringEvents, setProctoringEvents] = useState<ProctoringEvent[]>([])
    const [candidateId, setCandidateId] = useState<string>("")

    // AI Interview State
    const [aiState, setAiState] = useState<AIState>('idle')
    const [ephemeralKey, setEphemeralKey] = useState<EphemeralKey | null>(null)
    const [isConnected, setIsConnected] = useState(false)
    const [transcript, setTranscript] = useState<string>("")
    // Structured transcript (assembled from realtime events)
    const [turns, setTurns] = useState<Array<{ id: string; role: 'user' | 'assistant'; text: string; finalized: boolean; moderationLabel?: 'safe' | 'flagged' }>>([])
    const partialBufferRef = useRef<string>("")
    const currentTurnIdRef = useRef<string | null>(null)
    const dcRef = useRef<RTCDataChannel | null>(null)
    const [plan, setPlan] = useState<Plan | null>(null)
    const [consentTimestamp, setConsentTimestamp] = useState<number | null>(null)
    const [sessionId, setSessionId] = useState<string>(() => `session_${Date.now()}_${generateSecureRandomString(16)}`)
    const [conversationTurns, setConversationTurns] = useState<Array<{ role: string, text: string, started_at: number, ended_at: number }>>([])

    // Error handling state
    const [error, setError] = useState<string | null>(null)
    const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected')
    const [retryCount, setRetryCount] = useState(0)
    const [isReconnecting, setIsReconnecting] = useState(false)
    const [lastError, setLastError] = useState<{ type: string, message: string, timestamp: number } | null>(null)

    // WebRTC Audio State Management
    const [audioState, setAudioState] = useState<'muted' | 'unmuted' | 'speaking' | 'error'>('muted')
    const [audioQuality, setAudioQuality] = useState<'excellent' | 'good' | 'poor' | 'unknown'>('unknown')
    const [microphonePermission, setMicrophonePermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>('unknown')
    const [audioLevel, setAudioLevel] = useState<number>(0) // 0-100 for visualization
    const [isAudioEnabled, setIsAudioEnabled] = useState(false)
    const [webrtcState, setWebrtcState] = useState<'new' | 'connecting' | 'connected' | 'disconnected' | 'failed' | 'closed'>('new')

    const pcRef = useRef<RTCPeerConnection | null>(null)
    const audioRef = useRef<HTMLAudioElement | null>(null)
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const localStreamRef = useRef<MediaStream | null>(null)
    const remoteStreamRef = useRef<MediaStream | null>(null)
    const audioAnalyzerRef = useRef<AnalyserNode | null>(null)
    const audioContextRef = useRef<AudioContext | null>(null)
    const micLevelIntervalRef = useRef<NodeJS.Timeout | null>(null)

    // Proctoring violations tracking
    const [violations, setViolations] = useState({
        tabSwitches: 0,
        windowBlur: 0,
        fullscreenExits: 0,
        contextMenuAttempts: 0,
        copyAttempts: 0,
        pasteAttempts: 0,
        cutAttempts: 0,
        keyboardShortcuts: 0
    })

    // Notification state for copy/paste warnings
    const [notification, setNotification] = useState<{ message: string, id: number } | null>(null)
    const [showWarningModal, setShowWarningModal] = useState(false)
    const [violationCount, setViolationCount] = useState(0)

    const violationLimits = {
        tabSwitches: 3,
        windowBlur: 5,
        fullscreenExits: 2,
        contextMenuAttempts: 10,
        copyAttempts: 5,
        pasteAttempts: 5,
        cutAttempts: 5,
        keyboardShortcuts: 10
    }

    const logProctoringEvent = useCallback((eventType: string, details: Record<string, unknown>) => {
        const event: ProctoringEvent = {
            timestamp: new Date().toISOString(),
            eventType,
            details
        }
        setProctoringEvents(prev => [...prev, event])
        console.log("Proctoring Event:", event)
    }, [])

    // Error handling utilities
    const logError = useCallback((type: string, message: string, error?: any) => {
        const errorInfo = {
            type,
            message,
            timestamp: Date.now(),
            details: error ? error.toString() : undefined
        }
        setLastError(errorInfo)
        console.error(`[${type}] ${message}`, error)

        // Log as proctoring event for monitoring
        logProctoringEvent('error', errorInfo)
    }, [logProctoringEvent])

    const clearError = useCallback(() => {
        setError(null)
        setLastError(null)
    }, [])

    // Notification system for copy/paste warnings
    const showNotification = useCallback((message: string) => {
        const id = Date.now()
        setNotification({ message, id })

        // Auto-hide notification after 3 seconds
        setTimeout(() => {
            setNotification(prev => prev?.id === id ? null : prev)
        }, 3000)
    }, [])

    // Handle violation warnings and fullscreen return
    const handleViolation = useCallback((violationType: string) => {
        setViolationCount(prev => prev + 1)
        setShowWarningModal(true)
        logProctoringEvent(violationType, { violationCount: violationCount + 1 })
    }, [violationCount, logProctoringEvent])

    const handleReturnToTest = useCallback(async () => {
        setShowWarningModal(false)
        // Force back to fullscreen when returning to test
        if (!document.fullscreenElement) {
            const enterFullscreen = async () => {
                try {
                    await document.documentElement.requestFullscreen()
                    setIsFullscreen(true)
                } catch (error) {
                    console.error("Failed to enter fullscreen:", error)
                }
            }
            await enterFullscreen()
        }
    }, [])

    const handleApiError = useCallback(async (response: Response, context: string) => {
        let errorMessage = `${context} failed with status ${response.status}`
        try {
            const errorData = await response.json()
            errorMessage = errorData.detail || errorData.message || errorMessage
        } catch {
            errorMessage = `${context} failed: ${response.statusText || 'Unknown error'}`
        }
        throw new Error(errorMessage)
    }, [])

    const retryWithBackoff = useCallback(async (
        operation: () => Promise<any>,
        context: string,
        maxRetries: number = 3
    ) => {
        let lastError: Error

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await operation()
            } catch (error) {
                lastError = error instanceof Error ? error : new Error(String(error))

                if (attempt === maxRetries) {
                    logError('retry_exhausted', `${context} failed after ${maxRetries + 1} attempts`, lastError)
                    throw lastError
                }

                const delay = Math.min(1000 * Math.pow(2, attempt), 10000) // Exponential backoff, max 10s
                await new Promise(resolve => setTimeout(resolve, delay))

                logError('retry_attempt', `${context} attempt ${attempt + 1} failed, retrying in ${delay}ms`, lastError)
            }
        }

        throw lastError!
    }, [logError])

    const handleWebRTCError = useCallback((error: any, context: string) => {
        logError('webrtc_error', `WebRTC ${context} error`, error)
        setConnectionStatus('error')

        // Attempt reconnection if not already reconnecting
        if (!isReconnecting && retryCount < 5) {
            setIsReconnecting(true)
            setRetryCount(prev => prev + 1)

            const delay = Math.min(2000 * Math.pow(2, retryCount), 30000) // Exponential backoff, max 30s
            reconnectTimeoutRef.current = setTimeout(() => {
                initializeWebRTC()
            }, delay)
        }
    }, [logError, isReconnecting, retryCount])

    const initializeWebRTC = useCallback(async () => {
        try {
            setConnectionStatus('connecting')
            setError(null)

            // Get ephemeral token with retry logic
            const tokenResponse = await retryWithBackoff(async () => {
                const response = await fetch('/api/live-interview/realtime/ephemeral', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ session_id: sessionId })
                })
                if (!response.ok) await handleApiError(response, 'Ephemeral token generation')
                return response.json()
            }, 'Ephemeral token generation')

            setEphemeralKey(tokenResponse)

            // Request microphone access if not already granted
            if (microphonePermission !== 'granted') {
                await requestMicrophoneAccess()
            }

            // Create and configure WebRTC peer connection
            const pc = await createPeerConnection()
            setWebrtcState('connecting')

            // In a real implementation, this would:
            // 1. Create offer/answer for WebRTC negotiation
            // 2. Exchange ICE candidates with signaling server
            // 3. Establish audio connection with Azure OpenAI Realtime API

            // For now, simulate successful connection
            setTimeout(() => {
                setConnectionStatus('connected')
                setWebrtcState('connected')
                setIsReconnecting(false)
                setRetryCount(0)
            }, 1000)

        } catch (error) {
            handleWebRTCError(error, 'initialization')
        }
    }, [sessionId, retryWithBackoff, handleApiError, handleWebRTCError, microphonePermission])

    // Cleanup effect for reconnection timeout
    useEffect(() => {
        let reconnectionTimeout: NodeJS.Timeout | null = null

        if (isReconnecting && retryCount < 3) {
            const delay = Math.pow(2, retryCount) * 1000
            reconnectionTimeout = setTimeout(() => {
                initializeWebRTC()
            }, delay)
        }

        return () => {
            if (reconnectionTimeout) {
                clearTimeout(reconnectionTimeout)
            }
        }
    }, [isReconnecting, retryCount, initializeWebRTC])

    // Audio Quality Monitoring
    const startAudioLevelMonitoring = useCallback((stream: MediaStream) => {
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)()
            }

            const audioContext = audioContextRef.current
            const source = audioContext.createMediaStreamSource(stream)
            const analyzer = audioContext.createAnalyser()

            analyzer.fftSize = 256
            analyzer.smoothingTimeConstant = 0.8
            source.connect(analyzer)
            audioAnalyzerRef.current = analyzer

            const dataArray = new Uint8Array(analyzer.frequencyBinCount)

            const updateAudioLevel = () => {
                if (audioAnalyzerRef.current) {
                    audioAnalyzerRef.current.getByteFrequencyData(dataArray)
                    const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length
                    const normalizedLevel = Math.min(100, (average / 255) * 100)

                    setAudioLevel(normalizedLevel)

                    // Update audio quality based on consistency and level
                    if (normalizedLevel > 50) {
                        setAudioQuality('excellent')
                        setAudioState('speaking')
                    } else if (normalizedLevel > 20) {
                        setAudioQuality('good')
                        setAudioState('unmuted')
                    } else if (normalizedLevel > 5) {
                        setAudioQuality('poor')
                        setAudioState('unmuted')
                    } else {
                        setAudioState('unmuted')
                    }
                }
            }

            micLevelIntervalRef.current = setInterval(updateAudioLevel, 100)
        } catch (error) {
            logError('audio_monitoring', 'Failed to start audio level monitoring', error)
            setAudioQuality('unknown')
        }
    }, [logError])

    const stopAudioLevelMonitoring = useCallback(() => {
        if (micLevelIntervalRef.current) {
            clearInterval(micLevelIntervalRef.current)
            micLevelIntervalRef.current = null
        }
        if (audioContextRef.current) {
            audioContextRef.current.close()
            audioContextRef.current = null
        }
        audioAnalyzerRef.current = null
        setAudioLevel(0)
        setAudioState('muted')
    }, [])

    // Microphone Permission and Setup
    const requestMicrophoneAccess = useCallback(async () => {
        try {
            setMicrophonePermission('prompt')

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 44100
                }
            })

            localStreamRef.current = stream
            setMicrophonePermission('granted')
            setIsAudioEnabled(true)
            setAudioState('unmuted')

            // Start monitoring audio levels
            startAudioLevelMonitoring(stream)

            return stream
        } catch (error) {
            setMicrophonePermission('denied')
            setIsAudioEnabled(false)
            setAudioState('error')

            if (error instanceof Error) {
                if (error.name === 'NotAllowedError') {
                    logError('microphone_permission', 'Microphone access denied by user', error)
                    setError('Microphone access is required for voice interviews. Please enable microphone permissions and refresh.')
                } else if (error.name === 'NotFoundError') {
                    logError('microphone_hardware', 'No microphone found', error)
                    setError('No microphone detected. Please connect a microphone and try again.')
                } else {
                    logError('microphone_error', 'Failed to access microphone', error)
                    setError('Failed to access microphone. Please check your audio settings.')
                }
            }
            throw error
        }
    }, [startAudioLevelMonitoring, logError])

    // WebRTC Connection Management
    const createPeerConnection = useCallback(async () => {
        try {
            // Clean up existing connection
            if (pcRef.current) {
                pcRef.current.close()
            }

            const pc = new RTCPeerConnection({
                iceServers: [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            })

            // Connection state monitoring
            pc.onconnectionstatechange = () => {
                const state = pc.connectionState
                setWebrtcState(state as any)

                switch (state) {
                    case 'connected':
                        setConnectionStatus('connected')
                        setIsReconnecting(false)
                        setRetryCount(0)
                        break
                    case 'disconnected':
                        setConnectionStatus('disconnected')
                        handleWebRTCError(new Error('WebRTC connection lost'), 'connection_lost')
                        break
                    case 'failed':
                        setConnectionStatus('error')
                        handleWebRTCError(new Error('WebRTC connection failed'), 'connection_failed')
                        break
                    case 'closed':
                        setConnectionStatus('disconnected')
                        stopAudioLevelMonitoring()
                        break
                }
            }

            // Handle remote audio stream
            pc.ontrack = (event) => {
                const [remoteStream] = event.streams
                remoteStreamRef.current = remoteStream

                if (audioRef.current) {
                    audioRef.current.srcObject = remoteStream
                    audioRef.current.play().catch(error => {
                        logError('audio_playback', 'Failed to play remote audio', error)
                    })
                }
            }

            // ICE candidate handling
            pc.onicecandidate = (event) => {
                if (event.candidate) {
                    // In a real implementation, send candidates to signaling server
                    console.log('ICE candidate:', event.candidate)
                }
            }

            // Add local stream if available
            if (localStreamRef.current) {
                localStreamRef.current.getTracks().forEach(track => {
                    pc.addTrack(track, localStreamRef.current!)
                })
            }

            pcRef.current = pc
            return pc
        } catch (error) {
            logError('webrtc_setup', 'Failed to create peer connection', error)
            throw error
        }
    }, [handleWebRTCError, stopAudioLevelMonitoring, logError])

    // Audio Controls
    const toggleMicrophone = useCallback(async () => {
        try {
            if (!localStreamRef.current) {
                await requestMicrophoneAccess()
                return
            }

            const audioTrack = localStreamRef.current.getAudioTracks()[0]
            if (audioTrack) {
                const enabled = !audioTrack.enabled
                audioTrack.enabled = enabled
                setIsAudioEnabled(enabled)
                setAudioState(enabled ? 'unmuted' : 'muted')

                if (enabled) {
                    startAudioLevelMonitoring(localStreamRef.current)
                } else {
                    stopAudioLevelMonitoring()
                }
            }
        } catch (error) {
            logError('microphone_toggle', 'Failed to toggle microphone', error)
        }
    }, [requestMicrophoneAccess, startAudioLevelMonitoring, stopAudioLevelMonitoring, logError])

    const cleanupAudioResources = useCallback(() => {
        // Stop audio monitoring
        stopAudioLevelMonitoring()

        // Stop local stream
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => track.stop())
            localStreamRef.current = null
        }

        // Close peer connection
        if (pcRef.current) {
            pcRef.current.close()
            pcRef.current = null
        }

        // Reset states
        setIsAudioEnabled(false)
        setAudioState('muted')
        setAudioQuality('unknown')
        setWebrtcState('closed')
    }, [stopAudioLevelMonitoring])

    // Cleanup effect for audio resources on component unmount
    useEffect(() => {
        return () => {
            cleanupAudioResources()
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
            }
        }
    }, [cleanupAudioResources])

    // Handle user consent for AI interview
    const handleConsent = useCallback(() => {
        const timestamp = Date.now() / 1000 // Unix timestamp in seconds
        setConsentTimestamp(timestamp)
        console.log("Consent given at:", new Date(timestamp * 1000).toISOString())
    }, [])

    // Analyze answer with LLM agent
    const analyzeAnswer = useCallback(async (answerText: string, questionType: string = "descriptive") => {
        try {
            return await retryWithBackoff(async () => {
                const response = await fetch('/api/live-interview/analyze', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: answerText,
                        question_type: questionType,
                        min_tokens: 30,
                        persona: "technical_interviewer"
                    })
                })

                if (!response.ok) await handleApiError(response, 'Answer analysis')
                return response.json()
            }, 'Answer analysis')
        } catch (error) {
            logError('analysis_error', 'Answer analysis failed, falling back to default behavior', error)
            setError('Failed to analyze your answer. The interview will continue, but AI guidance may be limited.')
            return { decision: "CONTINUE", reason: "Analysis failed, continuing", follow_up: null }
        }
    }, [retryWithBackoff, handleApiError, logError])

    // Orchestrate interview flow based on events
    const orchestrateInterview = useCallback(async (event: string, payload?: any) => {
        try {
            return await retryWithBackoff(async () => {
                const response = await fetch('/api/live-interview/orchestrate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event,
                        context: {
                            session_id: sessionId,
                            assessment_id: testData?.id,
                            current_question: currentQuestionIndex,
                            time_remaining: timeRemaining,
                            question_type: "descriptive", // Could be enhanced to detect actual type
                            progress: `${currentQuestionIndex + 1} of ${plan?.sections?.length || 1}`
                        },
                        payload
                    })
                })

                if (!response.ok) await handleApiError(response, 'Interview orchestration')
                return response.json()
            }, 'Interview orchestration')
        } catch (error) {
            logError('orchestration_error', 'Interview orchestration failed, using default flow', error)
            setError('Interview guidance is temporarily unavailable. The interview will continue normally.')
            return { next: "continue", prompt: null }
        }
    }, [sessionId, testData?.id, currentQuestionIndex, timeRemaining, plan?.sections?.length, retryWithBackoff, handleApiError, logError])

    // Initialize AI interview session
    const initializeAIInterview = useCallback(async () => {
        try {
            setAiState('thinking')

            // Mint ephemeral key for Azure OpenAI Realtime API
            const keyResponse = await fetch('/api/live-interview/realtime/ephemeral', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    assessment_id: testData?.id,
                    candidate_id: candidateId
                })
            })

            if (!keyResponse.ok) throw new Error('Failed to get ephemeral key')

            const keyData = await keyResponse.json()
            setEphemeralKey(keyData)

            // Initialize WebRTC connection
            await setupWebRTCConnection(keyData)

            setAiState('idle')
        } catch (error) {
            console.error('Failed to initialize AI interview:', error)
            setAiState('idle')
        }
    }, [testData, candidateId])

    // Setup WebRTC connection for speech-to-speech
    const setupWebRTCConnection = async (ephKey: EphemeralKey) => {
        try {
            const pc = new RTCPeerConnection({
                iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
            })

            pcRef.current = pc

            // Get user media (microphone)
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            })

            // Add audio track to peer connection
            stream.getAudioTracks().forEach(track => {
                pc.addTrack(track, stream)
            })

            // Handle incoming audio from AI
            pc.ontrack = (event) => {
                if (audioRef.current) {
                    audioRef.current.srcObject = event.streams[0]
                    audioRef.current.play()
                }
            }

            // Data channel for realtime events (transcripts, etc.)
            pc.ondatachannel = (event) => {
                const channel = event.channel
                dcRef.current = channel
                channel.onopen = () => {
                    console.log('Data channel opened')
                }
                channel.onclose = () => {
                    console.log('Data channel closed')
                }
                channel.onerror = (e) => {
                    console.error('Data channel error', e)
                }
                channel.onmessage = (e) => {
                    try {
                        const msg = JSON.parse(e.data)
                        handleRealtimeEvent(msg)
                    } catch (err) {
                        // Not JSON, ignore
                    }
                }
            }

            // Connection state changes
            pc.onconnectionstatechange = () => {
                setIsConnected(pc.connectionState === 'connected')
                if (pc.connectionState === 'connected') {
                    setAiState('listening')
                }
            }

            // Create offer and connect to Azure OpenAI
            const offer = await pc.createOffer()
            await pc.setLocalDescription(offer)

            // Send offer to Azure OpenAI WebRTC endpoint
            // Support both webrtcUrl and webRtcUrl key shapes
            const webrtcUrl = (ephKey as any).webrtcUrl || (ephKey as any).webRtcUrl
            const token = (ephKey as any).ephemeralKey || (ephKey as any).ephemeral?.client_secret?.value
            const connectResponse = await fetch(webrtcUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sdp: offer.sdp,
                    type: offer.type
                })
            })

            if (!connectResponse.ok) throw new Error('WebRTC connection failed')

            const answer = await connectResponse.json()
            await pc.setRemoteDescription(new RTCSessionDescription(answer))

        } catch (error) {
            console.error('WebRTC setup failed:', error)
        }
    }

    // Handle realtime JSON events sent through the data channel
    const handleRealtimeEvent = useCallback((evt: any) => {
        if (!evt || !evt.type) return

        switch (evt.type) {
            // Transcript assembly
            case 'response.audio_transcript.delta': {
                const text = evt.delta || evt.text || ''
                // Ensure a current turn exists for the assistant
                if (!currentTurnIdRef.current) {
                    const id = `asst_${Date.now()}`
                    currentTurnIdRef.current = id
                    setTurns(prev => [...prev, { id, role: 'assistant', text: '', finalized: false }])
                }
                partialBufferRef.current += text
                // Update UI for the current turn
                const id = currentTurnIdRef.current
                setTurns(prev => prev.map(t => t.id === id ? { ...t, text: partialBufferRef.current } : t))
                setTranscript(partialBufferRef.current)
                setAiState('speaking')
                break
            }
            case 'response.audio_transcript.done': {
                // Finalize current assistant turn
                const id = currentTurnIdRef.current
                if (id) {
                    setTurns(prev => prev.map(t => t.id === id ? { ...t, finalized: true } : t))
                    const turn = turns.find(t => t.id === id)
                    const text = turn?.text || ''
                    if (text) {
                        // Post-response guardrail scrub before moderation
                        fetch('/api/live-interview/guardrails/enforce', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ phase: 'post', text })
                        })
                            .then(r => r.ok ? r.json() : { text })
                            .then(gr => {
                                const scrubbed = gr?.text || text
                                if (scrubbed !== text) {
                                    setTurns(prev => prev.map(t => t.id === id ? { ...t, text: scrubbed } : t))
                                    setTranscript(scrubbed)
                                }
                                // Launch moderation on scrubbed text
                                moderateText(id, scrubbed)
                                // Orchestrate follow-up on scrubbed text
                                orchestrateInterview('assistant_turn_finalized', {
                                    text: scrubbed,
                                    moderationLabel: turn?.moderationLabel,
                                }).then((res) => {
                                    if (res?.next === 'ask_followup' && res?.prompt) {
                                        const followId = `asst_${Date.now()}_follow`
                                        setTurns(prev => [...prev, { id: followId, role: 'assistant', text: res.prompt, finalized: true }])
                                        setTranscript(res.prompt)
                                    }
                                }).catch(() => { })
                            }).catch(() => {
                                // If guardrail call fails, proceed with original text
                                moderateText(id, text)
                                orchestrateInterview('assistant_turn_finalized', { text, moderationLabel: turn?.moderationLabel }).catch(() => { })
                            })
                    }
                }
                currentTurnIdRef.current = null
                partialBufferRef.current = ''
                setAiState('idle')
                break
            }
            case 'input_audio_buffer.speech_started': {
                setAiState('listening')
                break
            }
            case 'input_audio_buffer.speech_stopped': {
                setAiState('thinking')
                break
            }
            default:
                break
        }
    }, [turns])

    const moderateText = useCallback(async (turnId: string, text: string) => {
        try {
            const resp = await fetch('/api/live-interview/moderate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, role: 'assistant' })
            })
            if (!resp.ok) return
            const data = await resp.json()
            const label = (data?.label === 'flagged') ? 'flagged' : 'safe'
            setTurns(prev => prev.map(t => t.id === turnId ? { ...t, moderationLabel: label } : t))
        } catch {
            // Ignore failures; leave as undefined
        }
    }, [])

    // Handle AI state changes based on audio activity
    useEffect(() => {
        if (!isConnected) return

        // Monitor audio activity to update AI state
        const audioContext = new AudioContext()
        const analyser = audioContext.createAnalyser()

        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                const source = audioContext.createMediaStreamSource(stream)
                source.connect(analyser)

                const dataArray = new Uint8Array(analyser.frequencyBinCount)

                const checkAudioActivity = () => {
                    analyser.getByteFrequencyData(dataArray)
                    const sum = dataArray.reduce((a, b) => a + b)
                    const average = sum / dataArray.length

                    // Update AI state based on audio activity
                    if (average > 20) {
                        setAiState('listening')
                    } else if (aiState === 'listening') {
                        setAiState('thinking')
                        // Simulate AI processing time
                        setTimeout(() => setAiState('speaking'), 1000)
                        setTimeout(() => setAiState('idle'), 3000)
                    }

                    requestAnimationFrame(checkAudioActivity)
                }

                checkAudioActivity()
            })
            .catch(console.error)

        return () => {
            audioContext.close()
        }
    }, [isConnected, aiState])

    // Initialize fullscreen and proctoring on mount
    useEffect(() => {
        const enterFullscreen = async () => {
            try {
                await document.documentElement.requestFullscreen()
                setIsFullscreen(true)
            } catch (error) {
                console.error("Failed to enter fullscreen:", error)
            }
        }

        enterFullscreen()

        // Load test data and initialize AI interview
        const testId = localStorage.getItem("testId")
        if (testId) {
            // Load test data (placeholder - adapt to your API)
            setTestData({ id: testId })
            setCandidateId(localStorage.getItem("candidateId") || "test-candidate")
        }

        // Setup proctoring event listeners
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement)
            if (!document.fullscreenElement) {
                handleViolation("fullscreen_exit")
                setViolations(prev => ({ ...prev, fullscreenExits: prev.fullscreenExits + 1 }))
            }
        }

        const handleVisibilityChange = () => {
            if (document.hidden) {
                logProctoringEvent("tab_switch", { message: "User switched tabs" })
                setViolations(prev => ({ ...prev, tabSwitches: prev.tabSwitches + 1 }))
            }
        }

        const handleKeyDown = (e: KeyboardEvent) => {
            // Detect if focus inside monaco editor to allow Esc & shortcuts there
            const active = document.activeElement as HTMLElement | null
            const insideCodeEditor = !!active?.closest('.monaco-editor')

            // Detect Alt+Tab, Windows Key, etc.
            if (e.altKey || e.metaKey) {
                e.preventDefault()
                handleViolation("keyboard_shortcut")
            }

            // Specifically handle Escape key to prevent fullscreen exit
            if (e.key === 'Escape' && !insideCodeEditor) {
                e.preventDefault()
                handleViolation("escape_key")
                return
            }

            // Handle copy/paste/cut/select-all attempts - show notification only (not a violation)
            if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
                e.preventDefault()
                showNotification("📋 Copying is disabled during the assessment")
                logProctoringEvent("copy_paste_attempt", { action: 'copy' })
                return
            }

            if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
                e.preventDefault()
                showNotification("📋 Pasting is disabled during the assessment")
                logProctoringEvent("copy_paste_attempt", { action: 'paste' })
                return
            }

            if (e.ctrlKey && (e.key === 'x' || e.key === 'X')) {
                e.preventDefault()
                showNotification("📋 Cutting is disabled during the assessment")
                logProctoringEvent("copy_paste_attempt", { action: 'cut' })
                return
            }

            if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
                e.preventDefault()
                showNotification("📋 Select all is disabled during the assessment")
                logProctoringEvent("copy_paste_attempt", { action: 'select_all' })
                return
            }

            if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
                e.preventDefault()
                logProctoringEvent("dev_tools_attempt", { message: "Attempted to open developer tools" })
            }
        }

        const handleContextMenu = (e: MouseEvent) => {
            e.preventDefault()
            showNotification("🚫 Right-click is disabled during the assessment")
            logProctoringEvent("context_menu_attempt", { message: "Right-click attempted" })
            setViolations(prev => ({ ...prev, contextMenuAttempts: prev.contextMenuAttempts + 1 }))
        }

        document.addEventListener('fullscreenchange', handleFullscreenChange)
        document.addEventListener('visibilitychange', handleVisibilityChange)
        document.addEventListener('keydown', handleKeyDown)
        document.addEventListener('contextmenu', handleContextMenu)

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
            document.removeEventListener('keydown', handleKeyDown)
            document.removeEventListener('contextmenu', handleContextMenu)
        }
    }, [logProctoringEvent, showNotification, handleViolation])

    // Initialize AI interview when test data is loaded
    useEffect(() => {
        if (testData && candidateId) {
            initializeAIInterview()
        }
    }, [testData, candidateId, initializeAIInterview])

    // Cleanup reconnection timeout on unmount
    useEffect(() => {
        return () => {
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current)
                reconnectTimeoutRef.current = null
            }
        }
    }, [])

    // Code execution for coding questions
    const runCode = async () => {
        const currentAnswer = answers[currentQuestionIndex]
        if (!currentAnswer?.code) return

        try {
            const response = await fetch('/api/live-interview/code/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    language: currentAnswer.language || 'javascript',
                    code: currentAnswer.code
                })
            })

            const result = await response.json()

            // Update answer with execution result
            setAnswers(prev => ({
                ...prev,
                [currentQuestionIndex]: {
                    ...prev[currentQuestionIndex],
                    output: result.stdout,
                    error: result.stderr
                }
            }))

            // Trigger orchestration based on code result
            const orchestrationResult = await orchestrateInterview('code_result', {
                status: result.status,
                stdout: result.stdout,
                stderr: result.stderr,
                code: currentAnswer.code,
                language: currentAnswer.language
            })

            // Handle orchestration response (e.g., show follow-up question)
            if (orchestrationResult.next === 'ask_followup' && orchestrationResult.prompt) {
                // Add AI follow-up to conversation
                setConversationTurns(prev => [...prev, {
                    role: 'assistant',
                    text: orchestrationResult.prompt,
                    started_at: Date.now() / 1000,
                    ended_at: Date.now() / 1000
                }])
            }

        } catch (error) {
            console.error('Code execution failed:', error)
        }
    }

    const updateCode = (code: string) => {
        setAnswers(prev => ({
            ...prev,
            [currentQuestionIndex]: {
                ...prev[currentQuestionIndex],
                code: code
            }
        }))
    }

    // Finalize interview session and persist transcript
    const finalizeInterview = useCallback(async () => {
        try {
            const transcript = {
                schema_version: 1,
                session_id: sessionId,
                assessment_id: testData?.id,
                candidate_id: candidateId,
                consent_at: consentTimestamp,
                turns: conversationTurns,
                coding_tasks: Object.values(answers).map((answer, index) => ({
                    question_index: index,
                    code: answer.code,
                    language: answer.language,
                    output: answer.output,
                    error: answer.error
                })),
                judge0_results: [], // Populated by code execution
                redaction_info: null, // Will be populated by backend
                finalized_at: null // Will be set by backend
            }

            const response = await fetch('/api/live-interview/finalize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(transcript)
            })

            if (!response.ok) throw new Error('Failed to finalize interview')

            const result = await response.json()
            console.log('Interview finalized:', result)
            return result
        } catch (error) {
            console.error('Interview finalization failed:', error)
            throw error
        }
    }, [sessionId, testData?.id, candidateId, consentTimestamp, conversationTurns, answers])

    // Handle timer expiration for answer cutoffs
    const handleAnswerTimeout = useCallback(async () => {
        const orchestrationResult = await orchestrateInterview('timer_expired', {
            current_question: currentQuestionIndex,
            time_elapsed: 300 // example: 5 minute timeout
        })

        if (orchestrationResult.next === 'ask_followup' && orchestrationResult.prompt) {
            // Add AI follow-up to conversation
            setConversationTurns(prev => [...prev, {
                role: 'assistant',
                text: orchestrationResult.prompt,
                started_at: Date.now() / 1000,
                ended_at: Date.now() / 1000
            }])
        }
    }, [currentQuestionIndex, orchestrateInterview])

    if (!testData) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-amber-500 mx-auto"></div>
                    <p className="mt-4 text-lg text-neutral-200">Loading AI Interview...</p>
                </div>
            </div>
        )
    }

    // Show consent screen if consent hasn't been given
    if (!consentTimestamp) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 flex items-center justify-center">
                <div className="max-w-2xl mx-auto p-8 text-center">
                    <h1 className="text-3xl font-bold text-white mb-6">AI Interview Consent</h1>
                    <div className="bg-neutral-800/50 rounded-lg p-6 mb-8 text-left">
                        <h2 className="text-xl font-semibold text-amber-400 mb-4">Before we begin:</h2>
                        <ul className="space-y-3 text-neutral-300">
                            <li>• This interview will be conducted using AI speech-to-speech technology</li>
                            <li>• Your responses will be recorded and transcribed for evaluation purposes</li>
                            <li>• The session may include coding challenges and technical discussions</li>
                            <li>• All data will be handled according to our privacy policy</li>
                            <li>• You can end the interview at any time</li>
                        </ul>
                    </div>
                    <div className="space-y-4">
                        <Button
                            onClick={() => {
                                handleConsent()
                                initializeAIInterview()
                            }}
                            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold px-8 py-3 text-lg"
                        >
                            I Consent - Start AI Interview
                        </Button>
                        <div className="text-sm text-neutral-400">
                            By clicking above, you consent to the recording and processing of your interview data
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-neutral-900 via-neutral-800 to-neutral-900 text-white">
            {/* Hidden audio element for AI voice */}
            <audio ref={audioRef} autoPlay />

            {/* Main Interview Interface */}
            <div className="container mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-2xl font-bold text-amber-400">AI Technical Interview</h1>
                        <p className="text-neutral-400">Real-time speech-to-speech assessment</p>
                    </div>
                    <div className="flex items-center space-x-4">
                        <div className={`px-3 py-1 rounded-full text-sm flex items-center space-x-2 ${connectionStatus === 'connected' ? 'bg-green-500/20 text-green-400' :
                            connectionStatus === 'connecting' ? 'bg-yellow-500/20 text-yellow-400' :
                                connectionStatus === 'error' ? 'bg-red-500/20 text-red-400' :
                                    'bg-gray-500/20 text-gray-400'
                            }`}>
                            {connectionStatus === 'connected' && <span>🟢 Connected</span>}
                            {connectionStatus === 'connecting' && (
                                <>
                                    <div className="w-3 h-3 border border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                                    <span>Connecting...</span>
                                </>
                            )}
                            {connectionStatus === 'error' && <span>🔴 Connection Error</span>}
                            {connectionStatus === 'disconnected' && <span>⚪ Disconnected</span>}
                        </div>
                        <div className="text-sm text-neutral-400">
                            Time: {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                        </div>
                    </div>
                </div>

                {/* Error Display */}
                {error && (
                    <div className="mb-6 bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-start space-x-3">
                        <div className="text-red-400 text-xl">⚠️</div>
                        <div className="flex-1">
                            <div className="text-red-300 font-medium">Connection Issue</div>
                            <div className="text-red-200 text-sm mt-1">{error}</div>
                            {isReconnecting && (
                                <div className="text-red-300 text-sm mt-2 flex items-center space-x-2">
                                    <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                                    <span>Attempting to reconnect... (Attempt {retryCount}/5)</span>
                                </div>
                            )}
                            <button
                                onClick={clearError}
                                className="text-red-300 hover:text-red-200 text-sm underline mt-2"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}

                {/* Connection Status */}
                {connectionStatus === 'error' && !error && (
                    <div className="mb-6 bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 flex items-start space-x-3">
                        <div className="text-orange-400 text-xl">🔄</div>
                        <div className="flex-1">
                            <div className="text-orange-300 font-medium">Connection Problems</div>
                            <div className="text-orange-200 text-sm mt-1">
                                Having trouble connecting to the AI interview system. The interview can continue, but some features may be limited.
                            </div>
                            {lastError && (
                                <div className="text-orange-200 text-xs mt-2 bg-orange-500/5 p-2 rounded">
                                    Last error: {lastError.message} ({new Date(lastError.timestamp).toLocaleTimeString()})
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left: AI Avatar */}
                    <div className="lg:col-span-1">
                        <div className="bg-neutral-800/50 backdrop-blur-sm rounded-2xl p-8 border border-neutral-700">
                            <AIAvatar state={aiState} />

                            {/* Connection Status */}
                            <div className="mt-6 space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-neutral-400">Microphone:</span>
                                    <span className="text-green-400">Active</span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-neutral-400">Audio Quality:</span>
                                    <span className="text-green-400">Good</span>
                                </div>
                            </div>

                            {/* Transcript */}
                            {(turns.length > 0 || transcript) && (
                                <div className="mt-6 p-4 bg-neutral-700/50 rounded-lg max-h-64 overflow-y-auto">
                                    <h4 className="text-sm font-medium text-neutral-300 mb-2">Live Transcript</h4>
                                    <div className="space-y-2">
                                        {turns.map(t => (
                                            <div key={t.id} className="text-sm flex items-start gap-2">
                                                <span className={`mr-1 px-2 py-0.5 rounded text-xs whitespace-nowrap ${t.role === 'assistant' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'}`}>
                                                    {t.role}
                                                </span>
                                                <span className="text-neutral-200 flex-1">
                                                    {t.text}
                                                    {!t.finalized && <span className="opacity-60"> ▋</span>}
                                                </span>
                                                {t.role === 'assistant' && t.finalized && (
                                                    <span className={`px-2 py-0.5 rounded text-xs whitespace-nowrap ${t.moderationLabel === 'flagged' ? 'bg-red-500/20 text-red-300' : t.moderationLabel === 'safe' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-gray-500/20 text-gray-300'}`}>
                                                        {t.moderationLabel || 'unmoderated'}
                                                    </span>
                                                )}
                                            </div>
                                        ))}
                                        {!turns.length && transcript && (
                                            <p className="text-sm text-neutral-200">{transcript}</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right: Code Editor & Console */}
                    <div className="lg:col-span-2">
                        <div className="bg-neutral-800/50 backdrop-blur-sm rounded-2xl border border-neutral-700 overflow-hidden">
                            {/* Code Editor */}
                            <div className="border-b border-neutral-700">
                                <div className="flex items-center justify-between p-4">
                                    <h3 className="text-lg font-medium text-neutral-200">Code Editor</h3>
                                    <div className="flex items-center space-x-2">
                                        <select className="bg-neutral-700 text-neutral-200 px-3 py-1 rounded text-sm border border-neutral-600">
                                            <option value="javascript">JavaScript</option>
                                            <option value="python">Python</option>
                                            <option value="java">Java</option>
                                        </select>
                                        <Button
                                            onClick={runCode}
                                            className="bg-amber-500 hover:bg-amber-600 text-black px-4 py-1 text-sm"
                                        >
                                            Run Code
                                        </Button>
                                    </div>
                                </div>

                                <div className="h-96">
                                    <Editor
                                        defaultLanguage="javascript"
                                        theme="vs-dark"
                                        value={answers[currentQuestionIndex]?.code || "// Start coding here..."}
                                        onChange={(value) => updateCode(value || "")}
                                        options={{
                                            minimap: { enabled: false },
                                            fontSize: 14,
                                            scrollBeyondLastLine: false,
                                            contextmenu: false,
                                            automaticLayout: true,
                                            lineNumbers: 'on',
                                            wordWrap: 'on'
                                        }}
                                    />
                                </div>
                            </div>

                            {/* Console Output */}
                            <div className="p-4">
                                <h4 className="text-sm font-medium text-neutral-300 mb-2">Console Output</h4>
                                <div className="bg-neutral-900/50 rounded-lg p-4 font-mono text-sm min-h-[120px]">
                                    {answers[currentQuestionIndex]?.output && (
                                        <div className="text-green-400">
                                            <div className="text-neutral-400 text-xs mb-1">OUTPUT:</div>
                                            <pre className="whitespace-pre-wrap">{answers[currentQuestionIndex].output}</pre>
                                        </div>
                                    )}
                                    {answers[currentQuestionIndex]?.error && (
                                        <div className="text-red-400 mt-2">
                                            <div className="text-neutral-400 text-xs mb-1">ERROR:</div>
                                            <pre className="whitespace-pre-wrap">{answers[currentQuestionIndex].error}</pre>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Audio Controls */}
                <div className="mt-6 flex justify-center items-center space-x-6">
                    {/* Microphone Controls */}
                    <div className="flex items-center space-x-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={toggleMicrophone}
                            className={`border-2 transition-all duration-200 ${isAudioEnabled
                                ? 'border-green-500 text-green-400 hover:bg-green-500/10'
                                : 'border-red-500 text-red-400 hover:bg-red-500/10'
                                }`}
                        >
                            {isAudioEnabled ? '🎤' : '🔇'} {isAudioEnabled ? 'Mute' : 'Unmute'}
                        </Button>

                        {/* Audio Level Indicator */}
                        {isAudioEnabled && (
                            <div className="flex items-center space-x-2">
                                <div className="w-20 h-2 bg-neutral-700 rounded-full overflow-hidden">
                                    <div
                                        className={`h-full transition-all duration-100 ${audioLevel > 70 ? 'bg-green-500' :
                                            audioLevel > 40 ? 'bg-yellow-500' :
                                                audioLevel > 10 ? 'bg-blue-500' : 'bg-neutral-600'
                                            }`}
                                        style={{ width: `${Math.max(5, audioLevel)}%` }}
                                    />
                                </div>
                                <span className="text-xs text-neutral-400">
                                    {audioState === 'speaking' ? '🗣️' : audioState === 'unmuted' ? '🎤' : '🔇'}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Audio Quality Indicator */}
                    <div className="flex items-center space-x-2">
                        <span className="text-xs text-neutral-500">Quality:</span>
                        <div className={`px-2 py-1 rounded text-xs ${audioQuality === 'excellent' ? 'bg-green-500/20 text-green-400' :
                            audioQuality === 'good' ? 'bg-yellow-500/20 text-yellow-400' :
                                audioQuality === 'poor' ? 'bg-orange-500/20 text-orange-400' :
                                    'bg-gray-500/20 text-gray-400'
                            }`}>
                            {audioQuality === 'excellent' && '⭐ Excellent'}
                            {audioQuality === 'good' && '✅ Good'}
                            {audioQuality === 'poor' && '⚠️ Poor'}
                            {audioQuality === 'unknown' && '❓ Unknown'}
                        </div>
                    </div>

                    {/* WebRTC Connection Status */}
                    <div className="flex items-center space-x-2">
                        <span className="text-xs text-neutral-500">Voice:</span>
                        <div className={`px-2 py-1 rounded text-xs flex items-center space-x-1 ${webrtcState === 'connected' ? 'bg-green-500/20 text-green-400' :
                            webrtcState === 'connecting' ? 'bg-yellow-500/20 text-yellow-400' :
                                webrtcState === 'failed' ? 'bg-red-500/20 text-red-400' :
                                    'bg-gray-500/20 text-gray-400'
                            }`}>
                            {webrtcState === 'connected' && (
                                <>
                                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                                    <span>Connected</span>
                                </>
                            )}
                            {webrtcState === 'connecting' && (
                                <>
                                    <div className="w-2 h-2 border border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
                                    <span>Connecting</span>
                                </>
                            )}
                            {webrtcState === 'failed' && (
                                <>
                                    <div className="w-2 h-2 bg-red-400 rounded-full"></div>
                                    <span>Failed</span>
                                </>
                            )}
                            {(webrtcState === 'new' || webrtcState === 'disconnected' || webrtcState === 'closed') && (
                                <>
                                    <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                    <span>Disconnected</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Controls */}
                <div className="mt-8 flex justify-center space-x-4">
                    <Button
                        variant="outline"
                        className="border-neutral-600 text-neutral-200 hover:bg-neutral-700"
                    >
                        Pause Interview
                    </Button>
                    <Button
                        className="bg-red-500 hover:bg-red-600 text-white"
                        onClick={async () => {
                            try {
                                await finalizeInterview()
                                // Redirect to success page or results
                                window.location.href = '/candidate/success'
                            } catch (error) {
                                console.error('Failed to end interview:', error)
                                alert('Failed to finalize interview. Please try again.')
                            }
                        }}
                    >
                        End Interview
                    </Button>
                </div>
            </div>

            {/* Proctoring Warnings */}
            {showWarningModal && (
                <WarningModal
                    onContinue={handleReturnToTest}
                    violationCount={violationCount}
                />
            )}

            {/* Copy/Paste Notifications */}
            {notification && (
                <Notification
                    message={notification.message}
                    onClose={() => setNotification(null)}
                />
            )}
        </div>
    )
}