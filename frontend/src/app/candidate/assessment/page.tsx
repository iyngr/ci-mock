"use client"

import React from "react"
import { useState, useEffect, useCallback, useRef } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Question, QuestionType, Answer, ProctoringEvent, DeveloperRole, CodeSubmission } from "@/lib/schema"
import { getRoleConfig, getAllRoles, getLanguagesForRole, RoleConfig } from "@/lib/roleConfig"
import Editor from "@monaco-editor/react"
import LiveReactEditor from "@/components/LiveReactEditor"

// Warning Modal Component - designed to work in fullscreen
const WarningModal = ({ onContinue, violationCount }: { onContinue: () => void, violationCount: number }) => (
  <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[9999]" style={{ zIndex: 2147483647 }}>
    <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 text-center shadow-2xl">
      <h2 className="text-2xl font-bold text-red-600 mb-4">⚠️ Warning {violationCount} of 3!</h2>
      <p className="text-gray-700 mb-4">
        You attempted to exit the assessment window. This is not allowed during the test.
      </p>
      <p className="text-sm text-gray-600 mb-6">
        You have <strong>{3 - violationCount}</strong> warning{3 - violationCount !== 1 ? 's' : ''} remaining before your assessment will be automatically submitted.
      </p>
      <Button onClick={onContinue} className="w-full bg-blue-600 hover:bg-blue-700">
        Return to Test
      </Button>
    </div>
  </div>
)

// Notification Component for copy/paste attempts
const Notification = ({ message, onClose }: { message: string, onClose: () => void }) => (
  <div className="fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center space-x-3">
    <span className="text-sm font-medium">{message}</span>
    <button onClick={onClose} className="text-white hover:text-gray-200 font-bold">×</button>
  </div>
)

// Modal to confirm submitting with incomplete answers
const IncompleteModal = ({ unansweredCount, total, onCancel, onConfirm, unansweredIndices }: {
  unansweredCount: number;
  total: number;
  onCancel: () => void;
  onConfirm: () => void;
  unansweredIndices: number[];
}) => (
  <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[9999]" style={{ zIndex: 2147483647 }}>
    <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4 shadow-2xl">
      <h2 className="text-xl font-bold mb-4 text-gray-900">Incomplete Assessment</h2>
      <p className="text-gray-700 mb-3">You have <span className="font-semibold">{unansweredCount}</span> unanswered question{unansweredCount !== 1 ? 's' : ''} out of {total}.</p>
      {unansweredIndices.length > 0 && (
        <p className="text-sm text-gray-600 mb-3">Unanswered: {unansweredIndices.map(i => i + 1).join(', ')}</p>
      )}
      <div className="text-xs text-gray-500 mb-4 space-y-1">
        <p>• MCQ requires an option selected.</p>
        <p>• Coding & Descriptive need at least 5 non-whitespace characters.</p>
      </div>
      <div className="flex justify-end space-x-3">
        <Button variant="outline" onClick={onCancel}>Review</Button>
        <Button variant="destructive" onClick={onConfirm}>Submit Anyway</Button>
      </div>
    </div>
  </div>
)

