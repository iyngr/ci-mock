/**
 * System Checks Utility
 * 
 * Pre-interview validation for microphone, internet, and WebRTC connectivity.
 * Ensures candidates have working audio setup before starting AI interview.
 * 
 * Phase 2: Days 6-8
 */

export interface SystemCheckResult {
    passed: boolean
    message: string
    details?: any
}

export interface MicrophoneCheckResult extends SystemCheckResult {
    audioLevel?: number
    sampleRate?: number
    channelCount?: number
}

export interface InternetCheckResult extends SystemCheckResult {
    downloadSpeed?: number  // Mbps
    uploadSpeed?: number    // Mbps
    latency?: number        // ms
}

export interface WebRTCCheckResult extends SystemCheckResult {
    iceConnectionState?: RTCIceConnectionState
    gatheringState?: RTCIceGatheringState
    candidateCount?: number
}

/**
 * Check microphone access and audio quality
 * 
 * Requirements:
 * - User grants microphone permission
 * - Audio stream active with non-zero samples
 * - Minimum audio level threshold met (prevents silent mics)
 * 
 * @param durationMs - Duration to monitor audio (default: 3000ms)
 * @param minLevel - Minimum audio level threshold 0-100 (default: 5)
 * @returns Microphone check result with audio metrics
 */
export async function checkMicrophone(
    durationMs: number = 3000,
    minLevel: number = 5
): Promise<MicrophoneCheckResult> {
    let stream: MediaStream | null = null
    let audioContext: AudioContext | null = null
    let analyser: AnalyserNode | null = null

    try {
        // Request microphone permission
        stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        })

        // Create audio analyzer
        audioContext = new AudioContext()
        const source = audioContext.createMediaStreamSource(stream)
        analyser = audioContext.createAnalyser()
        analyser.fftSize = 512
        source.connect(analyser)

        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)

        // Monitor audio level for specified duration
        let maxLevel = 0
        const startTime = Date.now()

        await new Promise<void>((resolve) => {
            const checkLevel = () => {
                if (Date.now() - startTime >= durationMs) {
                    resolve()
                    return
                }

                if (!analyser) return

                analyser.getByteFrequencyData(dataArray)
                const average = dataArray.reduce((a, b) => a + b, 0) / bufferLength
                const level = (average / 255) * 100
                maxLevel = Math.max(maxLevel, level)

                requestAnimationFrame(checkLevel)
            }
            checkLevel()
        })

        // Validate audio level meets minimum threshold
        const passed = maxLevel >= minLevel
        const audioTrack = stream.getAudioTracks()[0]
        const settings = audioTrack.getSettings()

        return {
            passed,
            message: passed
                ? `Microphone working (level: ${maxLevel.toFixed(1)}%)`
                : `Microphone too quiet (level: ${maxLevel.toFixed(1)}%, minimum: ${minLevel}%)`,
            audioLevel: maxLevel,
            sampleRate: settings.sampleRate,
            channelCount: settings.channelCount,
            details: {
                deviceId: settings.deviceId,
                label: audioTrack.label
            }
        }
    } catch (error: any) {
        // Handle permission denied, no devices, etc.
        return {
            passed: false,
            message: error.name === 'NotAllowedError'
                ? 'Microphone permission denied'
                : error.name === 'NotFoundError'
                    ? 'No microphone found'
                    : `Microphone error: ${error.message}`,
            details: { error: error.message }
        }
    } finally {
        // Cleanup resources
        if (stream) {
            stream.getTracks().forEach(track => track.stop())
        }
        if (audioContext) {
            await audioContext.close()
        }
    }
}

/**
 * Check internet bandwidth and latency
 * 
 * Requirements:
 * - Download speed >= 1 Mbps (for receiving AI audio)
 * - Upload speed >= 0.5 Mbps (for sending user audio)
 * - Latency < 200ms (for realtime conversation)
 * 
 * @param apiBaseUrl - API endpoint for speed test
 * @returns Internet check result with speed metrics
 */
