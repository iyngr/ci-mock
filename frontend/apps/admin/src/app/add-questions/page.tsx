"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"
import { buildApiUrl } from "@/lib/apiClient"
// Phase 6: Duplicate detection
import { useDuplicateCheck } from "@/lib/adminHooks"
import { DuplicateWarning } from "@/components/AdminAnalyticsComponents"

// Question Types and Enums
type QuestionType = "mcq" | "coding" | "descriptive"
type DeveloperRole = "python-backend" | "java-backend" | "node-backend" | "react-frontend" | "fullstack-js" | "devops" | "mobile-developer" | "data-scientist"

interface MCQOption {
    id: string
    text: string
}

interface SingleQuestionData {
    text: string
    type: QuestionType
    tags: string[]
    role?: DeveloperRole
    options?: MCQOption[]
    correctAnswer?: string
    starterCode?: string
    testCases?: string[]
    programmingLanguage?: string
    timeLimit?: number
    maxWords?: number
    rubric?: string
}

interface BulkSessionMeta {
    session_id: string
    created_at?: string
    filename?: string
    validated_count?: number
    flagged_count?: number
}

interface BulkSessionRow {
    text: string
    reason?: string
}

interface BulkSessionDetail {
    session_id: string
    created_at?: string
    filename?: string
    validated: BulkSessionRow[]
    flagged: BulkSessionRow[]
}

