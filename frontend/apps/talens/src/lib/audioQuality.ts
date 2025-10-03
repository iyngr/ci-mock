/**
 * Audio Quality Monitor
 * 
 * Real-time audio quality assessment for WebRTC connections.
 * Monitors packet loss, jitter, RTT, and provides quality ratings.
 * 
 * Phase 3: Days 12-13
 */

export type AudioQuality = 'excellent' | 'good' | 'poor' | 'critical' | 'unknown'

export interface QualityMetrics {
    packetLoss: number        // Percentage (0-100)
    jitter: number            // Milliseconds
    rtt: number               // Round-trip time in milliseconds
    bytesReceived: number
    bytesSent: number
    packetsLost: number
    packetsReceived: number
    timestamp: number
}

export interface QualityReport {
    overall: AudioQuality
    metrics: QualityMetrics
    issues: string[]
    recommendations: string[]
}

/**
 * Audio Quality Thresholds
 */
const QUALITY_THRESHOLDS = {
    excellent: {
        packetLoss: 1,      // < 1% packet loss
        jitter: 20,         // < 20ms jitter
        rtt: 150           // < 150ms RTT
    },
    good: {
        packetLoss: 3,      // < 3% packet loss
        jitter: 40,         // < 40ms jitter
        rtt: 250           // < 250ms RTT
    },
    poor: {
        packetLoss: 10,     // < 10% packet loss
        jitter: 100,        // < 100ms jitter
        rtt: 500           // < 500ms RTT
    }
    // Anything worse = critical
}

/**
 * Audio Quality Monitor Class
 */
export class AudioQualityMonitor {
    private pc: RTCPeerConnection | null = null
    private monitorInterval: NodeJS.Timeout | null = null
    private previousStats: QualityMetrics | null = null
    private qualityHistory: AudioQuality[] = []
    private maxHistoryLength: number = 10

    private qualityChangeHandlers: ((quality: AudioQuality, report: QualityReport) => void)[] = []

    constructor(peerConnection: RTCPeerConnection) {
        this.pc = peerConnection
    }

    /**
     * Start monitoring quality
     */
    start(intervalMs: number = 2000): void {
        if (this.monitorInterval) {
            console.warn('Quality monitor already running')
            return
        }

        console.log(`Starting quality monitor (${intervalMs}ms interval)`)
        this.monitorInterval = setInterval(() => {
            this.checkQuality()
        }, intervalMs)

        // Initial check
        this.checkQuality()
    }

    /**
     * Stop monitoring
     */
    stop(): void {
        if (this.monitorInterval) {
            clearInterval(this.monitorInterval)
            this.monitorInterval = null
        }
        this.previousStats = null
        this.qualityHistory = []
    }

    /**
     * Get current quality report
     */
    async getQualityReport(): Promise<QualityReport | null> {
        if (!this.pc) return null

        try {
            const metrics = await this.getMetrics()
            if (!metrics) return null

            const overall = this.assessQuality(metrics)
            const issues = this.identifyIssues(metrics)
            const recommendations = this.generateRecommendations(metrics, issues)

            return {
                overall,
                metrics,
                issues,
                recommendations
            }
        } catch (error) {
            console.error('Failed to get quality report:', error)
            return null
        }
    }

    /**
     * Register quality change handler
     */
    onQualityChange(handler: (quality: AudioQuality, report: QualityReport) => void): void {
        this.qualityChangeHandlers.push(handler)
    }

    /**
     * Get quality trend (improving/stable/degrading)
     */
    getQualityTrend(): 'improving' | 'stable' | 'degrading' | 'unknown' {
        if (this.qualityHistory.length < 3) return 'unknown'

        const recent = this.qualityHistory.slice(-3)
        const scores = recent.map(q => this.qualityToScore(q))

        const improving = scores[2] > scores[0]
        const degrading = scores[2] < scores[0]

        if (improving) return 'improving'
        if (degrading) return 'degrading'
        return 'stable'
    }

