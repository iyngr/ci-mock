"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Question, QuestionType, Answer, ProctoringEvent } from "@/lib/schema"
import Editor from "@monaco-editor/react"

export default function Assessment() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [timeLeft, setTimeLeft] = useState(2 * 60 * 60) // 2 hours in seconds
  const [loading, setLoading] = useState(true)
  const [proctoringEvents, setProctoringEvents] = useState<ProctoringEvent[]>([])
  const [codeOutput, setCodeOutput] = useState("")
  const [runningCode, setRunningCode] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const testId = localStorage.getItem("testId")
    if (!testId) {
      router.push("/candidate")
      return
    }

    // Fetch assessment data
    fetchAssessment(testId)

    // Setup timer
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up - auto submit
          handleSubmit()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    // Setup proctoring
    setupProctoring()

    return () => {
      clearInterval(timer)
    }
  }, [router])

  const fetchAssessment = async (testId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/candidate/assessment/${testId}`)
      const data = await response.json()

      if (data.success) {
        setQuestions(data.questions)
        // Initialize answers array
        const initialAnswers: Answer[] = data.questions.map((q: Question) => ({
          questionId: q._id!,
          questionType: q.type,
          answer: q.type === QuestionType.MCQ ? -1 : "",
          timeSpent: 0,
          codeSubmissions: q.type === QuestionType.CODING ? [] : undefined
        }))
        setAnswers(initialAnswers)
      }
    } catch (error) {
      console.error("Failed to fetch assessment:", error)
    } finally {
      setLoading(false)
    }
  }

  const setupProctoring = () => {
    // Monitor fullscreen changes
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        const event: ProctoringEvent = {
          timestamp: new Date().toISOString(),
          eventType: "fullscreen_exit",
          details: { timestamp: Date.now() }
        }
        setProctoringEvents(prev => [...prev, event])
      }
    }

    // Monitor tab visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        const event: ProctoringEvent = {
          timestamp: new Date().toISOString(),
          eventType: "tab_switch",
          details: { timestamp: Date.now() }
        }
        setProctoringEvents(prev => [...prev, event])
      }
    }

    document.addEventListener("fullscreenchange", handleFullscreenChange)
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }

  const updateAnswer = (value: any) => {
    const updatedAnswers = [...answers]
    updatedAnswers[currentQuestionIndex] = {
      ...updatedAnswers[currentQuestionIndex],
      answer: value
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
          language: "javascript",
          code: currentAnswer.answer,
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
        code: currentAnswer.answer as string,
        timestamp: new Date().toISOString(),
        output: data.output,
        error: data.error
      })
      updatedAnswers[currentQuestionIndex].codeSubmissions = codeSubmissions
      setAnswers(updatedAnswers)

    } catch (error) {
      setCodeOutput("Failed to execute code")
    } finally {
      setRunningCode(false)
    }
  }

  const handleSubmit = async () => {
    const testId = localStorage.getItem("testId")
    if (!testId) return

    // Map frontend camelCase keys to backend expected snake_case keys
    const mappedAnswers = answers.map(a => ({
      question_id: (a as any).questionId,
      question_type: (a as any).questionType,
      answer: (a as any).answer,
      time_spent: (a as any).timeSpent,
      code_submissions: (a as any).codeSubmissions?.map((cs: any) => ({
        code: cs.code,
        timestamp: cs.timestamp,
        output: cs.output,
        error: cs.error
      }))
    }))

    const mappedEvents = proctoringEvents.map(e => ({
      timestamp: e.timestamp,
      event_type: e.eventType,
      details: e.details
    }))

    try {
      const response = await fetch("http://localhost:8000/api/candidate/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          test_id: testId,
          answers: mappedAnswers,
          proctoring_events: mappedEvents
        })
      })

      const data = await response.json()

      if (data.success) {
        localStorage.removeItem("testId")
        router.push("/candidate/success")
      } else {
        console.error('Submit failed', data)
      }
    } catch (error) {
      console.error("Failed to submit assessment:", error)
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white shadow-sm border-b p-4">
        <div className="flex justify-between items-center max-w-7xl mx-auto">
          <div className="flex items-center space-x-4">
            <span className="text-lg font-semibold">
              Question {currentQuestionIndex + 1} of {questions.length}
            </span>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => setCurrentQuestionIndex(Math.max(0, currentQuestionIndex - 1))}
                disabled={currentQuestionIndex === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentQuestionIndex(Math.min(questions.length - 1, currentQuestionIndex + 1))}
                disabled={isLastQuestion}
              >
                Next
              </Button>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-lg font-mono bg-red-100 px-3 py-1 rounded">
              Time: {formatTime(timeLeft)}
            </div>
            {isLastQuestion && (
              <Button onClick={handleSubmit} variant="destructive">
                Finish & Submit
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Question */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-4">
              <span className="inline-block bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm font-medium">
                {currentQuestion.type.toUpperCase()}
              </span>
              {currentQuestion.tags.length > 0 && (
                <div className="mt-2">
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
                      checked={currentAnswer.answer === index}
                      onChange={() => updateAnswer(index)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            )}

            {currentQuestion.type === QuestionType.DESCRIPTIVE && (
              <Textarea
                value={currentAnswer.answer as string}
                onChange={(e) => updateAnswer(e.target.value)}
                placeholder="Enter your answer here..."
                className="min-h-[300px]"
              />
            )}

            {currentQuestion.type === QuestionType.CODING && (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <Editor
                    height="300px"
                    defaultLanguage="javascript"
                    value={currentAnswer.answer as string}
                    onChange={(value) => updateAnswer(value || "")}
                    theme="vs-dark"
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      scrollBeyondLastLine: false,
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
            )}
          </div>
        </div>
      </div>
    </div>
  )
}