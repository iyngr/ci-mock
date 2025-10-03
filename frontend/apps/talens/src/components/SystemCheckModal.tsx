/**
 * System Check Modal Component
 * 
 * Pre-interview validation modal for Talens AI Interview Platform.
 * Validates microphone, internet connection, and WebRTC before interview starts.
 * 
 * Design: Follows Talens design system (warm browns, backdrop-blur, font-light)
 * Phase 2: Days 6-8
 */

"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"
import {
    Mic,
    MicOff,
    Wifi,
    WifiOff,
    Radio,
    RadioTower,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Loader2,
    RefreshCw
} from "lucide-react"
import {
    checkMicrophone,
    checkInternet,
    checkWebRTC,
    type MicrophoneCheckResult,
    type InternetCheckResult,
    type WebRTCCheckResult
} from "@/lib/systemChecks"

interface SystemCheckModalProps {
    isOpen: boolean
    onComplete: () => void
    onCancel?: () => void
    apiBaseUrl?: string
}

type CheckStatus = 'pending' | 'running' | 'passed' | 'failed'

interface CheckState {
    status: CheckStatus
    result: MicrophoneCheckResult | InternetCheckResult | WebRTCCheckResult | null
}

export function SystemCheckModal({
    isOpen,
    onComplete,
    onCancel,
    apiBaseUrl = 'http://localhost:8000'
}: SystemCheckModalProps) {
    const [micCheck, setMicCheck] = useState<CheckState>({ status: 'pending', result: null })
    const [internetCheck, setInternetCheck] = useState<CheckState>({ status: 'pending', result: null })
    const [webrtcCheck, setWebrtcCheck] = useState<CheckState>({ status: 'pending', result: null })

    const [audioLevel, setAudioLevel] = useState(0)
    const [isRunning, setIsRunning] = useState(false)
    const audioContextRef = useRef<AudioContext | null>(null)
    const analyserRef = useRef<AnalyserNode | null>(null)
    const streamRef = useRef<MediaStream | null>(null)
    const animationFrameRef = useRef<number | null>(null)

    // Cleanup audio resources on unmount
    useEffect(() => {
        return () => {
            stopAudioMonitoring()
        }
    }, [])

    const stopAudioMonitoring = () => {
        if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current)
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop())
        }
        if (audioContextRef.current) {
            audioContextRef.current.close()
        }
    }

    const runMicrophoneCheck = async () => {
        setMicCheck({ status: 'running', result: null })
        setAudioLevel(0)

        try {
            // Start audio monitoring for visualizer
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            })
            streamRef.current = stream

            const audioContext = new AudioContext()
            audioContextRef.current = audioContext

            const source = audioContext.createMediaStreamSource(stream)
            const analyser = audioContext.createAnalyser()
            analyserRef.current = analyser
            analyser.fftSize = 512
            source.connect(analyser)

            const bufferLength = analyser.frequencyBinCount
            const dataArray = new Uint8Array(bufferLength)

            // Real-time audio level visualization
            const updateLevel = () => {
                if (!analyserRef.current) return

                analyserRef.current.getByteFrequencyData(dataArray)
                const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength
                const level = (average / 255) * 100
                setAudioLevel(level)

                animationFrameRef.current = requestAnimationFrame(updateLevel)
            }
            updateLevel()

            // Run actual microphone check
            const result = await checkMicrophone(3000, 5)

            setMicCheck({
                status: result.passed ? 'passed' : 'failed',
                result
            })
        } catch (error: any) {
            setMicCheck({
                status: 'failed',
                result: {
                    passed: false,
                    message: error.message || 'Microphone check failed'
                }
            })
        } finally {
            stopAudioMonitoring()
        }
    }

    const runInternetCheck = async () => {
        setInternetCheck({ status: 'running', result: null })

        try {
            const result = await checkInternet(apiBaseUrl)
            setInternetCheck({
                status: result.passed ? 'passed' : 'failed',
                result
            })
        } catch (error: any) {
            setInternetCheck({
                status: 'failed',
                result: {
                    passed: false,
                    message: error.message || 'Internet check failed'
                }
            })
        }
    }

    const runWebRTCCheck = async () => {
        setWebrtcCheck({ status: 'running', result: null })

        try {
            const result = await checkWebRTC()
            setWebrtcCheck({
                status: result.passed ? 'passed' : 'failed',
                result
            })
        } catch (error: any) {
            setWebrtcCheck({
                status: 'failed',
                result: {
                    passed: false,
                    message: error.message || 'WebRTC check failed'
                }
            })
        }
    }

    const runAllChecks = async () => {
        setIsRunning(true)

        // Run checks sequentially for better UX (one at a time)
        await runMicrophoneCheck()
        await runInternetCheck()
        await runWebRTCCheck()

        setIsRunning(false)
    }

    const retryCheck = async (checkType: 'mic' | 'internet' | 'webrtc') => {
        if (checkType === 'mic') {
            await runMicrophoneCheck()
        } else if (checkType === 'internet') {
            await runInternetCheck()
        } else {
            await runWebRTCCheck()
        }
    }

    const allChecksPassed =
        micCheck.status === 'passed' &&
        internetCheck.status === 'passed' &&
        webrtcCheck.status === 'passed'

    const anyCheckFailed =
        micCheck.status === 'failed' ||
        internetCheck.status === 'failed' ||
        webrtcCheck.status === 'failed'

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
            <AnimateOnScroll animation="fadeInUp">
                <div className="bg-white/95 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                    {/* Header */}
                    <div className="mb-6">
                        <h2 className="text-3xl font-light text-warm-brown mb-3 tracking-tight">
                            System Check
                        </h2>
                        <div className="w-24 h-px bg-warm-brown/30 mb-4"></div>
                        <p className="text-sm text-warm-brown/70 font-light">
                            We need to verify your system is ready for the AI interview.
                            This will check your microphone, internet connection, and audio streaming capabilities.
                        </p>
                    </div>

                    {/* Check Items */}
                    <div className="space-y-4 mb-6">
                        {/* Microphone Check */}
                        <CheckItem
                            title="Microphone Access"
                            description="Verify microphone is working and audio levels are adequate"
                            status={micCheck.status}
                            result={micCheck.result}
                            icon={micCheck.status === 'passed' ? Mic : MicOff}
                            onRetry={() => retryCheck('mic')}
                            audioLevel={micCheck.status === 'running' ? audioLevel : undefined}
                        />

                        {/* Internet Check */}
                        <CheckItem
                            title="Internet Connection"
                            description="Test bandwidth and latency for realtime audio streaming"
                            status={internetCheck.status}
                            result={internetCheck.result}
                            icon={internetCheck.status === 'passed' ? Wifi : WifiOff}
                            onRetry={() => retryCheck('internet')}
                        />

                        {/* WebRTC Check */}
                        <CheckItem
                            title="Audio Streaming"
                            description="Validate WebRTC connectivity for voice communication"
                            status={webrtcCheck.status}
                            result={webrtcCheck.result}
                            icon={webrtcCheck.status === 'passed' ? RadioTower : Radio}
                            onRetry={() => retryCheck('webrtc')}
                        />
                    </div>

                    {/* Warning for failed checks */}
                    {anyCheckFailed && (
                        <div className="bg-amber-50/80 border border-amber-200/50 rounded-xl p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-medium text-amber-900 mb-1">Action Required</h4>
                                    <p className="text-sm text-amber-700 font-light">
                                        Some checks did not pass. Please fix the issues above and retry.
                                        You may need to grant microphone permission, check your internet connection,
                                        or adjust browser settings.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Success message */}
                    {allChecksPassed && (
                        <div className="bg-green-50/80 border border-green-200/50 rounded-xl p-4 mb-6">
                            <div className="flex items-start gap-3">
                                <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-medium text-green-900 mb-1">All Checks Passed</h4>
                                    <p className="text-sm text-green-700 font-light">
                                        Your system is ready for the AI interview. Click &quot;Continue&quot; to proceed.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex gap-3">
                            {onCancel && (
                                <Button
                                    onClick={onCancel}
                                    variant="outline"
                                    disabled={isRunning}
                                    className="border-warm-brown/20 text-warm-brown hover:bg-warm-brown/5"
                                >
                                    Cancel
                                </Button>
                            )}

                            <Button
                                onClick={runAllChecks}
                                disabled={isRunning}
                                variant="outline"
                                className="border-warm-brown/20 text-warm-brown hover:bg-warm-brown/5"
                            >
                                {isRunning ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Running Checks...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        {micCheck.status === 'pending' ? 'Start Checks' : 'Retry All'}
                                    </>
                                )}
                            </Button>
                        </div>

                        <Button
                            onClick={onComplete}
                            disabled={!allChecksPassed || isRunning}
                            className="bg-warm-brown hover:bg-warm-brown/90 text-white"
                        >
                            Continue to Interview
                        </Button>
                    </div>
                </div>
            </AnimateOnScroll>
        </div>
    )
}