    // ========================================================================
    // PRIVATE METHODS
    // ========================================================================

    private async checkQuality(): Promise<void> {
        const report = await this.getQualityReport()
        if (!report) return

        // Track quality history
        this.qualityHistory.push(report.overall)
        if (this.qualityHistory.length > this.maxHistoryLength) {
            this.qualityHistory.shift()
        }

        // Notify handlers if quality changed
        if (this.qualityChangeHandlers.length > 0) {
            const previousQuality = this.qualityHistory[this.qualityHistory.length - 2]
            if (previousQuality !== report.overall) {
                this.qualityChangeHandlers.forEach(handler => {
                    try {
                        handler(report.overall, report)
                    } catch (error) {
                        console.error('Error in quality change handler:', error)
                    }
                })
            }
        }
    }

    private async getMetrics(): Promise<QualityMetrics | null> {
        if (!this.pc) return null

        try {
            const stats = await this.pc.getStats()
            let inboundStats: any = null
            let outboundStats: any = null

            stats.forEach(stat => {
                if (stat.type === 'inbound-rtp' && stat.kind === 'audio') {
                    inboundStats = stat
                }
                if (stat.type === 'outbound-rtp' && stat.kind === 'audio') {
                    outboundStats = stat
                }
            })

            if (!inboundStats && !outboundStats) {
                return null
            }

            // Calculate metrics
            const packetsReceived = inboundStats?.packetsReceived || 0
            const packetsLost = inboundStats?.packetsLost || 0
            const totalPackets = packetsReceived + packetsLost
            const packetLoss = totalPackets > 0 ? (packetsLost / totalPackets) * 100 : 0

            const jitter = (inboundStats?.jitter || 0) * 1000 // Convert to ms

            // RTT from outbound stats (if available)
            let rtt = 0
            if (outboundStats?.roundTripTime !== undefined) {
                rtt = outboundStats.roundTripTime * 1000 // Convert to ms
            }

            const metrics: QualityMetrics = {
                packetLoss,
                jitter,
                rtt,
                bytesReceived: inboundStats?.bytesReceived || 0,
                bytesSent: outboundStats?.bytesSent || 0,
                packetsLost,
                packetsReceived,
                timestamp: Date.now()
            }

            this.previousStats = metrics
            return metrics
        } catch (error) {
            console.error('Failed to get WebRTC stats:', error)
            return null
        }
    }

    private assessQuality(metrics: QualityMetrics): AudioQuality {
        const { packetLoss, jitter, rtt } = metrics

        // Excellent quality
        if (
            packetLoss < QUALITY_THRESHOLDS.excellent.packetLoss &&
            jitter < QUALITY_THRESHOLDS.excellent.jitter &&
            (rtt === 0 || rtt < QUALITY_THRESHOLDS.excellent.rtt)
        ) {
            return 'excellent'
        }

        // Good quality
        if (
            packetLoss < QUALITY_THRESHOLDS.good.packetLoss &&
            jitter < QUALITY_THRESHOLDS.good.jitter &&
            (rtt === 0 || rtt < QUALITY_THRESHOLDS.good.rtt)
        ) {
            return 'good'
        }

        // Poor quality
        if (
            packetLoss < QUALITY_THRESHOLDS.poor.packetLoss &&
            jitter < QUALITY_THRESHOLDS.poor.jitter &&
            (rtt === 0 || rtt < QUALITY_THRESHOLDS.poor.rtt)
        ) {
            return 'poor'
        }

        // Critical quality
        return 'critical'
    }