export default function Assessment() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [timeLeft, setTimeLeft] = useState(0) // Will be calculated from server expiration time
  const [loading, setLoading] = useState(true)
  const [proctoringEvents, setProctoringEvents] = useState<ProctoringEvent[]>([])
  const [codeOutput, setCodeOutput] = useState("")
  const [runningCode, setRunningCode] = useState(false)
  const [violationCount, setViolationCount] = useState(0)
  const [showWarningModal, setShowWarningModal] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)
  const [showIncompleteModal, setShowIncompleteModal] = useState(false)
  const [unansweredIndices, setUnansweredIndices] = useState<number[]>([])

  // Role-based state
  const [_selectedRole, setSelectedRole] = useState<DeveloperRole | null>(null)
  const [roleConfig, setRoleConfig] = useState<RoleConfig | null>(null)
  const [showRoleSelection, setShowRoleSelection] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isSubmittingRef = useRef(false)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [showNavigator, setShowNavigator] = useState(false)
  const chipContainerRef = useRef<HTMLDivElement | null>(null)
  const [showChipScrollLeft, setShowChipScrollLeft] = useState(false)
  const [showChipScrollRight, setShowChipScrollRight] = useState(false)
  const chipScrollCheck = useCallback(() => {
    const el = chipContainerRef.current
    if (!el) return
    setShowChipScrollLeft(el.scrollLeft > 4)
    setShowChipScrollRight(el.scrollWidth - el.clientWidth - el.scrollLeft > 4)
  }, [])

  // Use refs to avoid stale closure issues
  const violationCountRef = useRef(0)
  const isProcessingRef = useRef(false)
  const router = useRouter()

  // Update ref whenever state changes
  useEffect(() => {
    violationCountRef.current = violationCount
  }, [violationCount])

  // Keep submitting ref in sync
  useEffect(() => {
    isSubmittingRef.current = isSubmitting
  }, [isSubmitting])

  const logProctoringEvent = useCallback((eventType: string, details: Record<string, unknown>) => {
    const event: ProctoringEvent = {
      timestamp: new Date().toISOString(),
      eventType,
      details
    };
    setProctoringEvents(prev => [...prev, event]);
  }, []);

  // Function to show temporary notifications
  const showNotification = useCallback((message: string) => {
    setNotification(message);
    setTimeout(() => {
      setNotification(null);
    }, 3000); // Hide after 3 seconds
  }, []);

  const handleViolation = useCallback((violationType: string) => {
    // Suppress violations while submitting
    if (isSubmittingRef.current) {
      return;
    }
    // Prevent rapid-fire violations
    if (isProcessingRef.current) {
      console.log(`Blocking rapid violation: ${violationType}`);
      return;
    }

    isProcessingRef.current = true;
    const currentCount = violationCountRef.current;
    const newCount = currentCount + 1;

    console.log(`Processing violation ${newCount}: ${violationType}`);

    // Update violation count
    setViolationCount(newCount);
    violationCountRef.current = newCount;

    // Log the violation
    logProctoringEvent("proctoring_violation", {
      type: violationType,
      count: newCount
    });

    if (newCount >= 3) {
      // Auto-submit on 3rd violation
      console.log("Auto-submitting assessment after 3 violations");
      handleSubmit();
    } else {
      // Show warning for 1st and 2nd violations
      console.log(`Showing warning ${newCount} of 3`);
      setShowWarningModal(true);

      // Force back to fullscreen after a brief delay
      setTimeout(() => {
        if (!document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(err => {
            console.log("Could not re-enter fullscreen:", err);
          });
        }
      }, 100);
    }

    // Reset processing flag after delay
    setTimeout(() => {
      isProcessingRef.current = false;
      console.log("Violation processing reset");
    }, 3000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logProctoringEvent]);

  const handleReturnToTest = useCallback(() => {
    setShowWarningModal(false);
    // Force back to fullscreen when returning to test
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log("Could not enter fullscreen:", err);
      });
    }
  }, []);

  const handleRoleSelection = useCallback((role: DeveloperRole) => {
    setSelectedRole(role)
    setRoleConfig(getRoleConfig(role))
    setShowRoleSelection(false)

    // Force fullscreen after role selection
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log("Could not enter fullscreen after role selection:", err);
      });
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    const storedSubmissionId = localStorage.getItem("submissionId")
    if (!storedSubmissionId) {
      console.error("No submission ID found")
      return
    }

    setIsSubmitting(true) // Disable proctoring during submission
    isSubmittingRef.current = true

    // Attempt to exit fullscreen gracefully before submitting/navigating
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen()
      } catch { /* ignore */ }
    }

    // Map frontend camelCase keys to backend expected format  
    const mappedAnswers = answers.map(a => ({
      questionId: a.questionId,
      questionType: a.questionType,
      submittedAnswer: a.submittedAnswer,
      timeSpent: a.timeSpent,
      codeSubmissions: a.codeSubmissions?.map((cs: CodeSubmission) => ({
        code: cs.code,
        timestamp: cs.timestamp,
        output: cs.output,
        error: cs.error
      }))
    }))

    const mappedEvents = proctoringEvents.map(e => ({
      timestamp: e.timestamp,
      eventType: e.eventType,
      details: e.details
    }))

    try {
      const candidateToken = localStorage.getItem("candidateToken")

      // Determine if this is an auto-submission due to violations
      const isAutoSubmitted = violationCount >= 3
      const currentTimestamp = new Date().toISOString()

      const response = await fetch(`http://localhost:8000/api/candidate/assessment/${storedSubmissionId}/submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${candidateToken}`
        },
        body: JSON.stringify({
          answers: mappedAnswers,
          proctoringEvents: mappedEvents,
          autoSubmitted: isAutoSubmitted,
          violationCount: violationCount,
          autoSubmitReason: isAutoSubmitted ? "exceeded_violation_limit" : null,
          autoSubmitTimestamp: isAutoSubmitted ? currentTimestamp : null
        })
      })

      const data = await response.json()

      if (data.success) {
        // Part 3: Clean up localStorage after successful submission
        localStorage.removeItem("testId")
        localStorage.removeItem("submissionId")
        localStorage.removeItem("expirationTime")
        localStorage.removeItem("durationMinutes")
        localStorage.removeItem("assessment_autosave")
        localStorage.removeItem("assessmentState") // Remove the session-resume state
        router.push("/candidate/success")
      } else {
        console.error('Submit failed', data)
      }
    } catch (error) {
      console.error("Failed to submit assessment:", error)
    }
  }, [answers, proctoringEvents, router]);

  // Validate completeness before actual submission
  const attemptSubmit = useCallback(() => {
    if (isSubmittingRef.current) return;
    const incomplete: number[] = []
    answers.forEach((ans, idx) => {
      const q = questions[idx]
      if (!q) return
      if (q.type === QuestionType.MCQ) {
        if (ans.submittedAnswer === "-1" || ans.submittedAnswer === undefined || ans.submittedAnswer === null) incomplete.push(idx)
      } else if (q.type === QuestionType.CODING || q.type === QuestionType.DESCRIPTIVE) {
        const content = (ans.submittedAnswer || '').trim()
        if (content.replace(/\s+/g, ' ').trim().length < 5) incomplete.push(idx)
      }
    })
    if (incomplete.length > 0) {
      setUnansweredIndices(incomplete)
      setShowIncompleteModal(true)
      return
    }
    handleSubmit()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, questions])
  useEffect(() => {
    const testId = localStorage.getItem("testId")
    const storedSubmissionId = localStorage.getItem("submissionId")
    const storedExpirationTime = localStorage.getItem("expirationTime")

    if (!testId || !storedSubmissionId || !storedExpirationTime) {
      router.push("/candidate")
      return
    }

    // Calculate initial time left based on server expiration time
    const expirationDate = new Date(storedExpirationTime)
    const now = new Date()
    const timeLeftSeconds = Math.max(0, Math.floor((expirationDate.getTime() - now.getTime()) / 1000))
    setTimeLeft(timeLeftSeconds)

    // Only fetch assessment data once on mount
    let isMounted = true;

    const fetchAssessmentData = async () => {
      try {
        console.log("Fetching assessment data for testId:", testId)
        const response = await fetch(`http://localhost:8000/api/candidate/assessment/${testId}`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        console.log("Assessment data received:", data)

        if (data.success && isMounted) {
          setQuestions(data.questions)

          // Check if role is pre-assigned or needs selection
          if (data.role) {
            setSelectedRole(data.role)
            setRoleConfig(getRoleConfig(data.role))
          } else {
            // Show role selection if not pre-assigned
            setShowRoleSelection(true)
          }

          // Initialize answers array
          const initialAnswers: Answer[] = data.questions.map((q: Question) => ({
            questionId: q._id!,
            questionType: q.type,
            submittedAnswer: q.type === QuestionType.MCQ ? "-1" : (q.starter_code || ""),
            timeSpent: 0,
            codeSubmissions: q.type === QuestionType.CODING ? [] : undefined
          }))
          setAnswers(initialAnswers)

          // Part 2: Hydrate state from localStorage after questions are loaded
          const savedAssessmentState = localStorage.getItem("assessmentState");
          if (savedAssessmentState) {
            try {
              const parsedState = JSON.parse(savedAssessmentState);

              // Critical validation: check if submissionId matches current session
              if (parsedState.submissionId && parsedState.submissionId === storedSubmissionId) {
                // Validation passed - restore the user's session
                if (parsedState.answers && Array.isArray(parsedState.answers)) {
                  setAnswers(parsedState.answers);
                }
                if (typeof parsedState.currentQuestionIndex === 'number') {
                  setCurrentQuestionIndex(parsedState.currentQuestionIndex);
                }
                if (parsedState.savedAt) {
                  setLastSavedAt(parsedState.savedAt);
                }
              }
            } catch (error) {
              console.error("Failed to parse saved assessment state:", error);
            }
          }
        }
      } catch (error) {
        console.error("Failed to fetch assessment:", error)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchAssessmentData()

    // Legacy autosave support (can be removed in future)
    const saved = localStorage.getItem("assessment_autosave")
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed?.answers && Array.isArray(parsed.answers)) {
          // Defer merge until questions fetched
          const interval = setInterval(() => {
            if (questions.length > 0 && parsed.answers.length === questions.length) {
              setAnswers(prev => prev.map((a, i) => ({ ...a, submittedAnswer: parsed.answers[i]?.submittedAnswer ?? a.submittedAnswer })))
              setLastSavedAt(parsed.savedAt)
              clearInterval(interval)
            }
          }, 300)
          setTimeout(() => clearInterval(interval), 5000)
        }
      } catch { /* ignore */ }
    }

    // Force fullscreen on assessment start
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        console.log("Could not enter fullscreen on start:", err);
      });
    }

    // Setup timer - now using server-provided expiration time
    const timer = setInterval(() => {
      const currentTime = new Date()
      const expiration = new Date(storedExpirationTime)
      const remainingTime = Math.max(0, Math.floor((expiration.getTime() - currentTime.getTime()) / 1000))

      setTimeLeft(remainingTime)

      if (remainingTime <= 0) {
        // Time's up - auto submit
        handleSubmit()
        clearInterval(timer)
      }
    }, 1000)

    // Setup proctoring
    setupProctoring()

    // Enhanced proctoring - keyboard events and window focus
    const handleKeyDown = (e: KeyboardEvent) => {
      // Detect if focus inside monaco editor to allow Esc & shortcuts there
      const active = document.activeElement as HTMLElement | null
      const insideCodeEditor = !!active?.closest('.monaco-editor')
      // Detect Alt+Tab, Windows Key, etc.
      if (e.altKey || e.metaKey) {
        e.preventDefault();
        handleViolation("keyboard_shortcut");
      }

      // Specifically handle Escape key to prevent fullscreen exit
      if (e.key === 'Escape' && !insideCodeEditor) {
        e.preventDefault();
        handleViolation("escape_key");
        return;
      }

      // Handle copy/paste/cut/select-all attempts - show notification only (not a violation)
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        showNotification("📋 Copying is disabled during the assessment");
        return;
      }

      if (e.ctrlKey && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        showNotification("📋 Pasting is disabled during the assessment");
        return;
      }

      if (e.ctrlKey && (e.key === 'x' || e.key === 'X')) {
        e.preventDefault();
        showNotification("📋 Cutting is disabled during the assessment");
        return;
      }

      if (e.ctrlKey && (e.key === 'a' || e.key === 'A')) {
        e.preventDefault();
        showNotification("📋 Select all is disabled during the assessment");
        return;
      }
    };

    const handleWindowBlur = () => {
      handleViolation("window_blur");
    };

    // Prevent right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      showNotification("🚫 Right-click is disabled during the assessment");
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("blur", handleWindowBlur);
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      isMounted = false;
      clearInterval(timer)
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("blur", handleWindowBlur);
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    }
  }, []) // Empty dependency array - only run once on mount

  // Part 1: Persist assessment state to localStorage with debounce
  useEffect(() => {
    if (answers.length === 0) return;

    const timeout = setTimeout(() => {
      const currentSubmissionId = localStorage.getItem("submissionId");
      if (!currentSubmissionId) return;

      const stateObject = {
        answers: answers,
        currentQuestionIndex: currentQuestionIndex,
        submissionId: currentSubmissionId,
        savedAt: new Date().toISOString()
      };

      localStorage.setItem("assessmentState", JSON.stringify(stateObject));
      setLastSavedAt(stateObject.savedAt);
    }, 1000); // 1-second debounce delay

    return () => clearTimeout(timeout);
  }, [answers, currentQuestionIndex])

  const setupProctoring = () => {
    // Monitor fullscreen changes
    const handleFullscreenChange = () => {
      // Don't enforce fullscreen during submission
      if (isSubmittingRef.current) return;

      if (!document.fullscreenElement) {
        // Log the fullscreen exit event
        const event: ProctoringEvent = {
          timestamp: new Date().toISOString(),
          eventType: "fullscreen_exit",
          details: { timestamp: Date.now() }
        }
        setProctoringEvents(prev => [...prev, event])

        // Check current violation count to decide action
        const currentViolations = violationCountRef.current;
        if (currentViolations < 2) {
          // For first 2 violations, immediately try to re-enter fullscreen
          setTimeout(() => {
            if (!document.fullscreenElement && !isSubmitting) {
              document.documentElement.requestFullscreen().catch(err => {
                console.log("Could not re-enter fullscreen:", err);
              });
            }
          }, 50); // Small delay to ensure fullscreen exit event is processed

          // Then trigger the violation handling
          setTimeout(() => {
            handleViolation("fullscreen_exit");
          }, 100);
        } else {
          // For 3rd violation, proceed normally
          handleViolation("fullscreen_exit");
        }
      }
    }

    // Monitor tab visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden && !isSubmittingRef.current) {
        const event: ProctoringEvent = {
          timestamp: new Date().toISOString(),
          eventType: "tab_switch",
          details: { timestamp: Date.now() }
        }
        setProctoringEvents(prev => [...prev, event])

        // Trigger violation handling for tab switching
        handleViolation("tab_switch");
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }

  const updateAnswer = (value: string) => {
    const updatedAnswers = [...answers]
    updatedAnswers[currentQuestionIndex] = {
      ...updatedAnswers[currentQuestionIndex],
      submittedAnswer: value
    }
    setAnswers(updatedAnswers)
  }

  const runCode = async () => {
    const currentAnswer = answers[currentQuestionIndex]
    if (currentAnswer.questionType !== QuestionType.CODING) return

    setRunningCode(true)
    setCodeOutput("Running code...")

    try {
      const response = await fetch("http://localhost:8000/api/utils/run-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: currentQuestion.language || roleConfig?.defaultLanguage || "javascript",
          code: currentAnswer.submittedAnswer,
          stdin: ""
        })
      })

      const data = await response.json()

      if (data.success) {
        setCodeOutput(data.output || "Code executed successfully")
      } else {
        setCodeOutput(`Error: ${data.error || "Code execution failed"}`)
      }

      // Record code submission
      const updatedAnswers = [...answers]
      const codeSubmissions = updatedAnswers[currentQuestionIndex].codeSubmissions || []
      codeSubmissions.push({
        code: currentAnswer.submittedAnswer,
        timestamp: new Date().toISOString(),
        output: data.output,
        error: data.error
      })
      updatedAnswers[currentQuestionIndex].codeSubmissions = codeSubmissions
      setAnswers(updatedAnswers)

    } catch {
      setCodeOutput("Failed to execute code")
    } finally {
      setRunningCode(false)
    }
  }

  // Conditional code editor renderer based on role configuration
  const renderCodeEditor = () => {
    const currentAnswer = answers[currentQuestionIndex]
    const showPreview = roleConfig?.showPreview &&
      (currentQuestion.show_preview !== false)

    if (showPreview) {
      // Use LiveReactEditor for frontend roles
      return (
        <LiveReactEditor
          initialCode={currentAnswer.submittedAnswer}
          onChange={(code) => updateAnswer(code)}
          onRun={runCode}
          showNotification={showNotification}
          language={currentQuestion.language || roleConfig?.defaultLanguage || "javascript"}
        />
      )
    } else {
      // Use regular Monaco Editor for backend roles
      return (
        <div className="space-y-4">
          <div className="border rounded-lg overflow-hidden">
            <Editor
              height="400px"
              defaultLanguage={currentQuestion.language || roleConfig?.defaultLanguage || "javascript"}
              value={currentAnswer.submittedAnswer}
              onChange={(value) => updateAnswer(value || "")}
              theme={roleConfig?.editorTheme || "vs-dark"}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                scrollBeyondLastLine: false,
                contextmenu: false, // Disable right-click context menu
                automaticLayout: true,
                lineNumbers: 'on',
                wordWrap: 'on',
                quickSuggestions: false,
                suggestOnTriggerCharacters: false,
                parameterHints: { enabled: false },
                acceptSuggestionOnEnter: 'off',
                tabCompletion: 'off',
              }}
              onMount={(editor) => {
                // Add custom copy/paste handlers to Monaco Editor
                editor.addCommand(2048, () => {
                  showNotification("📋 Copying is disabled during the assessment");
                });
                editor.addCommand(2080, () => {
                  showNotification("📋 Pasting is disabled during the assessment");
                });
                editor.addCommand(2072, () => {
                  showNotification("📋 Cutting is disabled during the assessment");
                });
              }}
            />
          </div>

          <div className="flex justify-between items-center">
            <Button onClick={runCode} disabled={runningCode}>
              {runningCode ? "Running..." : "Run Code"}
            </Button>
          </div>

          {codeOutput && (
            <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm">
              <div className="mb-2 text-gray-400">Output:</div>
              <pre className="whitespace-pre-wrap">{codeOutput}</pre>
            </div>
          )}
        </div>
      )
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-lg">Loading your assessment...</p>
        </div>
      </div>
    )
  }

  // Role Selection Modal
  if (showRoleSelection) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-4xl w-full mx-4">
          <h2 className="text-3xl font-bold text-center mb-6">Select Your Developer Role</h2>
          <p className="text-gray-600 text-center mb-8">
            Choose the role that best matches the position you&apos;re applying for. This will customize your coding environment and assessment questions.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getAllRoles().map((role) => (
              <button
                key={role.value}
                onClick={() => handleRoleSelection(role.value)}
                className="p-6 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 text-left group"
              >
                <div className="flex items-center mb-3">
                  <span className="text-2xl mr-3">{role.icon}</span>
                  <h3 className="font-semibold text-lg group-hover:text-blue-600">{role.label}</h3>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">{role.description}</p>
                <div className="mt-3 text-xs text-blue-600 font-medium">
                  Languages: {getLanguagesForRole(role.value).join(', ')}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Note: This selection will determine your coding environment and question types. Choose carefully as this cannot be changed once the assessment begins.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-red-600">No questions found for this assessment</p>
        </div>
      </div>
    )
  }

  const currentQuestion = questions[currentQuestionIndex]
  const currentAnswer = answers[currentQuestionIndex]
  const isLastQuestion = currentQuestionIndex === questions.length - 1

  const isAnswered = (idx: number) => {
    const ans = answers[idx]
    if (!ans) return false
    const q = questions[idx]
    if (!q) return false
    if (q.type === QuestionType.MCQ) return ans.submittedAnswer !== "-1" && ans.submittedAnswer !== undefined && ans.submittedAnswer !== null
    if (q.type === QuestionType.CODING || q.type === QuestionType.DESCRIPTIVE) {
      const content = (ans.submittedAnswer || '').trim()
      return content.replace(/\s+/g, ' ').trim().length >= 5
    }
    return !!ans.submittedAnswer
  }
  const answeredCount = answers.reduce((acc, _, i) => acc + (isAnswered(i) ? 1 : 0), 0)
  const progressPercent = Math.round((answeredCount / questions.length) * 100)

  // Helper to render consistent info pills
  const Pill = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => (
    <span className={`text-xs sm:text-sm px-2 py-1 rounded border bg-gray-50 text-gray-700 font-medium inline-flex items-center ${className}`}>{children}</span>
  )

  const formatRelativeTime = (iso?: string | null) => {
    if (!iso) return ''
    try {
      const date = new Date(iso)
      const diff = Date.now() - date.getTime()
      if (diff < 30_000) return 'just now'
      const mins = Math.floor(diff / 60000)
      if (mins < 60) return `${mins}m ago`
      const hours = Math.floor(mins / 60)
      if (hours < 24) return `${hours}h ago`
      const days = Math.floor(hours / 24)
      return `${days}d ago`
    } catch { return '' }
  }

  return (
    <div
      className="min-h-screen assessment-bg"
      onContextMenu={(e) => e.preventDefault()}
    >
      {showWarningModal && <WarningModal onContinue={handleReturnToTest} violationCount={violationCount} />}
      {notification && <Notification message={notification} onClose={() => setNotification(null)} />}
      {showIncompleteModal && (
        <IncompleteModal
          unansweredCount={unansweredIndices.length}
          unansweredIndices={unansweredIndices}
          total={questions.length}
          onCancel={() => setShowIncompleteModal(false)}
          onConfirm={() => { setShowIncompleteModal(false); handleSubmit(); }}
        />
      )}

      {/* Top Bar */}
      <div className="assessment-card border-b py-3 px-4 m-0 rounded-none">
        <div className="max-w-7xl mx-auto flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2 justify-between">
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <div className="flex items-center gap-2 pr-2 border-r assessment-border mr-2">
                {roleConfig?.icon && <span className="text-xl leading-none">{roleConfig.icon}</span>}
                <span className="text-sm sm:text-base font-semibold assessment-text-primary whitespace-nowrap">{roleConfig?.name} Assessment</span>
              </div>
              <Pill className="bg-blue-50 border-blue-200 text-blue-700">Q {currentQuestionIndex + 1}/{questions.length}</Pill>
              <Pill className="bg-green-50 border-green-200 text-green-700">Answered {answeredCount}/{questions.length}</Pill>
              {lastSavedAt && <Pill className="bg-gray-50 border-gray-200 text-gray-500">Saved {formatRelativeTime(lastSavedAt)}</Pill>}
              <div className="flex gap-2 ml-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                  disabled={currentQuestionIndex === 0}
                >Prev</Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                  disabled={isLastQuestion}
                >Next</Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNavigator(true)}
                  title="Open Question Navigator"
                >☰</Button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
              <Pill className="bg-red-50 border-red-200 text-red-700 font-mono">⏱ {formatTime(timeLeft)}</Pill>
              {violationCount > 0 && (
                <Pill className="bg-yellow-50 border-yellow-200 text-yellow-800">Warnings {violationCount}/3</Pill>
              )}
              {isLastQuestion && (
                <Button onClick={attemptSubmit} variant="destructive" size="sm">Finish & Submit</Button>
              )}
            </div>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded overflow-hidden">
            <div className="h-full bg-blue-600 transition-all" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="relative">
            {showChipScrollLeft && (
              <button
                onClick={() => { chipContainerRef.current?.scrollBy({ left: -200, behavior: 'smooth' }); }}
                className="absolute left-0 top-1/2 -translate-y-1/2 bg-white shadow rounded-full w-6 h-6 flex items-center justify-center border hover:bg-gray-50 z-10"
                aria-label="Scroll left"
              >‹</button>
            )}
            {showChipScrollRight && (
              <button
                onClick={() => { chipContainerRef.current?.scrollBy({ left: 200, behavior: 'smooth' }); }}
                className="absolute right-0 top-1/2 -translate-y-1/2 bg-white shadow rounded-full w-6 h-6 flex items-center justify-center border hover:bg-gray-50 z-10"
                aria-label="Scroll right"
              >›</button>
            )}
            <div
              ref={chipContainerRef}
              onScroll={chipScrollCheck}
              className="flex gap-1 overflow-x-auto scrollbar-thin scrollbar-thumb-gray-300 pr-4"
              style={{ scrollBehavior: 'smooth' }}
            >
              {questions.map((q, i) => (
                <button
                  key={q._id || i}
                  onClick={() => setCurrentQuestionIndex(i)}
                  className={`flex-shrink-0 text-xs px-2 py-1 rounded border ${i === currentQuestionIndex ? 'border-blue-600 ring-1 ring-blue-400' : 'border-gray-300'} ${isAnswered(i) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'} hover:shadow transition-colors`}
                  title={`Question ${i + 1}: ${q.type}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Question */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-2">
                  <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">
                    {currentQuestion.type.toUpperCase()}
                  </span>
                  {currentQuestion.language && (
                    <span className="inline-block bg-green-100 text-green-800 px-2 py-1 rounded text-sm font-medium">
                      {currentQuestion.language.toUpperCase()}
                    </span>
                  )}
                </div>
                {roleConfig?.showPreview && currentQuestion.type === QuestionType.CODING && (
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                    Live Preview Enabled
                  </span>
                )}
              </div>
              {currentQuestion.tags.length > 0 && (
                <div>
                  {currentQuestion.tags.map((tag: string, index: number) => (
                    <span
                      key={index}
                      className="inline-block bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs mr-2"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="prose max-w-none">
              <h3 className="text-lg font-semibold mb-4">Question:</h3>
              <p className="whitespace-pre-wrap">{currentQuestion.prompt}</p>
            </div>
          </div>

          {/* Right Column - Answer Input */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Your Answer:</h3>

            {currentQuestion.type === QuestionType.MCQ && (
              <div className="space-y-3">
                {currentQuestion.options?.map((option: string, index: number) => (
                  <label key={index} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name={`question-${currentQuestionIndex}`}
                      value={index}
                      checked={currentAnswer.submittedAnswer === index.toString()}
                      onChange={() => updateAnswer(index.toString())}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            )}

            {currentQuestion.type === QuestionType.DESCRIPTIVE && (
              <Textarea
                value={currentAnswer.submittedAnswer}
                onChange={(e) => updateAnswer(e.target.value)}
                onPaste={(e) => {
                  e.preventDefault();
                  showNotification("📋 Pasting is disabled during the assessment");
                }}
                onCopy={(e) => {
                  e.preventDefault();
                  showNotification("📋 Copying is disabled during the assessment");
                }}
                onCut={(e) => {
                  e.preventDefault();
                  showNotification("📋 Cutting is disabled during the assessment");
                }}
                placeholder="Enter your answer here..."
                className="min-h-[300px]"
              />
            )}

            {currentQuestion.type === QuestionType.CODING && renderCodeEditor()}
          </div>
        </div>
      </div>

      {/* Navigator Modal */}
      {showNavigator && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-lg shadow-xl max-w-5xl w-full mx-4 p-6 relative">
            <button className="absolute top-3 right-3 text-gray-500 hover:text-gray-800" onClick={() => setShowNavigator(false)}>✕</button>
            <h3 className="text-xl font-semibold mb-4">Question Navigator</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-h-[50vh] overflow-y-auto pr-2">
              {['mcq', 'coding', 'descriptive'].map(group => {
                const groupQuestions = questions.map((q, i) => ({ q, i })).filter(({ q }) => (q.type || '').toString().toLowerCase() === group)
                if (groupQuestions.length === 0) return null
                return (
                  <div key={group} className="border rounded p-4">
                    <h4 className="font-medium mb-2 capitalize">{group}</h4>
                    <div className="flex flex-wrap gap-2">
                      {groupQuestions.map(({ q, i }) => (
                        <button
                          key={q._id || i}
                          onClick={() => { setCurrentQuestionIndex(i); setShowNavigator(false); }}
                          className={`w-8 h-8 text-xs rounded flex items-center justify-center border ${i === currentQuestionIndex ? 'border-blue-600' : 'border-gray-300'} ${isAnswered(i) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'} hover:shadow`}
                          title={`Question ${i + 1}`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-4 text-xs text-gray-500 flex items-center space-x-4">
              <span><span className="inline-block w-3 h-3 bg-green-200 border border-green-500 mr-1 align-middle" /> Answered</span>
              <span><span className="inline-block w-3 h-3 bg-gray-200 border border-gray-400 mr-1 align-middle" /> Unanswered</span>
              <span className="ml-auto">Progress: {answeredCount}/{questions.length} ({progressPercent}%)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}