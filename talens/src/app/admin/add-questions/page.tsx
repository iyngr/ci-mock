"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"

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

export default function AddQuestions() {
    const [activeTab, setActiveTab] = useState<"single" | "bulk">("single")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState("")
    const [success, setSuccess] = useState("")
    const router = useRouter()

    // Single question form state
    const [questionData, setQuestionData] = useState<SingleQuestionData>({
        text: "",
        type: "mcq",
        tags: [],
        options: [
            { id: "a", text: "" },
            { id: "b", text: "" },
            { id: "c", text: "" },
            { id: "d", text: "" }
        ],
        correctAnswer: ""
    })

    // Bulk upload state
    const [uploadFile, setUploadFile] = useState<File | null>(null)

    useEffect(() => {
        // Check if admin is logged in
        const token = localStorage.getItem("adminToken")
        if (!token) {
            router.push("/admin")
        }
    }, [router])

    const handleTagInput = (value: string) => {
        const tags = value.split(",").map(tag => tag.trim()).filter(tag => tag.length > 0)
        setQuestionData(prev => ({ ...prev, tags }))
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

        try {
            const adminToken = localStorage.getItem("adminToken")

            // Mock API call - replace with actual endpoint
            const response = await fetch("http://localhost:8000/api/admin/questions", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${adminToken}`
                },
                body: JSON.stringify(questionData),
            })

            const data = await response.json()

            if (data.success) {
                setSuccess("Question added successfully!")
                // Reset form
                setQuestionData({
                    text: "",
                    type: "mcq",
                    tags: [],
                    options: [
                        { id: "a", text: "" },
                        { id: "b", text: "" },
                        { id: "c", text: "" },
                        { id: "d", text: "" }
                    ],
                    correctAnswer: ""
                })
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
            const response = await fetch("http://localhost:8000/api/admin/questions/bulk-validate", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${adminToken}`
                },
                body: formData,
            })

            const data = await response.json()

            if (data.success) {
                setSuccess(`Successfully uploaded ${data.questionsAdded} questions!`)
                setUploadFile(null)
            } else {
                setError(data.message || "Failed to upload questions")
            }
        } catch {
            setError("Failed to connect to server")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-warm-background">
            <div className="max-w-6xl mx-auto px-6 pt-24 pb-8">{/* Increased top padding to account for floating nav */}
                {/* Header */}
                <AnimateOnScroll animation="fadeInUp" delay={200}>
                    <div className="mb-12">
                        <Button
                            variant="ghost"
                            onClick={() => router.push("/admin/dashboard")}
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
                                ? "bg-warm-brown text-white shadow-lg"
                                : "text-warm-brown/60 hover:text-warm-brown hover:bg-warm-brown/5"
                                }`}
                        >
                            Single Question
                        </button>
                        <button
                            onClick={() => setActiveTab("bulk")}
                            className={`px-6 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${activeTab === "bulk"
                                ? "bg-warm-brown text-white shadow-lg"
                                : "text-warm-brown/60 hover:text-warm-brown hover:bg-warm-brown/5"
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
                                        value={questionData.tags.join(", ")}
                                        onChange={(e) => handleTagInput(e.target.value)}
                                        placeholder="algorithms, data-structures, complexity"
                                        className="h-12"
                                    />
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

                                {/* Descriptive Question Fields */}
                                {questionData.type === "descriptive" && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-light text-warm-brown/70 mb-3">
                                                Max Words (Optional)
                                            </label>
                                            <Input
                                                type="number"
                                                value={questionData.maxWords || ""}
                                                onChange={(e) => setQuestionData(prev => ({ ...prev, maxWords: parseInt(e.target.value) || undefined }))}
                                                placeholder="500"
                                                className="h-12"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-light text-warm-brown/70 mb-3">
                                                Time Limit (minutes)
                                            </label>
                                            <Input
                                                type="number"
                                                value={questionData.timeLimit || ""}
                                                onChange={(e) => setQuestionData(prev => ({ ...prev, timeLimit: parseInt(e.target.value) || undefined }))}
                                                placeholder="30"
                                                className="h-12"
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
                                            accept=".csv,.json,.xlsx"
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
                                                Supports CSV, JSON, and Excel files
                                            </p>
                                        </label>
                                    </div>
                                </div>

                                <div className="bg-warm-brown/5 rounded-xl p-6">
                                    <h3 className="text-sm font-medium text-warm-brown mb-3">File Format Guidelines</h3>
                                    <ul className="text-xs text-warm-brown/70 space-y-1 font-light">
                                        <li>• CSV: Include headers for question_text, type, tags, options (for MCQ)</li>
                                        <li>• JSON: Array of question objects with required fields</li>
                                        <li>• Excel: First row should contain column headers</li>
                                    </ul>
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
                        </div>
                    </AnimateOnScroll>
                )}
            </div>
        </div>
    )
}
