"use client"

import React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"
import { ProctoringEvent } from "@/lib/schema"
import Editor from "@monaco-editor/react"

// Types for speech-to-speech
type EphemeralKey = {
  sessionId: string
  ephemeralKey: string
  webrtcUrl: string
  voice: string
  region?: string
  expiresAt: number
  // Present when backend is running in dev mode without Azure configured
  disabled?: boolean
}

type Plan = {
  assessmentId: string
  role?: string
  duration_minutes: number
  sections: Array<{ title: string; items: unknown[] }>
}

type AIState = 'idle' | 'speaking' | 'listening' | 'thinking'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
const MAX_WARNINGS = 3

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
const WarningModal = ({ onContinue, violationCount, maxWarnings = MAX_WARNINGS }: { onContinue: () => void, violationCount: number, maxWarnings?: number }) => {
  const remaining = Math.max(0, maxWarnings - violationCount)
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999]" style={{ zIndex: 2147483647 }}>
      <AnimateOnScroll animation="fadeInUp">
        <div className="bg-white/95 backdrop-blur-sm border border-red-200/50 rounded-2xl p-8 max-w-md w-full mx-4 text-center shadow-2xl">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          <h2 className="text-xl font-medium text-red-600 mb-4">Warning {Math.min(violationCount, maxWarnings)} of {maxWarnings}</h2>
          <p className="text-warm-brown/70 font-light mb-4 leading-relaxed">
            You attempted to exit the assessment window. This is not allowed during the test.
          </p>
          <p className="text-sm text-warm-brown/60 font-light mb-6">
            You have <strong>{remaining}</strong> warning{remaining !== 1 ? 's' : ''} remaining before your assessment will be automatically submitted.
          </p>
          <Button onClick={onContinue} className="w-full h-12 font-light">
            Return to Assessment
          </Button>
        </div>
      </AnimateOnScroll>
    </div>
  )
}

// Simple notification toast for proctoring feedback
const Notification = ({ message, onClose }: { message: string; onClose: () => void }) => (
  <AnimateOnScroll animation="fadeInUp">
    <div className="fixed top-6 right-6 bg-red-500 text-white px-5 py-3 rounded-lg shadow-lg z-[9999] border border-red-400/40">
      <div className="flex items-center gap-3">
        <span className="text-sm">{message}</span>
        <button onClick={onClose} className="text-white/80 hover:text-white text-lg leading-none">×</button>
      </div>
    </div>
  </AnimateOnScroll>
)



