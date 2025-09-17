"use client"

import { Button } from "@/components/ui/button"

interface PillProps { className: string; children: React.ReactNode }
const Pill = ({ className, children }: PillProps) => (
    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${className}`}>{children}</span>
)

type RoleConfig = { icon?: React.ReactNode; name?: string }

interface AssessmentConsoleProps {
    isVisible: boolean
    onToggle: () => void
    roleConfig?: RoleConfig | null
    currentQuestionIndex: number
    totalQuestions: number
    answeredCount: number
    timeLeft: number
    violationCount: number
    progressPercent: number
    isLastQuestion: boolean
    lastSavedAt?: Date
    onPrevQuestion: () => void
    onNextQuestion: () => void
    onGoToQuestion: (index: number) => void
    isQuestionAnswered: (index: number) => boolean
    onShowNavigator: () => void
    onSubmit: () => void
    formatTime: (seconds: number) => string
    formatRelativeTime: (date: Date) => string
}

export function AssessmentConsole({
    isVisible,
    onToggle,
    roleConfig,
    currentQuestionIndex,
    totalQuestions,
    answeredCount,
    timeLeft,
    violationCount,
    progressPercent,
    isLastQuestion,
    lastSavedAt,
    onPrevQuestion,
    onNextQuestion,
    onGoToQuestion,
    isQuestionAnswered,
    onShowNavigator,
    onSubmit,
    formatTime,
    formatRelativeTime
}: AssessmentConsoleProps) {
    const urgent = timeLeft <= 5 * 60; // 5 minutes threshold

    return (
        <header id="top-bar" role="banner" aria-label="Assessment status bar">
            {/* LEFT: question status */}
            <div className="top-bar-left" aria-live="polite">
                {roleConfig?.icon && <span className="text-2xl" aria-hidden="true">{roleConfig.icon}</span>}
                <div className="nowrap">
                    Question <strong>{currentQuestionIndex + 1}</strong> of <strong>{totalQuestions}</strong>
                </div>
                <span className="question-indicator" aria-label="Current question">Current</span>
            </div>

            {/* CENTER: progress + navigation */}
            <div className="top-bar-center">
                <button className="btn" onClick={onPrevQuestion} disabled={currentQuestionIndex === 0} aria-label="Go to previous question">← Previous</button>

                {/* Quick numbered navigation */}
                <nav className="q-nav-group" aria-label="Quick question navigation">
                    <div className="q-nav-scroll">
                        {Array.from({ length: totalQuestions }, (_, i) => {
                            const isCurrent = i === currentQuestionIndex;
                            const answered = isQuestionAnswered(i);
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    className={`q-btn ${answered ? 'answered' : ''} ${isCurrent ? 'current' : ''}`}
                                    aria-label={`Go to question ${i + 1}${answered ? ', answered' : ''}`}
                                    aria-current={isCurrent ? 'true' : undefined}
                                    onClick={() => onGoToQuestion(i)}
                                >
                                    {i + 1}
                                </button>
                            )
                        })}
                    </div>
                </nav>

                <div className="nowrap" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="chip">Progress</span>
                    <div className="progress" aria-label={`Progress ${progressPercent} percent`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progressPercent}>
                        <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
                    </div>
                    <span className="nowrap" style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(progressPercent)}%</span>
                </div>

                <button className="btn btn-primary" onClick={onNextQuestion} disabled={currentQuestionIndex === totalQuestions - 1} aria-label="Go to next question">Next →</button>
            </div>

            {/* RIGHT: timer + status */}
            <div className="top-bar-right">
                <div className="nowrap" aria-live="polite">
                    <strong className={urgent ? 'timer-urgent' : 'timer-normal'} aria-label="Time remaining">{formatTime(timeLeft)}</strong>
                </div>
                <span className="status-pill status-green" aria-label="Answered count">Answered: {answeredCount}</span>
                <span
                    className={`status-pill ${violationCount >= 3 ? 'status-red' : (violationCount > 0 ? 'status-yellow' : 'status-green')}`}
                    aria-label={`Violations ${violationCount} of 3`}
                >
                    Violations: {violationCount}/3
                </span>
                {lastSavedAt && (
                    <span className="status-pill status-yellow" aria-label="Saved time">Saved: {formatRelativeTime(lastSavedAt)}</span>
                )}
                <button className="btn" onClick={onShowNavigator} title="Question Overview" aria-label="Open navigator">☰</button>
                {isLastQuestion && (
                    <Button onClick={onSubmit} className="ml-2">
                        🏁 Submit
                    </Button>
                )}
            </div>
        </header>
    )
}