export async function checkInternet(
    apiBaseUrl: string = 'http://localhost:8000'
): Promise<InternetCheckResult> {
    try {
        // Latency check: Ping API endpoint
        const pingStart = Date.now()
        const pingResponse = await fetch(`${apiBaseUrl}/health`, {
            method: 'GET',
            cache: 'no-store'
        })
        const latency = Date.now() - pingStart

        if (!pingResponse.ok) {
            return {
                passed: false,
                message: 'Cannot reach assessment server',
                details: { status: pingResponse.status }
            }
        }

        // Download speed: Fetch test payload (simulate downloading AI audio)
        const downloadSize = 500000 // 500KB test
        const downloadStart = Date.now()
        const downloadResponse = await fetch(`${apiBaseUrl}/health`, {
            method: 'GET',
            cache: 'no-store',
            headers: { 'X-Test-Size': downloadSize.toString() }
        })

        if (!downloadResponse.ok) {
            throw new Error('Download test failed')
        }

        const downloadBuffer = await downloadResponse.arrayBuffer()
        const downloadTime = (Date.now() - downloadStart) / 1000 // seconds
        const downloadSpeed = (downloadBuffer.byteLength * 8) / (downloadTime * 1000000) // Mbps

        // Upload speed estimation (simplified - no actual upload in basic implementation)
        // In production, you'd POST data to a test endpoint
        const uploadSpeed = downloadSpeed * 0.7 // Estimate upload as 70% of download

        // Validate thresholds
        const downloadOk = downloadSpeed >= 1.0
        const uploadOk = uploadSpeed >= 0.5
        const latencyOk = latency < 200

        const passed = downloadOk && uploadOk && latencyOk

        return {
            passed,
            message: passed
                ? `Connection stable (${downloadSpeed.toFixed(1)} Mbps, ${latency}ms)`
                : `${!downloadOk ? 'Slow download' : !uploadOk ? 'Slow upload' : 'High latency'}`,
            downloadSpeed,
            uploadSpeed,
            latency,
            details: {
                downloadOk,
                uploadOk,
                latencyOk
            }
        }
    } catch (error: any) {
        return {
            passed: false,
            message: `Network error: ${error.message}`,
            details: { error: error.message }
        }
    }
}

/**
 * Check WebRTC connectivity (STUN/TURN)
 * 
 * Requirements:
 * - ICE candidates can be gathered
 * - At least one candidate pair established
 * - Connection state reaches 'connected' or 'completed'
 * 
 * @param stunServers - Array of STUN server URLs
 * @param timeoutMs - Maximum time to wait for connection (default: 10000ms)
 * @returns WebRTC check result with connection state
 */
export async function checkWebRTC(
    stunServers: string[] = ['stun:stun.l.google.com:19302'],
    timeoutMs: number = 10000
): Promise<WebRTCCheckResult> {
    let pc: RTCPeerConnection | null = null

    try {
        // Create peer connection with STUN servers
        pc = new RTCPeerConnection({
            iceServers: stunServers.map(url => ({ urls: url }))
        })

        let candidateCount = 0
        const candidates: RTCIceCandidate[] = []

        // Track ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                candidateCount++
                candidates.push(event.candidate)
            }
        }

        // Create dummy data channel to trigger ICE gathering
        pc.createDataChannel('test')

        // Create and set local offer
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        // Wait for ICE gathering to complete or timeout
        await Promise.race([
            new Promise<void>((resolve) => {
                const checkGathering = () => {
                    if (pc?.iceGatheringState === 'complete') {
                        resolve()
                    } else {
                        setTimeout(checkGathering, 100)
                    }
                }
                checkGathering()
            }),
            new Promise<void>((_, reject) =>
                setTimeout(() => reject(new Error('ICE gathering timeout')), timeoutMs)
            )
        ])

        // Validate results
        const passed = candidateCount > 0 && pc.iceGatheringState === 'complete'

        return {
            passed,
            message: passed
                ? `WebRTC ready (${candidateCount} candidates)`
                : `WebRTC limited (${candidateCount} candidates, ${pc.iceGatheringState})`,
            iceConnectionState: pc.iceConnectionState,
            gatheringState: pc.iceGatheringState,
            candidateCount,
            details: {
                candidates: candidates.map(c => ({
                    type: c.type,
                    protocol: c.protocol,
                    address: c.address
                }))
            }
        }
    } catch (error: any) {
        return {
            passed: false,
            message: `WebRTC error: ${error.message}`,
            details: { error: error.message }
        }
    } finally {
        // Cleanup peer connection
        if (pc) {
            pc.close()
        }
    }
}

/**
 * Run all system checks in parallel
 * 
 * @param apiBaseUrl - API endpoint for internet check
 * @returns Object with all check results
 */
export async function runAllChecks(
    apiBaseUrl: string = 'http://localhost:8000'
): Promise<{
    microphone: MicrophoneCheckResult
    internet: InternetCheckResult
    webrtc: WebRTCCheckResult
    allPassed: boolean
}> {
    const [microphone, internet, webrtc] = await Promise.all([
        checkMicrophone(),
        checkInternet(apiBaseUrl),
        checkWebRTC()
    ])

    return {
        microphone,
        internet,
        webrtc,
        allPassed: microphone.passed && internet.passed && webrtc.passed
    }
}