    private identifyIssues(metrics: QualityMetrics): string[] {
        const issues: string[] = []

        if (metrics.packetLoss >= QUALITY_THRESHOLDS.poor.packetLoss) {
            issues.push(`High packet loss (${metrics.packetLoss.toFixed(1)}%)`)
        }

        if (metrics.jitter >= QUALITY_THRESHOLDS.poor.jitter) {
            issues.push(`High jitter (${metrics.jitter.toFixed(0)}ms)`)
        }

        if (metrics.rtt > 0 && metrics.rtt >= QUALITY_THRESHOLDS.poor.rtt) {
            issues.push(`High latency (${metrics.rtt.toFixed(0)}ms RTT)`)
        }

        if (metrics.bytesReceived === 0 && this.previousStats && this.previousStats.bytesReceived > 0) {
            issues.push('No audio received')
        }

        return issues
    }

    private generateRecommendations(metrics: QualityMetrics, issues: string[]): string[] {
        const recommendations: string[] = []

        if (metrics.packetLoss >= QUALITY_THRESHOLDS.good.packetLoss) {
            recommendations.push('Check your internet connection')
            recommendations.push('Close bandwidth-heavy applications')
        }

        if (metrics.jitter >= QUALITY_THRESHOLDS.good.jitter) {
            recommendations.push('Switch to a wired connection if possible')
            recommendations.push('Reduce network congestion')
        }

        if (metrics.rtt > 0 && metrics.rtt >= QUALITY_THRESHOLDS.good.rtt) {
            recommendations.push('Move closer to your router')
            recommendations.push('Check for network interference')
        }

        if (issues.includes('No audio received')) {
            recommendations.push('Check if microphone is muted')
            recommendations.push('Verify microphone permissions')
        }

        return recommendations
    }

    private qualityToScore(quality: AudioQuality): number {
        switch (quality) {
            case 'excellent': return 4
            case 'good': return 3
            case 'poor': return 2
            case 'critical': return 1
            default: return 0
        }
    }
}

/**
 * Adaptive bitrate controller
 */
export class AdaptiveBitrateController {
    private pc: RTCPeerConnection
    private qualityMonitor: AudioQualityMonitor
    private currentBitrate: number = 128000 // Default 128 kbps

    constructor(peerConnection: RTCPeerConnection, qualityMonitor: AudioQualityMonitor) {
        this.pc = peerConnection
        this.qualityMonitor = qualityMonitor

        // Monitor quality and adapt bitrate
        qualityMonitor.onQualityChange((quality, report) => {
            this.adaptBitrate(quality, report)
        })
    }

    /**
     * Adapt bitrate based on quality
     */
    private async adaptBitrate(quality: AudioQuality, report: QualityReport): Promise<void> {
        let targetBitrate = this.currentBitrate

        switch (quality) {
            case 'excellent':
                // Can increase bitrate
                targetBitrate = Math.min(this.currentBitrate * 1.2, 256000)
                break

            case 'good':
                // Maintain current bitrate
                break

            case 'poor':
                // Reduce bitrate moderately
                targetBitrate = Math.max(this.currentBitrate * 0.8, 64000)
                break

            case 'critical':
                // Aggressively reduce bitrate
                targetBitrate = Math.max(this.currentBitrate * 0.5, 32000)
                break
        }

        if (targetBitrate !== this.currentBitrate) {
            console.log(`Adapting bitrate: ${this.currentBitrate} -> ${targetBitrate} (quality: ${quality})`)
            await this.setBitrate(targetBitrate)
            this.currentBitrate = targetBitrate
        }
    }

    /**
     * Set audio bitrate
     */
    private async setBitrate(bitrate: number): Promise<void> {
        const senders = this.pc.getSenders()
        const audioSender = senders.find(sender => sender.track?.kind === 'audio')

        if (!audioSender) {
            console.warn('No audio sender found')
            return
        }

        const parameters = audioSender.getParameters()
        if (!parameters.encodings || parameters.encodings.length === 0) {
            parameters.encodings = [{}]
        }

        parameters.encodings[0].maxBitrate = bitrate

        try {
            await audioSender.setParameters(parameters)
        } catch (error) {
            console.error('Failed to set bitrate:', error)
        }
    }

    /**
     * Get current bitrate
     */
    getCurrentBitrate(): number {
        return this.currentBitrate
    }
}
