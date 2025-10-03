"use client"

import React, { useState, useEffect, useCallback, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"
import {
    Mic, MicOff, PhoneOff, AlertCircle, CheckCircle2,
    Wifi, WifiOff, Volume2, VolumeX, Loader2, Radio
} from "lucide-react"
import { RealtimeAudioClient, SessionConfig } from "@/lib/realtimeClient"
import { AudioQualityMonitor, AdaptiveBitrateController } from "@/lib/audioQuality"

// SSRF mitigation - allowed API bases
const ALLOWED_API_BASES = [
    "http://localhost:8000",
    "https://api.example.com",
]
const ENV_API_BASE = process.env.NEXT_PUBLIC_API_URL
const API_BASE = typeof ENV_API_BASE === 'string' && ALLOWED_API_BASES.includes(ENV_API_BASE)
    ? ENV_API_BASE
    : 'http://localhost:8000'

// Types
type AIState = 'idle' | 'speaking' | 'listening' | 'thinking'
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed'
type AudioQualityLevel = 'excellent' | 'good' | 'poor' | 'critical'

interface ConversationTurn {
    id: string
    role: 'user' | 'assistant'
    text: string
    timestamp: number
    finalized: boolean
}

interface InterviewPlan {
    assessmentId: string
    role: string
    duration_minutes: number
    sections: Array<{
        title: string
        items: string[]
    }>
}

// Quality Badge Component
const QualityBadge = ({ quality }: { quality: AudioQualityLevel | 'unknown' }) => {
    const badges = {
        excellent: { text: 'Excellent', className: 'bg-green-500/10 text-green-500 border-green-500/20' },
        good: { text: 'Good', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
        poor: { text: 'Poor', className: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
        critical: { text: 'Critical', className: 'bg-red-500/10 text-red-500 border-red-500/20' },
        unknown: { text: 'Checking...', className: 'bg-neutral-500/10 text-neutral-500 border-neutral-500/20' }
    }

    const badge = badges[quality]

    return (
        <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full border ${badge.className}`}>
            <Radio className="w-3.5 h-3.5" />
            <span className="text-xs font-medium">{badge.text}</span>
        </div>
    )
}

// Connection Status Component
const ConnectionStatus = ({
    status,
    reconnectAttempt
}: {
    status: ConnectionState
    reconnectAttempt?: number
}) => {
    const statusConfig = {
        disconnected: { icon: WifiOff, text: 'Disconnected', className: 'text-neutral-400' },
        connecting: { icon: Loader2, text: 'Connecting...', className: 'text-blue-500 animate-spin' },
        connected: { icon: Wifi, text: 'Connected', className: 'text-green-500' },
        reconnecting: { icon: Loader2, text: `Reconnecting (${reconnectAttempt}/5)...`, className: 'text-amber-500 animate-spin' },
        failed: { icon: AlertCircle, text: 'Connection Failed', className: 'text-red-500' }
    }

    const config = statusConfig[status]
    const Icon = config.icon

    return (
        <div className="flex items-center space-x-2 text-sm">
            <Icon className={`w-4 h-4 ${config.className}`} />
            <span className="text-warm-brown/70">{config.text}</span>
        </div>
    )
}

// AI Avatar Component (Talens Design)
const AIAvatar = ({ state }: { state: AIState }) => {
    const avatarClasses = {
        idle: "bg-warm-brown/10 border-warm-brown/20",
        speaking: "bg-blue-500/20 border-blue-500/40 shadow-lg shadow-blue-500/30",
        listening: "bg-green-500/20 border-green-500/40 shadow-lg shadow-green-500/30",
        thinking: "bg-amber-500/20 border-amber-500/40 shadow-lg shadow-amber-500/30"
    }

    const statusText = {
        idle: "Ready",
        speaking: "Speaking...",
        listening: "Listening...",
        thinking: "Analyzing..."
    }

    const getAnimationClass = () => {
        switch (state) {
            case 'speaking':
                return 'animate-pulse'
            case 'listening':
                return 'animate-pulse'
            case 'thinking':
                return 'animate-bounce'
            default:
                return ''
        }
    }

    return (
        <div className="flex flex-col items-center space-y-4">
            <div className={`
        w-32 h-32 rounded-full border-4 flex items-center justify-center 
        transition-all duration-300 ${avatarClasses[state]} ${getAnimationClass()}
      `}>
                <div className="text-5xl">🎯</div>
            </div>
            <div className="text-center">
                <p className="text-lg font-medium text-warm-brown">{statusText[state]}</p>
                <p className="text-sm text-warm-brown/70 font-light">AI Technical Interviewer</p>
            </div>
        </div>
    )
}

// Audio Level Visualizer
const AudioLevelVisualizer = ({ level }: { level: number }) => {
    const bars = 20
    const activeBars = Math.floor((level / 100) * bars)

    return (
        <div className="flex items-center space-x-1 h-8">
            {Array.from({ length: bars }).map((_, i) => (
                <div
                    key={i}
                    className={`w-1 rounded-full transition-all duration-100 ${i < activeBars
                            ? 'bg-green-500 h-full'
                            : 'bg-warm-brown/10 h-2'
                        }`}
                />
            ))}
        </div>
    )
}

// Reconnection Modal
const ReconnectionModal = ({
    isOpen,
    attempt,
    maxAttempts
}: {
    isOpen: boolean
    attempt: number
    maxAttempts: number
}) => {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-warm-brown/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <AnimateOnScroll animation="fadeInUp">
                <div className="bg-white/95 backdrop-blur-sm border border-warm-brown/10 rounded-2xl shadow-2xl p-8 max-w-md w-full">
                    <div className="flex flex-col items-center text-center space-y-4">
                        <Loader2 className="w-12 h-12 text-warm-brown animate-spin" />
                        <div>
                            <h3 className="text-xl font-semibold text-warm-brown mb-2">
                                Reconnecting...
                            </h3>
                            <p className="text-warm-brown/70 font-light">
                                Connection lost. Attempting to reconnect (attempt {attempt}/{maxAttempts})
                            </p>
                        </div>
                        <div className="w-full bg-warm-brown/10 h-2 rounded-full overflow-hidden">
                            <div
                                className="bg-warm-brown h-full rounded-full transition-all duration-300"
                                style={{ width: `${(attempt / maxAttempts) * 100}%` }}
                            />
                        </div>
                    </div>
                </div>
            </AnimateOnScroll>
        </div>
    )
}

// Main Component
export default function LiveInterviewPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const testId = searchParams.get('testId')

    // Realtime client instances
    const clientRef = useRef<RealtimeAudioClient | null>(null)
    const monitorRef = useRef<AudioQualityMonitor | null>(null)
    const controllerRef = useRef<AdaptiveBitrateController | null>(null)
    const audioRef = useRef<HTMLAudioElement>(null)

    // State
    const [aiState, setAiState] = useState<AIState>('idle')
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
    const [audioQuality, setAudioQuality] = useState<AudioQualityLevel | 'unknown'>('unknown')
    const [isMuted, setIsMuted] = useState(false)
    const [audioLevel, setAudioLevel] = useState(0)
    const [conversationTurns, setConversationTurns] = useState<ConversationTurn[]>([])
    const [currentTranscript, setCurrentTranscript] = useState('')
    const [reconnectAttempt, setReconnectAttempt] = useState(0)
    const [showReconnectModal, setShowReconnectModal] = useState(false)
    const [interviewPlan, setInterviewPlan] = useState<InterviewPlan | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`)

    // Fetch interview plan
    useEffect(() => {
        if (!testId) {
            router.push('/candidate/login')
            return
        }

        const fetchPlan = async () => {
            try {
                const response = await fetch(`${API_BASE}/api/candidate/assessment/${testId}`)
                if (!response.ok) {
                    throw new Error('Failed to fetch interview plan')
                }
                const data = await response.json()
                setInterviewPlan(data)
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Failed to load interview')
            } finally {
                setIsLoading(false)
            }
        }

        fetchPlan()
    }, [testId, router])

    // Initialize WebRTC connection
    const initializeConnection = useCallback(async () => {
        if (!testId || !audioRef.current) return

        try {
            setConnectionState('connecting')
            setError(null)

            // Create realtime client
            const client = new RealtimeAudioClient(audioRef.current)
            clientRef.current = client

            // Set up event handlers
            client.on('connected', () => {
                setConnectionState('connected')
                setShowReconnectModal(false)
                setReconnectAttempt(0)
            })

            client.on('disconnected', () => {
                setConnectionState('disconnected')
                setAiState('idle')
            })

            client.on('error', (data: { message: string }) => {
                setError(data.message)
                setConnectionState('failed')
            })

            // Reconnection handled internally by RealtimeAudioClient

            client.on('turn_start', () => {
                setAiState('speaking')
                setCurrentTranscript('')
            })

            client.on('turn_complete', (data: { text: string, turnId: string }) => {
                const { text, turnId } = data
                setAiState('idle')
                setConversationTurns(prev => [...prev, {
                    id: turnId || `turn_${Date.now()}`,
                    role: 'assistant',
                    text,
                    timestamp: Date.now(),
                    finalized: true
                }])
            })

            client.on('transcript_delta', (data: { delta: string }) => {
                setCurrentTranscript(prev => prev + data.delta)
            })

            // User speech detected via interrupt event

            client.on('interrupt', (data: { role: string, text?: string }) => {
                const userText = data.text
                if (userText) {
                    setAiState('thinking')
                    setConversationTurns(prev => [...prev, {
                        id: `user_${Date.now()}`,
                        role: 'user',
                        text: userText,
                        timestamp: Date.now(),
                        finalized: true
                    }])
                } else {
                    setAiState('listening')
                }
            })

            // Connect to Azure OpenAI
            const sessionConfig: SessionConfig = {
                model: 'gpt-4o-realtime-preview',
                voice: 'alloy',
                instructions: `You are conducting a technical interview for the role: ${interviewPlan?.role || 'Software Engineer'}. 
Be professional, clear, and conversational. Ask questions from the interview plan, listen to the candidate's responses, 
and ask relevant follow-up questions. Keep the conversation natural and engaging.`,
                modalities: ['text', 'audio'],
                turn_detection: {
                    type: 'server_vad',
                    threshold: 0.5,
                    silence_duration_ms: 700
                }
            }

            await client.connect(testId, sessionConfig)

            // Set up quality monitoring
            if (client.pc) {
                const monitor = new AudioQualityMonitor(client.pc)
                monitorRef.current = monitor

                monitor.onQualityChange((quality) => {
                    setAudioQuality(quality)
                })

                monitor.start(2000) // Monitor every 2 seconds

                // Set up adaptive bitrate control (auto-starts via monitor events)
                const controller = new AdaptiveBitrateController(client.pc, monitor)
                controllerRef.current = controller
            }

        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to initialize connection')
            setConnectionState('failed')
        }
    }, [testId, interviewPlan])

    // Initialize on mount
    useEffect(() => {
        if (interviewPlan && !isLoading) {
            initializeConnection()
        }

        return () => {
            // Cleanup
            if (clientRef.current) {
                clientRef.current.disconnect()
            }
            if (monitorRef.current) {
                monitorRef.current.stop()
            }
            // Controller cleanup handled by monitor.stop()
        }
    }, [interviewPlan, isLoading, initializeConnection])

    // Toggle microphone
    const toggleMicrophone = useCallback(() => {
        if (clientRef.current) {
            const newMutedState = !isMuted
            setIsMuted(newMutedState)
            // In RealtimeAudioClient, you'd implement a mute method
            // clientRef.current.setMuted(newMutedState)
        }
    }, [isMuted])

    // End interview
    const endInterview = useCallback(async () => {
        try {
            // Finalize transcript
            await fetch(`${API_BASE}/api/live-interview/finalize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    session_id: sessionId,
                    assessment_id: testId,
                    turns: conversationTurns.map(turn => ({
                        role: turn.role,
                        text: turn.text,
                        started_at: turn.timestamp / 1000,
                        ended_at: turn.timestamp / 1000
                    }))
                })
            })

            // Disconnect client
            if (clientRef.current) {
                clientRef.current.disconnect()
            }

            // Navigate to success page
            router.push(`/candidate/success?testId=${testId}`)
        } catch (err) {
            setError('Failed to save interview. Please try again.')
        }
    }, [sessionId, testId, conversationTurns, router])

    // Loading state
    if (isLoading) {
        return (
            <div className="min-h-screen bg-warm-background flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-warm-brown animate-spin mx-auto mb-4" />
                    <p className="text-warm-brown font-light">Loading interview...</p>
                </div>
            </div>
        )
    }

    // Error state
    if (!interviewPlan || error) {
        return (
            <div className="min-h-screen bg-warm-background flex items-center justify-center p-4">
                <div className="bg-white/95 backdrop-blur-sm border border-warm-brown/10 rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
                    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-semibold text-warm-brown mb-2">Error</h2>
                    <p className="text-warm-brown/70 font-light mb-6">
                        {error || 'Failed to load interview plan'}
                    </p>
                    <Button
                        onClick={() => router.push('/candidate/login')}
                        className="bg-warm-brown hover:bg-warm-brown/90 text-white"
                    >
                        Back to Login
                    </Button>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-warm-background">
            <audio ref={audioRef} autoPlay />

            {/* Reconnection Modal */}
            <ReconnectionModal
                isOpen={showReconnectModal}
                attempt={reconnectAttempt}
                maxAttempts={5}
            />

            {/* Header */}
            <header className="bg-white/95 backdrop-blur-sm border-b border-warm-brown/10 sticky top-0 z-40">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold text-warm-brown tracking-tight">
                                Live Interview
                            </h1>
                            <p className="text-sm text-warm-brown/70 font-light">
                                {interviewPlan.role}
                            </p>
                        </div>
                        <div className="flex items-center space-x-4">
                            <QualityBadge quality={audioQuality} />
                            <ConnectionStatus status={connectionState} reconnectAttempt={reconnectAttempt} />
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* AI Avatar & Controls */}
                    <div className="lg:col-span-1">
                        <AnimateOnScroll animation="fadeInUp" delay={0.1}>
                            <div className="bg-white/95 backdrop-blur-sm border border-warm-brown/10 rounded-2xl shadow-lg p-8">
                                <AIAvatar state={aiState} />

                                {/* Audio Level */}
                                <div className="mt-6">
                                    <p className="text-xs text-warm-brown/70 mb-2 font-light">Audio Level</p>
                                    <AudioLevelVisualizer level={audioLevel} />
                                </div>

                                {/* Controls */}
                                <div className="mt-6 space-y-3">
                                    <Button
                                        onClick={toggleMicrophone}
                                        variant={isMuted ? "destructive" : "outline"}
                                        className="w-full"
                                    >
                                        {isMuted ? (
                                            <>
                                                <MicOff className="w-4 h-4 mr-2" />
                                                Unmute
                                            </>
                                        ) : (
                                            <>
                                                <Mic className="w-4 h-4 mr-2" />
                                                Mute
                                            </>
                                        )}
                                    </Button>

                                    <Button
                                        onClick={endInterview}
                                        variant="destructive"
                                        className="w-full"
                                    >
                                        <PhoneOff className="w-4 h-4 mr-2" />
                                        End Interview
                                    </Button>
                                </div>
                            </div>
                        </AnimateOnScroll>
                    </div>

                    {/* Transcript */}
                    <div className="lg:col-span-2">
                        <AnimateOnScroll animation="fadeInUp" delay={0.2}>
                            <div className="bg-white/95 backdrop-blur-sm border border-warm-brown/10 rounded-2xl shadow-lg p-6">
                                <h2 className="text-lg font-semibold text-warm-brown mb-4">Conversation</h2>

                                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
                                    {conversationTurns.map((turn) => (
                                        <div
                                            key={turn.id}
                                            className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                        >
                                            <div
                                                className={`max-w-[80%] rounded-2xl px-4 py-3 ${turn.role === 'user'
                                                        ? 'bg-warm-brown text-white'
                                                        : 'bg-warm-brown/10 text-warm-brown'
                                                    }`}
                                            >
                                                <p className="text-sm font-light whitespace-pre-wrap">{turn.text}</p>
                                                <p className="text-xs opacity-70 mt-1">
                                                    {new Date(turn.timestamp).toLocaleTimeString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}

                                    {/* Current transcript (assistant speaking) */}
                                    {currentTranscript && (
                                        <div className="flex justify-start">
                                            <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-warm-brown/5 text-warm-brown border border-warm-brown/10">
                                                <p className="text-sm font-light whitespace-pre-wrap">{currentTranscript}</p>
                                                <div className="flex items-center space-x-1 mt-2">
                                                    <div className="w-2 h-2 bg-warm-brown rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                                                    <div className="w-2 h-2 bg-warm-brown rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                                                    <div className="w-2 h-2 bg-warm-brown rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {conversationTurns.length === 0 && !currentTranscript && (
                                        <div className="text-center py-12">
                                            <p className="text-warm-brown/50 font-light">
                                                Interview will begin shortly...
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </AnimateOnScroll>
                    </div>
                </div>
            </main>
        </div>
    )
}