export default function AddQuestions() {
    const [activeTab, setActiveTab] = useState<"single" | "bulk">("single")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const router = useRouter()

    // Single question form state
    const [questionData, setQuestionData] = useState<SingleQuestionData>({
        text: "",
        type: "descriptive",
        tags: [],
        options: [],
        correctAnswer: ""
    })
    // Separate raw tag input so typing commas/spaces isn't lost by controlled formatting
    const [tagInput, setTagInput] = useState<string>(questionData.tags.join(", "))
    const [tagValidation, setTagValidation] = useState<string | null>(null)

    // Bulk upload state
    const [uploadFile, setUploadFile] = useState<File | null>(null)
    const [bulkSessions, setBulkSessions] = useState<BulkSessionMeta[]>([])
    const [selectedSession, setSelectedSession] = useState<BulkSessionDetail | null>(null)

    // Phase 6: Duplicate detection
    const { checkDuplicate, checking, result, reset: resetDupCheck } = useDuplicateCheck()
    const [showDuplicateWarning, setShowDuplicateWarning] = useState(false)

    useEffect(() => {
        // Check if admin is logged in
        const token = localStorage.getItem("adminToken")
        if (!token) {
            router.push("/admin")
        }
    }, [router])

    const commitTagsFromInput = (value?: string) => {
        const raw = value !== undefined ? value : tagInput
        // Split on commas, trim, drop empties
        const parts = raw.split(',').map(tag => tag.trim()).filter(tag => tag.length > 0)

        const seen = new Set<string>()
        const deduped = [] as string[]
        let validationMsg: string | null = null

        for (let tag of parts) {
            // Replace whitespace with hyphens
            tag = tag.replace(/\s+/g, '-')
            // Replace any non allowed chars with hyphen (allow letters, numbers and hyphen)
            tag = tag.replace(/[^A-Za-z0-9-]/g, '-')
            // Collapse consecutive hyphens
            tag = tag.replace(/-+/g, '-')
            // Trim leading/trailing hyphens
            tag = tag.replace(/^-+|-+$/g, '')
            if (!tag) continue
            // Enforce per-tag max length 100 (truncate with warning)
            if (tag.length > 100) {
                tag = tag.slice(0, 100)
                validationMsg = 'Some tags were truncated to 100 characters.'
                // After truncation, ensure we didn't create a leading/trailing hyphen
                tag = tag.replace(/^-+|-+$/g, '')
            }

            const low = tag.toLowerCase()
            if (!seen.has(low)) {
                seen.add(low)
                deduped.push(tag)
            }
        }

        // If deduped list is empty but raw had values, show a validation message
        if (deduped.length === 0 && parts.length > 0 && !validationMsg) {
            validationMsg = 'Tags must contain letters, numbers or hyphens.'
        }

        setTagValidation(validationMsg)
        setQuestionData(prev => ({ ...prev, tags: deduped }))
        return deduped
    }

    // Sanitize tag input as the user types or pastes:
    // - replace whitespace and invalid chars with hyphen
    // - collapse consecutive hyphens
    // - trim leading/trailing hyphens
    // - enforce per-tag max length 100 (hard stop/truncate)
    const sanitizeTagInput = (val: string) => {
        const hadTrailingComma = val.endsWith(',')
        const parts = val.split(',')
        let truncated = false
        const outParts = parts.map(p => {
            let t = p.replace(/\s+/g, '-')
            t = t.replace(/[^A-Za-z0-9-]/g, '-')
            t = t.replace(/-+/g, '-')
            t = t.replace(/^-+|-+$/g, '')
            if (t.length > 100) {
                t = t.slice(0, 100)
                // ensure no leading/trailing hyphen after truncation
                t = t.replace(/^-+|-+$/g, '')
                truncated = true
            }
            return t
        })

        // Reconstruct, preserving a trailing comma if present
        let out = outParts.join(',')
        if (hadTrailingComma) out += ','
        setTagValidation(truncated ? 'Tag maximum length is 100 characters.' : null)
        return { out, truncated }
    }

    const updateOption = (index: number, text: string) => {
        setQuestionData(prev => ({
            ...prev,
            options: prev.options?.map((opt, i) =>
                i === index ? { ...opt, text } : opt
            )
        }))
    }

    const addOption = () => {
        if ((questionData.options?.length || 0) < 6) {
            const nextId = String.fromCharCode(97 + (questionData.options?.length || 0))
            setQuestionData(prev => ({
                ...prev,
                options: [...(prev.options || []), { id: nextId, text: "" }]
            }))
        }
    }

    const removeOption = (index: number) => {
        if ((questionData.options?.length || 0) > 2) {
            setQuestionData(prev => ({
                ...prev,
                options: prev.options?.filter((_, i) => i !== index)
            }))
        }
    }

    const handleSubmitSingle = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError("")
        setSuccess("")

        // Phase 6: Proactive duplicate detection
        try {
            const dupResult = await checkDuplicate(questionData.text, questionData.tags)
            if (dupResult && dupResult.has_duplicates) {
                setShowDuplicateWarning(true)
                setLoading(false)
                return
            }
        } catch (err) {
            console.warn('Duplicate check failed, proceeding with submission:', err)
            // Continue with submission even if check fails
        }

        try {
            const adminToken = localStorage.getItem("adminToken")

            // Mock API call - replace with actual endpoint
            const response = await fetch(buildApiUrl('/api/admin/questions'), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${adminToken}`
                },
                body: JSON.stringify(questionData),
            })
            // Surface backend errors (409 duplicate, etc.) with a friendly message
            if (!response.ok) {
                let errBody: Record<string, unknown> = {}
                try {
                    errBody = await response.json()
                } catch {
                    errBody = { detail: 'Server returned an error' }
                }

                // Normalize fields safely
                const statusStr = typeof errBody['status'] === 'string' ? String(errBody['status']) : ''
                const detailStr = typeof errBody['detail'] === 'string' ? String(errBody['detail']) : (typeof errBody['message'] === 'string' ? String(errBody['message']) : '')

                // HTTP 409 likely indicates duplicate or similar question
                if (response.status === 409) {
                    if (statusStr === 'exact_duplicate' || detailStr.toLowerCase().includes('already exists')) {
                        setError('A question with the same text already exists. Please modify your question.')
                    } else if (statusStr === 'similar_duplicate' || detailStr.toLowerCase().includes('similar')) {
                        const similar = Array.isArray(errBody['similar_questions']) ? (errBody['similar_questions'] as unknown[]) : (Array.isArray(errBody['similar']) ? (errBody['similar'] as unknown[]) : [])
                        let sample = ''
                        if (similar.length) {
                            const first = similar[0]
                            if (first && typeof first === 'object' && 'text' in (first as Record<string, unknown>)) {
                                const t = (first as Record<string, unknown>)['text']
                                sample = t && typeof t === 'string' ? ` Sample similar question: "${t}"` : ''
                            } else if (typeof first === 'string') {
                                sample = ` Sample similar question: "${first}"`
                            }
                        }
                        setError('A similar question already exists. Please review suggested changes or create a new question.' + sample)
                    } else {
                        setError(detailStr || 'Duplicate question detected. Please review.')
                    }
                } else {
                    setError(detailStr || 'Failed to add question')
                }

                return
            }

            const data = await response.json()

            if (data.success) {
                setSuccess("Question added successfully!")
                // Reset form
                setQuestionData({
                    text: "",
                    type: "descriptive",
                    tags: [],
                    options: [],
                    correctAnswer: ""
                })
                setTagInput("")
            } else {
                setError(data.message || "Failed to add question")
            }
        } catch {
            setError("Failed to connect to server")
        } finally {
            setLoading(false)
        }
    }

    const handleBulkUpload = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!uploadFile) {
            setError("Please select a file to upload")
            return
        }

        setLoading(true)
        setError("")
        setSuccess("")

        try {
            const formData = new FormData()
            formData.append("file", uploadFile)

            const adminToken = localStorage.getItem("adminToken")

            // POST to backend bulk-validate endpoint
            const response = await fetch(buildApiUrl('/api/admin/questions/bulk-validate'), {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${adminToken}`
                },
                body: formData,
            })

            if (!response.ok) {
                let errBody: Record<string, unknown> = {}
                try {
                    errBody = await response.json()
                } catch {
                    errBody = { detail: 'Server returned an error' }
                }

                const flaggedCount = typeof errBody['flagged_count'] === 'number' ? errBody['flagged_count'] as number : 0
                const detailStr = typeof errBody['detail'] === 'string' ? String(errBody['detail']) : (typeof errBody['message'] === 'string' ? String(errBody['message']) : '')

                if (response.status === 400 && flaggedCount > 0) {
                    setError(`Bulk upload contained ${flaggedCount} flagged rows. Fix them and retry.`)
                } else if (response.status === 409) {
                    setError(detailStr || 'Duplicate questions detected in upload')
                } else {
                    setError(detailStr || 'Failed to upload questions')
                }

                return
            }

            const data = await response.json()

            if (data.session_id) {
                setSuccess(`Bulk validation complete. Session created: ${data.session_id}`)
                // Clear React file state and reset the underlying input element so the user can select the same file again
                setUploadFile(null)
                try {
                    const fileInput = document.getElementById('file-upload') as HTMLInputElement | null
                    if (fileInput) fileInput.value = ''
                } catch (err) {
                    // ignore DOM reset errors
                }
                // Refresh session list and automatically open the newly created session for review
                await fetchBulkSessions()
                fetchSessionDetails(data.session_id)
            } else if (data.success) {
                setSuccess(`Successfully uploaded ${data.questionsAdded} questions!`)
                setUploadFile(null)
                fetchBulkSessions()
            } else {
                setError(data.message || "Failed to upload questions")
            }
        } catch {
            setError("Failed to connect to server")
        } finally {
            setLoading(false)
        }
    }

    const fetchBulkSessions = async () => {
        try {
            const adminToken = localStorage.getItem("adminToken")
            const res = await fetch(buildApiUrl('/api/admin/questions/bulk-sessions'), {
                headers: { Authorization: `Bearer ${adminToken}` }
            })
            if (!res.ok) return
            const json = await res.json()
            setBulkSessions(json.sessions || [])
        } catch (e) {
            // ignore
        }
    }

    const fetchSessionDetails = async (sessionId: string) => {
        try {
            const adminToken = localStorage.getItem("adminToken")
            const res = await fetch(buildApiUrl(`/api/admin/questions/bulk-sessions/${sessionId}`), {
                headers: { Authorization: `Bearer ${adminToken}` }
            })
            if (!res.ok) return
            const json = await res.json()
            setSelectedSession(json)
        } catch (e) {
            // ignore
        }
    }

    const [importing, setImporting] = useState(false)
    const [importResult, setImportResult] = useState<{ imported_count?: number; failed_count?: number } | null>(null)

    const handleConfirmImport = async (sessionId: string) => {
        setImporting(true)
        setImportResult(null)
        setError("")
        try {
            const adminToken = localStorage.getItem("adminToken")
            const res = await fetch(buildApiUrl(`/api/admin/questions/bulk-confirm?session_id=${sessionId}`), {
                method: 'POST',
                headers: { Authorization: `Bearer ${adminToken}` }
            })

            if (!res.ok) {
                let errBody: Record<string, unknown> = {}
                try { errBody = await res.json() } catch { errBody = { detail: 'Server error' } }
                const detailStr = typeof errBody['detail'] === 'string' ? String(errBody['detail']) : (typeof errBody['message'] === 'string' ? String(errBody['message']) : '')
                const flaggedCount = typeof errBody['flagged_count'] === 'number' ? errBody['flagged_count'] as number : 0
                if (res.status === 409) {
                    setError(detailStr || 'This session is being imported by another admin')
                } else if (res.status === 400 && flaggedCount > 0) {
                    setError(`Cannot import: session has ${flaggedCount} flagged rows`)
                } else {
                    setError(detailStr || 'Import failed')
                }
                return
            }

            const data = await res.json()
            setImportResult({ imported_count: data.imported_count || data.imported || 0, failed_count: data.failed_count || data.failed || 0 })
            // Refresh sessions list and clear selected session UI after import
            fetchBulkSessions()
            setSelectedSession(null)
            setSuccess(data.message || `Imported ${data.imported_count || data.imported || 0} questions`)
        } catch (e) {
            setError('Failed to contact server for import')
        } finally {
            setImporting(false)
        }
    }

    useEffect(() => {
        fetchBulkSessions()
    }, [])


    return (
        <div className="min-h-screen bg-warm-background">
            {/* Loading overlay */}
            {loading && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
                    <div className="bg-white p-6 rounded-lg shadow-lg flex flex-col items-center">
                        <div className="w-16 h-16 border-4 border-warm-brown/20 border-t-warm-brown rounded-full animate-spin mb-4"></div>
                        <div className="text-warm-brown/80">Checking KnowledgeBase for similar questions...</div>
                    </div>
                </div>
            )}
            <div className="max-w-6xl mx-auto px-6 pt-24 pb-8">{/* Increased top padding to account for floating nav */}
                {/* Header */}
                <AnimateOnScroll animation="fadeInUp" delay={200}>
                    <div className="mb-12">
                        <Button
                            variant="ghost"
                            onClick={() => router.push("/dashboard")}
                            className="mb-6 text-warm-brown/60 hover:text-warm-brown"
                        >
                            ← Back to Dashboard
                        </Button>

                        <h1 className="text-4xl lg:text-5xl font-light text-warm-brown mb-4 tracking-tight">
                            Question Management
                        </h1>
                        <div className="w-24 h-px bg-warm-brown/30 mb-4"></div>
                        <p className="text-lg text-warm-brown/60 font-light max-w-2xl">
                            Create individual questions or upload multiple questions in bulk
                        </p>
                    </div>
                </AnimateOnScroll>

                {/* Tab Navigation */}
                <AnimateOnScroll animation="fadeInUp" delay={300}>
                    <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-2 mb-8 inline-flex">
                        <button
                            onClick={() => setActiveTab("single")}
                            className={`px-6 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${activeTab === "single"
                                ? "bg-white text-warm-brown/60 ring-1 ring-warm-brown/10 shadow-sm"
                                : "text-warm-brown hover:text-warm-brown hover:bg-warm-brown/5"
                                }`}
                        >
                            Single Question
                        </button>
                        <button
                            onClick={() => setActiveTab("bulk")}
                            className={`px-6 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${activeTab === "bulk"
                                ? "bg-white text-warm-brown/60 ring-1 ring-warm-brown/10 shadow-sm"
                                : "text-warm-brown hover:text-warm-brown hover:bg-warm-brown/5"
                                }`}
                        >
                            Bulk Upload
                        </button>
                    </div>
                </AnimateOnScroll>

                {/* Error/Success Messages */}
                {error && (
                    <AnimateOnScroll animation="fadeInUp" delay={400}>
                        <div className="mb-8 p-4 bg-red-50/80 border border-red-200/50 rounded-xl">
                            <p className="text-red-700 text-sm font-light">{error}</p>
                        </div>
                    </AnimateOnScroll>
                )}
                {success && (
                    <AnimateOnScroll animation="fadeInUp" delay={400}>
                        <div className="mb-8 p-4 bg-green-50/80 border border-green-200/50 rounded-xl">
                            <p className="text-green-700 text-sm font-light">{success}</p>
                        </div>
                    </AnimateOnScroll>
                )}

                {/* Single Question Tab */}
                {activeTab === "single" && (
                    <AnimateOnScroll animation="fadeInUp" delay={500}>
                        <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-8">
                            <form onSubmit={handleSubmitSingle} className="space-y-8">
                                <div>
                                    <label className="block text-sm font-light text-warm-brown/70 mb-3">
                                        Question Text *
                                    </label>
                                    <Textarea
                                        value={questionData.text}
                                        onChange={(e) => setQuestionData(prev => ({ ...prev, text: e.target.value }))}
                                        placeholder="Enter your question here..."
                                        rows={4}
                                        className="w-full"
                                        required
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-sm font-light text-warm-brown/70 mb-3">
                                            Question Type *
                                        </label>
                                        <select
                                            value={questionData.type}
                                            onChange={(e) => setQuestionData(prev => ({ ...prev, type: e.target.value as QuestionType }))}
                                            className="w-full h-12 px-3 border border-warm-brown/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-warm-brown/20 focus:border-warm-brown/40 text-warm-brown"
                                            required
                                        >
                                            <option value="mcq">Multiple Choice</option>
                                            <option value="coding">Coding Challenge</option>
                                            <option value="descriptive">Descriptive</option>
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-light text-warm-brown/70 mb-3">
                                            Developer Role (Optional)
                                        </label>
                                        <select
                                            value={questionData.role || ""}
                                            onChange={(e) => setQuestionData(prev => ({ ...prev, role: e.target.value as DeveloperRole || undefined }))}
                                            className="w-full h-12 px-3 border border-warm-brown/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-warm-brown/20 focus:border-warm-brown/40 text-warm-brown"
                                        >
                                            <option value="">Select Role</option>
                                            <option value="python-backend">Python Backend</option>
                                            <option value="java-backend">Java Backend</option>
                                            <option value="node-backend">Node.js Backend</option>
                                            <option value="react-frontend">React Frontend</option>
                                            <option value="fullstack-js">Full Stack JavaScript</option>
                                            <option value="devops">DevOps</option>
                                            <option value="mobile-developer">Mobile Developer</option>
                                            <option value="data-scientist">Data Scientist</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-light text-warm-brown/70 mb-3">
                                        Tags (comma-separated)
                                    </label>
                                    <Input
                                        type="text"
                                        value={tagInput}
                                        onChange={(e) => {
                                            const el = e.target as HTMLInputElement
                                            const raw = el.value
                                            const { out } = sanitizeTagInput(raw)
                                            setTagInput(out)
                                        }}
                                        onBlur={() => {
                                            const deduped = commitTagsFromInput()
                                            setTagInput(deduped.join(","))
                                        }}
                                        onKeyDown={(e) => {
                                            // Convert Space key to a hyphen at the caret position to prevent spaces inside tags
                                            if (e.key === ' ') {
                                                e.preventDefault()
                                                const el = e.currentTarget as HTMLInputElement
                                                const start = el.selectionStart ?? 0
                                                const end = el.selectionEnd ?? 0
                                                const val = el.value
                                                const inserted = '-' + val.slice(end)
                                                const tentative = val.slice(0, start) + inserted
                                                // Sanitize tentative value and enforce per-tag length
                                                const { out, truncated } = sanitizeTagInput(tentative)
                                                // If truncation occurred for the tag being edited, block insertion (hard stop)
                                                if (truncated) {
                                                    setTagValidation('Tag maximum length is 100 characters.')
                                                    return
                                                }
                                                setTagInput(out)
                                                setTimeout(() => {
                                                    try { el.setSelectionRange(start + 1, start + 1) } catch (err) { }
                                                }, 0)
                                                return
                                            }
                                            if (e.key === 'Enter') {
                                                // Prevent form submit on Enter
                                                e.preventDefault()
                                                const next = (e.currentTarget as HTMLInputElement).value.replace(/,$/, '')
                                                const deduped = commitTagsFromInput(next)
                                                setTagInput(deduped.join(","))
                                            }
                                        }}
                                        onKeyUp={(e) => {
                                            if (e.key === ',') {
                                                // Let the comma be typed into the input, then commit.
                                                // We keep a trailing comma visible to avoid the flicker the user reported.
                                                const next = (e.currentTarget as HTMLInputElement).value.replace(/,$/, '')
                                                const deduped = commitTagsFromInput(next)
                                                setTagInput(deduped.join(",") + ',')
                                            }
                                        }}
                                        placeholder="algorithms, data-structures, complexity"
                                        className="h-12"
                                    />
                                    {tagValidation && (
                                        <div role="status" aria-live="polite" className="mt-1 text-xs text-rose-600">{tagValidation}</div>
                                    )}
                                </div>

                                {/* MCQ Options */}
                                {questionData.type === "mcq" && (
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <label className="block text-sm font-light text-warm-brown/70">
                                                Answer Options
                                            </label>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={addOption}
                                                className="text-xs"
                                                disabled={questionData.options && questionData.options.length >= 6}
                                            >
                                                + Add Option
                                            </Button>
                                        </div>

                                        {questionData.options?.map((option, index) => (
                                            <div key={option.id} className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-warm-brown/10 rounded-full flex items-center justify-center">
                                                    <span className="text-xs font-medium text-warm-brown">{option.id.toUpperCase()}</span>
                                                </div>
                                                <Input
                                                    type="text"
                                                    value={option.text}
                                                    onChange={(e) => updateOption(index, e.target.value)}
                                                    placeholder={`Option ${option.id.toUpperCase()}`}
                                                    className="flex-1 h-10"
                                                />
                                                {questionData.options && questionData.options.length > 2 && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        onClick={() => removeOption(index)}
                                                        className="text-red-500 hover:text-red-700 px-2"
                                                    >
                                                        ×
                                                    </Button>
                                                )}
                                            </div>
                                        ))}

                                        <div>
                                            <label className="block text-sm font-light text-warm-brown/70 mb-3">
                                                Correct Answer
                                            </label>
                                            <select
                                                value={questionData.correctAnswer || ""}
                                                onChange={(e) => setQuestionData(prev => ({ ...prev, correctAnswer: e.target.value }))}
                                                className="w-full h-12 px-3 border border-warm-brown/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-warm-brown/20 focus:border-warm-brown/40 text-warm-brown"
                                                required={questionData.type === "mcq"}
                                            >
                                                <option value="">Select correct answer</option>
                                                {questionData.options?.map((option) => (
                                                    <option key={option.id} value={option.id}>
                                                        Option {option.id.toUpperCase()}: {option.text}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {/* Coding Question Fields */}
                                {questionData.type === "coding" && (
                                    <div className="space-y-6">
                                        <div>
                                            <label className="block text-sm font-light text-warm-brown/70 mb-3">
                                                Programming Language
                                            </label>
                                            <select
                                                value={questionData.programmingLanguage || ""}
                                                onChange={(e) => setQuestionData(prev => ({ ...prev, programmingLanguage: e.target.value }))}
                                                className="w-full h-12 px-3 border border-warm-brown/20 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-warm-brown/20 focus:border-warm-brown/40 text-warm-brown"
                                            >
                                                <option value="">Select Language</option>
                                                <option value="python">Python</option>
                                                <option value="javascript">JavaScript</option>
                                                <option value="java">Java</option>
                                                <option value="cpp">C++</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-light text-warm-brown/70 mb-3">
                                                Starter Code (Optional)
                                            </label>
                                            <Textarea
                                                value={questionData.starterCode || ""}
                                                onChange={(e) => setQuestionData(prev => ({ ...prev, starterCode: e.target.value }))}
                                                placeholder="def solve(input):\n    # Your code here\n    pass"
                                                rows={6}
                                                className="w-full font-mono text-sm"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="flex justify-end pt-6">
                                    <Button
                                        type="submit"
                                        disabled={loading}
                                        size="lg"
                                        className="h-14 px-8"
                                    >
                                        {loading ? "Adding Question..." : "Add Question"}
                                    </Button>
                                </div>
                            </form>
                        </div>
                        {/* Session summary table moved to Bulk tab (so it's visible only when Bulk is active) */}
                    </AnimateOnScroll>
                )}

                {/* Bulk Upload Tab */}
                {activeTab === "bulk" && (
                    <AnimateOnScroll animation="fadeInUp" delay={500}>
                        <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-8">
                            <form onSubmit={handleBulkUpload} className="space-y-8">
                                <div>
                                    <label className="block text-sm font-light text-warm-brown/70 mb-6">
                                        Upload Questions File
                                    </label>

                                    <div className="border-2 border-dashed border-warm-brown/20 rounded-xl p-8 text-center hover:border-warm-brown/40 transition-colors">
                                        <input
                                            type="file"
                                            accept=".csv"
                                            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                                            className="hidden"
                                            id="file-upload"
                                        />
                                        <label htmlFor="file-upload" className="cursor-pointer">
                                            <div className="w-16 h-16 bg-warm-brown/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                                <svg className="w-8 h-8 text-warm-brown/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                                </svg>
                                            </div>
                                            <p className="text-warm-brown font-light mb-2">
                                                {uploadFile ? uploadFile.name : "Click to upload or drag and drop"}
                                            </p>
                                            <p className="text-xs text-warm-brown/60">
                                                Supports CSV files
                                            </p>
                                        </label>
                                    </div>
                                </div>

                                <div className="bg-warm-brown/5 rounded-xl p-6 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-medium text-warm-brown">File Format Guidelines</h3>
                                        <a
                                            href="/question-bulk-template.csv"
                                            download
                                            className="text-xs text-warm-brown/70 hover:text-warm-brown underline"
                                        >Download CSV Template</a>
                                    </div>
                                    <div className="text-xs text-warm-brown/70 font-light space-y-2">
                                        <p>Supported upload types: <span className="font-medium">CSV</span></p>
                                        <p className="font-medium">CSV Required Headers (lowercase):</p>
                                        <pre className="whitespace-pre-wrap bg-white/70 p-2 rounded border border-warm-brown/10 text-[10px] leading-relaxed">text,type,tags,options,correct_answer,starter_code,test_cases,programming_language,rubric</pre>
                                        <ul className="list-disc pl-4 space-y-1">
                                            <li><span className="font-medium">text</span>: Question text (required).</li>
                                            <li><span className="font-medium">type</span>: One of <code>mcq</code>, <code>coding</code>, <code>descriptive</code>.</li>
                                            <li><span className="font-medium">tags</span>: Comma-separated tags (optional).</li>
                                            <li><span className="font-medium">options</span>: For MCQ only. Pipe-delimited options (e.g. <code>Red|Green|Blue|Yellow</code>).</li>
                                            <li><span className="font-medium">correct_answer</span>: MCQ only. Single option id (a,b,c,d...).</li>
                                            <li><span className="font-medium">starter_code</span>: Coding only. Starter code snippet.</li>
                                            <li><span className="font-medium">test_cases</span>: Coding only. Pipe-delimited inputs or input:expected pairs.</li>
                                            <li><span className="font-medium">programming_language</span>: Coding only. Defaults to python if blank.</li>
                                            <li><span className="font-medium">rubric</span>: Descriptive only. Free-form evaluation notes.</li>
                                        </ul>
                                        <p className="pt-2">Unused columns are ignored. Leave irrelevant fields empty for each row.</p>
                                    </div>
                                </div>

                                <div className="flex justify-end">
                                    <Button
                                        type="submit"
                                        disabled={loading || !uploadFile}
                                        size="lg"
                                        className="h-14 px-8"
                                    >
                                        {loading ? "Uploading..." : "Upload Questions"}
                                    </Button>
                                </div>
                            </form>

                            {/* Selected session details (also show inside Bulk tab for review + confirm) */}
                            {selectedSession && (
                                <div className="mt-6">
                                    <h4 className="text-sm font-medium text-warm-brown mb-2">Session {selectedSession.session_id}</h4>
                                    <div className="max-h-64 overflow-auto border rounded p-2">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="text-xs text-warm-brown/60">
                                                    <th className="px-3 py-1">Text</th>
                                                    <th className="px-3 py-1">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {selectedSession.validated.map((r: BulkSessionRow, i: number) => (
                                                    <tr key={`v-bulk-${i}`} className="border-t border-warm-brown/5">
                                                        <td className="px-3 py-1 text-sm">{r.text}</td>
                                                        <td className="px-3 py-1 text-sm text-emerald-600">Validated</td>
                                                    </tr>
                                                ))}
                                                {selectedSession.flagged.map((r: BulkSessionRow, i: number) => (
                                                    <tr key={`f-bulk-${i}`} className="border-t border-warm-brown/5">
                                                        <td className="px-3 py-1 text-sm">{r.text}</td>
                                                        <td className="px-3 py-1 text-sm text-rose-600">Flagged{r.reason ? `: ${r.reason}` : ''}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <div className="mt-4 flex items-center gap-3">
                                        <Button size="sm" variant="destructive" onClick={() => handleConfirmImport(selectedSession.session_id)} disabled={importing}>
                                            {importing ? 'Importing...' : 'Confirm Import'}
                                        </Button>
                                        <Button size="sm" variant="ghost" onClick={() => { setSelectedSession(null); setImportResult(null); }}>
                                            Close
                                        </Button>
                                        {importResult && (
                                            <div className="ml-4 text-sm text-warm-brown">
                                                <div className="text-emerald-600">Imported: {importResult.imported_count}</div>
                                                <div className="text-rose-600">Failed: {importResult.failed_count}</div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </AnimateOnScroll>
                )}
            </div>

            {/* Phase 6: Duplicate warning modal */}
            {showDuplicateWarning && result && result.has_duplicates && (
                <DuplicateWarning
                    duplicates={result.duplicates}
                    onReuseExisting={(questionId) => {
                        console.log('Reusing existing question:', questionId)
                        setSuccess(`Question reused successfully! ID: ${questionId}`)
                        setShowDuplicateWarning(false)
                        resetDupCheck()
                        // Reset form
                        setQuestionData({
                            text: "",
                            type: "descriptive",
                            tags: [],
                            options: [],
                            correctAnswer: ""
                        })
                        setTagInput("")
                    }}
                    onAddAnyway={async () => {
                        setShowDuplicateWarning(false)
                        resetDupCheck()
                        // Proceed with submission bypassing duplicate check
                        setLoading(true)
                        try {
                            const adminToken = localStorage.getItem("adminToken")
                            const response = await fetch(buildApiUrl('/api/admin/questions'), {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    "Authorization": `Bearer ${adminToken}`
                                },
                                body: JSON.stringify({ ...questionData, bypass_duplicate_check: true }),
                            })
                            if (!response.ok) {
                                const errBody = await response.json().catch(() => ({ detail: 'Server error' }))
                                setError(errBody.detail || errBody.message || 'Failed to add question')
                                return
                            }
                            const data = await response.json()
                            if (data.success) {
                                setSuccess("Question added successfully!")
                                // Reset form
                                setQuestionData({
                                    text: "",
                                    type: "descriptive",
                                    tags: [],
                                    options: [],
                                    correctAnswer: ""
                                })
                                setTagInput("")
                            }
                        } catch (err) {
                            console.error(err)
                            setError("Failed to add question")
                        } finally {
                            setLoading(false)
                        }
                    }}
                    onCancel={() => {
                        setShowDuplicateWarning(false)
                        resetDupCheck()
                        setLoading(false)
                    }}
                />
            )}
        </div>
    )
}