export default function AIInterviewPage() {
  const router = useRouter()
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
  const [plan, setPlan] = useState<Plan | null>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [readyToStart, setReadyToStart] = useState(true)
  const containerRef = useRef<HTMLDivElement | null>(null)

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

  // Notification + warning modal state
  const [notification, setNotification] = useState<{ message: string; id: number } | null>(null)
  const showNotification = useCallback((message: string) => {
    const id = Date.now()
    setNotification({ message, id })
    setTimeout(() => {
      setNotification(prev => (prev?.id === id ? null : prev))
    }, 3000)
  }, [])

  const [showWarningModal, setShowWarningModal] = useState(false)
  const [violationCount, setViolationCount] = useState(0)
  const [showEndConfirm, setShowEndConfirm] = useState(false)
  const handleViolation = useCallback((eventType: string) => {
    setViolationCount(prev => {
      const next = prev + 1
      setShowWarningModal(true)
      logProctoringEvent(eventType, { violationCount: next })
      if (next >= MAX_WARNINGS) {
        // Auto-submit the interview after reaching max warnings
        finalizeInterview('violation_limit')
      }
      return next
    })
  }, [logProctoringEvent])

  const handleReturnToTest = useCallback(async () => {
    setShowWarningModal(false)
    try {
      if (containerRef.current && !document.fullscreenElement) {
        await containerRef.current.requestFullscreen()
        setIsFullscreen(true)
      } else if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
        setIsFullscreen(true)
      }
      // Reinforce light theme after returning
      document.documentElement.classList.remove('dark')
      document.body.classList.remove('dark')
    } catch (e) {
      console.error('Failed to re-enter fullscreen:', e)
    }
  }, [])

  // Initialize AI interview session
  const initializeAIInterview = useCallback(async () => {
    try {
      setAiState('thinking')

      // Optional: quick backend health probe for clearer errors
      try {
        const health = await fetch(`${API_BASE}/health`)
        if (!health.ok) {
          console.warn('Backend health check failed:', health.status)
        }
      } catch (e) {
        console.error('Backend not reachable at', `${API_BASE}/health`, e)
        showNotification('Backend not reachable. Start API server or check NEXT_PUBLIC_API_URL')
      }

      // Mint ephemeral key for Azure OpenAI Realtime API
      const keyResponse = await fetch(`${API_BASE}/api/interview/realtime/ephemeral`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      if (!keyResponse.ok) {
        const text = await keyResponse.text()
        console.error('Ephemeral mint failed:', keyResponse.status, text)
        showNotification('Realtime disabled in dev (mint failed). You can proceed with coding questions.')
        // Fallback to a disabled ephemeral so UI progresses
        const fallback: EphemeralKey = {
          sessionId: `dev_${Date.now()}`,
          ephemeralKey: 'dev_ephemeral_disabled',
          webrtcUrl: 'https://invalid.local/realtimertc',
          voice: 'verse',
          region: 'local',
          expiresAt: Math.floor(Date.now() / 1000) + 55,
          disabled: true
        }
        setEphemeralKey(fallback)
        await setupWebRTCConnection(fallback)
        setAiState('idle')
        return
      }

      const keyData: EphemeralKey = await keyResponse.json()
      setEphemeralKey(keyData)

      // Initialize WebRTC connection
      await setupWebRTCConnection(keyData)

      setAiState('idle')
    } catch (error) {
      console.error('Failed to initialize AI interview:', error)
      setAiState('idle')
    }
  }, [])

  // Setup WebRTC connection for speech-to-speech
  const setupWebRTCConnection = async (ephKey: EphemeralKey) => {
    if ((ephKey as any)?.disabled) {
      console.warn('Realtime disabled in dev mode: skipping WebRTC connect')
      showNotification('Realtime disabled in dev mode. Audio chat is unavailable; you can proceed with coding questions.')
      setIsConnected(false)
      setAiState('idle')
      return
    }
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

      // Send offer SDP to Azure OpenAI WebRTC endpoint using application/sdp
      const connectResponse = await fetch(ephKey.webrtcUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephKey.ephemeralKey}`,
          'Content-Type': 'application/sdp'
        },
        body: offer.sdp || ''
      })

      if (!connectResponse.ok) {
        const text = await connectResponse.text()
        console.error('WebRTC connect failed:', connectResponse.status, text)
        showNotification('Connection error. Check mic permission and Azure region/deployment configuration, then try again.')
        throw new Error('WebRTC connection failed')
      }

      const answerSdp = await connectResponse.text()
      const answerInit: RTCSessionDescriptionInit = { type: 'answer', sdp: answerSdp }
      await pc.setRemoteDescription(answerInit)

    } catch (error) {
      console.error('WebRTC setup failed:', error)
    }
  }

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
      .catch(err => {
        console.error(err)
        showNotification('Microphone permission is required to continue')
      })

    return () => {
      audioContext.close()
    }
  }, [isConnected, aiState])

  // Initialize fullscreen, proctoring and load data on mount (automatic fullscreen)
  useEffect(() => {
    const enterFullscreen = async () => {
      try {
        if (containerRef.current) {
          await containerRef.current.requestFullscreen()
        } else {
          await document.documentElement.requestFullscreen()
        }
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
        handleViolation('fullscreen_exit')
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
      // Allow shortcuts inside Monaco editor
      const active = document.activeElement as HTMLElement | null
      const insideCodeEditor = !!active?.closest('.monaco-editor')

      if (e.altKey || e.metaKey) {
        e.preventDefault()
        handleViolation('keyboard_shortcut')
        return
      }

      if (e.key === 'Escape' && !insideCodeEditor) {
        e.preventDefault()
        handleViolation('escape_key')
        return
      }

      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault()
        showNotification('Copying is disabled during the assessment')
        logProctoringEvent('copy_paste_attempt', { action: 'copy' })
        setViolations(prev => ({ ...prev, copyAttempts: prev.copyAttempts + 1 }))
        return
      }
      if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault()
        showNotification('Pasting is disabled during the assessment')
        logProctoringEvent('copy_paste_attempt', { action: 'paste' })
        setViolations(prev => ({ ...prev, pasteAttempts: prev.pasteAttempts + 1 }))
        return
      }
      if (e.ctrlKey && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault()
        showNotification('Cutting is disabled during the assessment')
        logProctoringEvent('copy_paste_attempt', { action: 'cut' })
        setViolations(prev => ({ ...prev, cutAttempts: prev.cutAttempts + 1 }))
        return
      }
      if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault()
        showNotification('Select all is disabled during the assessment')
        logProctoringEvent('copy_paste_attempt', { action: 'select_all' })
        return
      }

      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault()
        logProctoringEvent('dev_tools_attempt', { message: 'Attempted to open developer tools' })
      }
    }

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
      showNotification('Right-click is disabled during the assessment')
      logProctoringEvent('context_menu_attempt', { message: 'Right-click attempted' })
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

  // Enforce light theme on mount and when warning modal closes
  useEffect(() => {
    const enforceLight = () => {
      document.documentElement.classList.remove('dark')
      document.body.classList.remove('dark')
      try {
        document.documentElement.style.setProperty('color-scheme', 'light')
        document.documentElement.style.backgroundColor = '#ffffff'
        document.body.style.backgroundColor = '#ffffff'
      } catch { }
    }
    enforceLight()
  }, [showWarningModal])

  // Initialize AI interview automatically once test data and candidate are ready
  useEffect(() => {
    if (testData && candidateId) {
      setTimeRemaining(30 * 60)
      initializeAIInterview()
    }
  }, [testData, candidateId, initializeAIInterview])

  // Code execution for coding questions
  const runCode = async () => {
    const currentAnswer = answers[currentQuestionIndex]
    if (!currentAnswer?.code) return

    try {
      const response = await fetch(`${API_BASE}/api/utils/run-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: currentAnswer.language || 'javascript',
          code: currentAnswer.code,
          stdin: ''
        })
      })

      const result = await response.json()

      // Update answer with execution result
      setAnswers(prev => ({
        ...prev,
        [currentQuestionIndex]: {
          ...prev[currentQuestionIndex],
          output: result.output,
          error: result.error
        }
      }))
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

  // Collapsible code editor state (must be declared before any early returns)
  const [showEditor, setShowEditor] = useState(false)

  // Finalize interview helper (must be declared before any conditional return)
  const finalizeInterview = useCallback(async (reason: string) => {
    try {
      const sessionId = (ephemeralKey as any)?.sessionId || (ephemeralKey as any)?.session_id || 'unknown'
      const assessmentId = testData?.id || 'unknown'
      await fetch(`${API_BASE}/api/interview/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessmentId,
          sessionId,
          candidateId,
          consentAt: new Date().toISOString(),
          transcript: { turns: [], reason },
          submissionId: null
        })
      })
    } catch (e) {
      console.error('Finalize failed (non-fatal):', e)
    } finally {
      router.push('/candidate/success')
    }
  }, [API_BASE, candidateId, ephemeralKey, router, testData])

  // End interview button handler
  const endInterview = useCallback(async () => {
    setShowEndConfirm(true)
  }, [])

  if (!testData) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-neutral-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto"></div>
          <p className="mt-4 text-base text-neutral-600">Loading AI Interview...</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-b from-white to-neutral-50 text-neutral-900">
      {/* Hidden audio element for AI voice */}
      <audio ref={audioRef} autoPlay />

      {/* No start overlay: auto-enter fullscreen on mount */}

      {/* Floating center console inspired by Admin theme */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-40">
        <div className="bg-white/70 backdrop-blur-md border border-warm-brown/10 rounded-2xl shadow-lg px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-5 w-[min(95vw,900px)] justify-between">
          <div className="flex items-center gap-2">
            <span className="text-warm-brown/70">🎙️</span>
            <span className="text-sm text-warm-brown/70">Microphone</span>
            <span className="text-sm font-medium text-warm-brown">Active</span>
          </div>
          <div className="hidden sm:block w-px h-6 bg-warm-brown/10" />
          <div className="flex items-center gap-2">
            <span className="text-warm-brown/70">🔊</span>
            <span className="text-sm text-warm-brown/70">Audio</span>
            <span className="text-sm font-medium text-warm-brown">{ephemeralKey?.disabled ? 'Disabled' : (isConnected ? 'Connected' : 'Connecting…')}</span>
          </div>
          <div className="hidden sm:block w-px h-6 bg-warm-brown/10" />
          <div className="text-sm text-warm-brown/70">
            Time {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
          </div>
          <div className="hidden sm:block w-px h-6 bg-warm-brown/10" />
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => setShowEditor(v => !v)} className="h-9">
              {showEditor ? 'Hide Editor' : 'Open Editor'}
            </Button>
            <Button variant="destructive" onClick={endInterview} className="h-9" data-testid="end-interview-btn">
              End Interview
            </Button>
          </div>
        </div>
      </div>

      {/* Main Interview Interface */}
      <div className="container mx-auto px-4 sm:px-6 pt-28 pb-8">{/* top padding to avoid overlap */}
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-neutral-900">AI Technical Interview</h1>
          <p className="text-sm text-neutral-500">Real-time speech-to-speech assessment</p>
          {/* Status moved to floating console */}
        </div>

        {/* Main content: Avatar + Transcript */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Center/Left: Avatar & controls */}
          <div className="lg:col-span-2">
            <div className="mx-auto max-w-xl">
              <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 text-center">
                <AIAvatar state={aiState} />
                {/* Mic/Audio status moved to floating console */}

                {/* Editor toggled from floating console */}

                {/* Collapsible editor */}
                {showEditor && (
                  <div className="mt-6 text-left">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-neutral-800">Code Editor</h3>
                      <div className="flex items-center gap-2">
                        <select className="bg-white text-neutral-800 px-3 py-1 rounded-md text-sm border border-neutral-200">
                          <option value="javascript">JavaScript</option>
                          <option value="python">Python</option>
                          <option value="java">Java</option>
                        </select>
                        <Button onClick={runCode} className="h-9">Run Code</Button>
                      </div>
                    </div>
                    <div className="h-80 border border-neutral-200 rounded-xl overflow-hidden">
                      <Editor
                        defaultLanguage="javascript"
                        theme="vs"
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

                    {/* Console Output */}
                    <div className="mt-3">
                      <h4 className="text-xs font-medium text-neutral-500 mb-1">Console Output</h4>
                      <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 font-mono text-xs min-h-[96px] text-neutral-800">
                        {answers[currentQuestionIndex]?.output && (
                          <div className="text-green-700">
                            <div className="text-neutral-500 text-[11px] mb-1">OUTPUT:</div>
                            <pre className="whitespace-pre-wrap">{answers[currentQuestionIndex].output}</pre>
                          </div>
                        )}
                        {answers[currentQuestionIndex]?.error && (
                          <div className="text-red-700 mt-2">
                            <div className="text-neutral-500 text-[11px] mb-1">ERROR:</div>
                            <pre className="whitespace-pre-wrap">{answers[currentQuestionIndex].error}</pre>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right: Live Transcript with speaker labels */}
          <div className="lg:col-span-1">
            <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6">
              <h3 className="text-base font-medium text-neutral-900 mb-3">Live Transcript</h3>
              <div className="space-y-3 max-h-[520px] overflow-auto pr-1">
                {transcript ? (
                  <div className="text-sm">
                    <div className="text-neutral-500 text-xs mb-1">Interviewer</div>
                    <div className="px-3 py-2 rounded-lg bg-neutral-50 border border-neutral-200 text-neutral-800">
                      {transcript}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-neutral-500">Listening…</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Controls moved to floating console */}
      </div>

      {/* Proctoring Warnings */}
      {showWarningModal && (
        <WarningModal onContinue={handleReturnToTest} violationCount={violationCount} maxWarnings={MAX_WARNINGS} />
      )}

      {/* Copy/Paste Notifications */}
      {notification && (
        <Notification message={notification.message} onClose={() => setNotification(null)} />
      )}

      {/* End Interview Confirmation */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-2xl shadow-xl border border-neutral-200 max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-medium text-neutral-900 mb-2">End and Submit Interview?</h3>
            <p className="text-sm text-neutral-600 mb-6">This will finalize your session and submit your interview. You won’t be able to continue afterwards.</p>
            <div className="flex items-center justify-end gap-3">
              <Button variant="outline" onClick={() => setShowEndConfirm(false)} className="h-9">Cancel</Button>
              <Button variant="destructive" onClick={() => finalizeInterview('user_end')} className="h-9" data-testid="submit-end-interview">Submit</Button>
            </div>
          </div>
        </div>
      )}
      {/* Force light theme globally to avoid dark-mode flicker on return */}
      <style jsx global>{`
        :root, html, body {
          background: #ffffff !important;
          color-scheme: light !important;
        }
      `}</style>
    </div>
  )
}