// Individual check item component
interface CheckItemProps {
    title: string
    description: string
    status: CheckStatus
    result: MicrophoneCheckResult | InternetCheckResult | WebRTCCheckResult | null
    icon: any
    onRetry: () => void
    audioLevel?: number
}

function CheckItem({
    title,
    description,
    status,
    result,
    icon: Icon,
    onRetry,
    audioLevel
}: CheckItemProps) {
    const statusColors = {
        pending: 'bg-neutral-100 border-neutral-200',
        running: 'bg-blue-50 border-blue-200',
        passed: 'bg-green-50 border-green-200',
        failed: 'bg-red-50 border-red-200'
    }

    const statusIcons = {
        pending: <Icon className="w-5 h-5 text-neutral-500" />,
        running: <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />,
        passed: <CheckCircle2 className="w-5 h-5 text-green-600" />,
        failed: <XCircle className="w-5 h-5 text-red-600" />
    }

    return (
        <div className={`border rounded-xl p-4 transition-all ${statusColors[status]}`}>
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 mt-0.5">
                    {statusIcons[status]}
                </div>

                <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-warm-brown mb-1">{title}</h3>
                    <p className="text-sm text-warm-brown/70 font-light mb-2">{description}</p>

                    {/* Audio level visualizer (only for microphone check) */}
                    {audioLevel !== undefined && status === 'running' && (
                        <div className="mb-3">
                            <div className="w-full h-2 bg-neutral-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-green-500 transition-all duration-100"
                                    style={{ width: `${Math.min(audioLevel, 100)}%` }}
                                />
                            </div>
                            <p className="text-xs text-warm-brown/60 mt-1 font-light">
                                Speak to test your microphone... ({audioLevel.toFixed(0)}%)
                            </p>
                        </div>
                    )}

                    {/* Result message */}
                    {result && (
                        <div className="flex items-start justify-between gap-2">
                            <p className={`text-sm font-light ${status === 'passed' ? 'text-green-700' :
                                    status === 'failed' ? 'text-red-700' :
                                        'text-neutral-600'
                                }`}>
                                {result.message}
                            </p>

                            {status === 'failed' && (
                                <Button
                                    onClick={onRetry}
                                    variant="ghost"
                                    size="sm"
                                    className="text-xs h-7 px-2 text-warm-brown hover:bg-warm-brown/10"
                                >
                                    Retry
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Details for passed checks */}
                    {status === 'passed' && result && 'downloadSpeed' in result && (
                        <div className="text-xs text-warm-brown/60 mt-1 font-light">
                            {result.downloadSpeed?.toFixed(1)} Mbps ↓ • {result.uploadSpeed?.toFixed(1)} Mbps ↑ • {result.latency}ms latency
                        </div>
                    )}

                    {status === 'passed' && result && 'audioLevel' in result && (
                        <div className="text-xs text-warm-brown/60 mt-1 font-light">
                            Peak level: {result.audioLevel?.toFixed(1)}% • {result.sampleRate ? `${(result.sampleRate / 1000).toFixed(1)}kHz` : ''} {result.channelCount ? `${result.channelCount}ch` : ''}
                        </div>
                    )}

                    {status === 'passed' && result && 'candidateCount' in result && (
                        <div className="text-xs text-warm-brown/60 mt-1 font-light">
                            {result.candidateCount} ICE candidates • {result.gatheringState}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
