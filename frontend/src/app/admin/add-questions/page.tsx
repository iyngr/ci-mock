"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

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
    // MCQ specific
    options?: MCQOption[]
    correctAnswer?: string
    // Coding specific
    starterCode?: string
    testCases?: string[]
    programmingLanguage?: string
    timeLimit?: number
    // Descriptive specific
    maxWords?: number
    rubric?: string
}

interface ValidationResult {
    status: "unique" | "exact_duplicate" | "similar_duplicate"
    similar_questions?: any[]
}

interface BulkUploadSummary {
    totalQuestions: number
    newQuestions: number
    exactDuplicates: number
    similarDuplicates: number
    flaggedQuestions: any[]
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
    const [uploadSummary, setUploadSummary] = useState<BulkUploadSummary | null>(null)
    const [validationStep, setValidationStep] = useState<"upload" | "review" | "confirm">("upload")

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
            const nextId = String.fromCharCode(97 + (questionData.options?.length || 0)) // a, b, c, d, e, f
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
                options: prev.options?.filter((_, i) => i !== index),
                correctAnswer: prev.correctAnswer === prev.options?.[index]?.id ? "" : prev.correctAnswer
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
            const response = await fetch("http://localhost:8000/api/admin/questions/add-single", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${adminToken}`
                },
                body: JSON.stringify(questionData)
            })

            const result = await response.json()

            if (response.ok) {
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
                setError(result.detail || "Failed to add question")
            }
        } catch (err) {
            setError("Failed to connect to server")
        } finally {
            setLoading(false)
        }
    }

    const handleFileUpload = async (file: File) => {
        setLoading(true)
        setError("")
        setValidationStep("review")

        try {
            const adminToken = localStorage.getItem("adminToken")
            const formData = new FormData()
            formData.append("file", file)

            const response = await fetch("http://localhost:8000/api/admin/questions/bulk-validate", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${adminToken}`
                },
                body: formData
            })

            const result = await response.json()

            if (response.ok) {
                setUploadSummary(result)
            } else {
                setError(result.detail || "Failed to validate file")
                setValidationStep("upload")
            }
        } catch (err) {
            setError("Failed to connect to server")
            setValidationStep("upload")
        } finally {
            setLoading(false)
        }
    }

    const handleConfirmImport = async () => {
        setLoading(true)
        setError("")

        try {
            const adminToken = localStorage.getItem("adminToken")
            const response = await fetch("http://localhost:8000/api/admin/questions/bulk-confirm", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${adminToken}`
                }
            })

            const result = await response.json()

            if (response.ok) {
                setSuccess(`Successfully imported ${result.imported_count} questions!`)
                setValidationStep("upload")
                setUploadSummary(null)
                setUploadFile(null)
            } else {
                setError(result.detail || "Failed to import questions")
            }
        } catch (err) {
            setError("Failed to connect to server")
        } finally {
            setLoading(false)
        }
    }

    const downloadTemplate = () => {
        const csvContent = `type,text,tags,options,correct_answer,starter_code,test_cases,programming_language,time_limit,max_words,rubric
mcq,"What is the time complexity of binary search?","algorithms,complexity","a) O(n)|b) O(log n)|c) O(n²)|d) O(1)",b,,,,,,,
coding,"Implement a function to find the maximum element in an array","programming,arrays",,,"def find_max(arr):\n    # Your code here\n    pass","[1,2,3,4,5]->5|[10,5,8]->10",python,30,,,
descriptive,"Explain the difference between HTTP and HTTPS","networking,security",,,,,,,500,"Focus on security, encryption, and practical differences"`

        const blob = new Blob([csvContent], { type: "text/csv" })
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = "questions_template.csv"
        link.click()
        window.URL.revokeObjectURL(url)
    }

    return (
        <div className="min-h-screen assessment-bg">
            {/* Header */}
            <div className="assessment-card m-6">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex items-center">
                            <h1 className="text-lg font-semibold assessment-text-primary">
                                Add Questions
                            </h1>
                        </div>
                        <div className="flex items-center space-x-4">
                            <Button
                                onClick={() => router.push("/admin/dashboard")}
                                className="btn-assessment-secondary"
                            >
                                Back to Dashboard
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <div className="assessment-card p-6">
                    {/* Tab Navigation */}
                    <div className="flex space-x-1 border-b border-gray-200 mb-6">
                        <button
                            onClick={() => setActiveTab("single")}
                            className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors ${activeTab === "single"
                                ? "bg-blue-50 border-b-2 border-blue-500 text-blue-700"
                                : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            Add Single Question
                        </button>
                        <button
                            onClick={() => setActiveTab("bulk")}
                            className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-colors ${activeTab === "bulk"
                                ? "bg-blue-50 border-b-2 border-blue-500 text-blue-700"
                                : "text-gray-500 hover:text-gray-700"
                                }`}
                        >
                            Bulk Upload
                        </button>
                    </div>

                    {/* Error/Success Messages */}
                    {error && (
                        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}
                    {success && (
                        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-md">
                            <p className="text-sm text-green-600">{success}</p>
                        </div>
                    )}

                    {/* Single Question Tab */}
                    {activeTab === "single" && (
                        <form onSubmit={handleSubmitSingle} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Question Type *
                                    </label>
                                    <select
                                        value={questionData.type}
                                        onChange={(e) => setQuestionData(prev => ({ ...prev, type: e.target.value as QuestionType }))}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        required
                                    >
                                        <option value="mcq">Multiple Choice (MCQ)</option>
                                        <option value="coding">Coding</option>
                                        <option value="descriptive">Descriptive</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Skill Tags *
                                    </label>
                                    <Input
                                        value={questionData.tags.join(", ")}
                                        onChange={(e) => handleTagInput(e.target.value)}
                                        placeholder="e.g., algorithms, javascript, react"
                                        className="w-full"
                                        required
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Separate tags with commas</p>
                                </div>
                            </div>

                            {/* MCQ-specific fields */}
                            {questionData.type === "mcq" && (
                                <div className="space-y-4">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Answer Options *
                                    </label>
                                    {questionData.options?.map((option, index) => (
                                        <div key={option.id} className="flex items-center space-x-2">
                                            <span className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium">
                                                {option.id.toUpperCase()}
                                            </span>
                                            <Input
                                                value={option.text}
                                                onChange={(e) => updateOption(index, e.target.value)}
                                                placeholder={`Option ${option.id.toUpperCase()}`}
                                                className="flex-1"
                                                required
                                            />
                                            <input
                                                type="radio"
                                                name="correctAnswer"
                                                checked={questionData.correctAnswer === option.id}
                                                onChange={() => setQuestionData(prev => ({ ...prev, correctAnswer: option.id }))}
                                                className="text-blue-600"
                                                required
                                            />
                                            {(questionData.options?.length || 0) > 2 && (
                                                <Button
                                                    type="button"
                                                    onClick={() => removeOption(index)}
                                                    variant="outline"
                                                    size="sm"
                                                    className="text-red-600"
                                                >
                                                    ×
                                                </Button>
                                            )}
                                        </div>
                                    ))}
                                    {(questionData.options?.length || 0) < 6 && (
                                        <Button
                                            type="button"
                                            onClick={addOption}
                                            variant="outline"
                                            size="sm"
                                        >
                                            Add Option
                                        </Button>
                                    )}
                                </div>
                            )}

                            {/* Coding-specific fields */}
                            {questionData.type === "coding" && (
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Starter Code *
                                        </label>
                                        <Textarea
                                            value={questionData.starterCode || ""}
                                            onChange={(e) => setQuestionData(prev => ({ ...prev, starterCode: e.target.value }))}
                                            placeholder="def solution():\n    # Your code here\n    pass"
                                            rows={6}
                                            className="w-full font-mono"
                                            required
                                        />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Programming Language *
                                            </label>
                                            <select
                                                value={questionData.programmingLanguage || "python"}
                                                onChange={(e) => setQuestionData(prev => ({ ...prev, programmingLanguage: e.target.value }))}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                required
                                            >
                                                <option value="python">Python</option>
                                                <option value="java">Java</option>
                                                <option value="javascript">JavaScript</option>
                                                <option value="typescript">TypeScript</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Time Limit (seconds)
                                            </label>
                                            <Input
                                                type="number"
                                                value={questionData.timeLimit || 30}
                                                onChange={(e) => setQuestionData(prev => ({ ...prev, timeLimit: parseInt(e.target.value) }))}
                                                min={1}
                                                max={300}
                                                className="w-full"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Test Cases *
                                        </label>
                                        <Textarea
                                            value={questionData.testCases?.join("\n") || ""}
                                            onChange={(e) => setQuestionData(prev => ({ ...prev, testCases: e.target.value.split("\n").filter(line => line.trim()) }))}
                                            placeholder="input1 -> expected_output1\ninput2 -> expected_output2"
                                            rows={4}
                                            className="w-full font-mono"
                                            required
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            One test case per line, format: input {'->'} expected_output
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Descriptive-specific fields */}
                            {questionData.type === "descriptive" && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Max Words
                                        </label>
                                        <Input
                                            type="number"
                                            value={questionData.maxWords || ""}
                                            onChange={(e) => setQuestionData(prev => ({ ...prev, maxWords: parseInt(e.target.value) || undefined }))}
                                            min={1}
                                            max={5000}
                                            placeholder="500"
                                            className="w-full"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Evaluation Rubric
                                        </label>
                                        <Textarea
                                            value={questionData.rubric || ""}
                                            onChange={(e) => setQuestionData(prev => ({ ...prev, rubric: e.target.value }))}
                                            placeholder="Evaluation criteria for grading..."
                                            rows={3}
                                            className="w-full"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end space-x-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => router.push("/admin/dashboard")}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={loading}
                                    className="btn-assessment-primary"
                                >
                                    {loading ? "Adding Question..." : "Add Question"}
                                </Button>
                            </div>
                        </form>
                    )}

                    {/* Bulk Upload Tab */}
                    {activeTab === "bulk" && (
                        <div className="space-y-6">
                            {validationStep === "upload" && (
                                <div>
                                    <div className="mb-4">
                                        <Button
                                            onClick={downloadTemplate}
                                            variant="outline"
                                            className="mb-4"
                                        >
                                            📥 Download CSV Template
                                        </Button>
                                        <p className="text-sm text-gray-600">
                                            Download the template file to see the required format for bulk upload.
                                        </p>
                                    </div>

                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                                        <input
                                            type="file"
                                            accept=".csv"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0]
                                                setUploadFile(file || null)
                                            }}
                                            className="hidden"
                                            id="csvUpload"
                                        />
                                        <label
                                            htmlFor="csvUpload"
                                            className="cursor-pointer flex flex-col items-center space-y-2"
                                        >
                                            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center">
                                                <span className="text-2xl">📄</span>
                                            </div>
                                            <p className="text-lg font-medium text-gray-900">
                                                Upload CSV File
                                            </p>
                                            <p className="text-sm text-gray-500">
                                                Click to select your CSV file or drag and drop
                                            </p>
                                        </label>
                                    </div>

                                    {uploadFile && (
                                        <div className="mt-4 p-4 bg-blue-50 rounded-md">
                                            <p className="text-sm text-blue-800">
                                                Selected: {uploadFile.name}
                                            </p>
                                            <Button
                                                onClick={() => handleFileUpload(uploadFile)}
                                                disabled={loading}
                                                className="mt-2 btn-assessment-primary"
                                            >
                                                {loading ? "Validating..." : "Upload & Validate"}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {validationStep === "review" && uploadSummary && (
                                <div className="space-y-6">
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        Validation Summary
                                    </h3>

                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                        <div className="bg-blue-50 p-4 rounded-lg">
                                            <p className="text-sm text-blue-600">Total Questions</p>
                                            <p className="text-2xl font-bold text-blue-900">{uploadSummary.totalQuestions}</p>
                                        </div>
                                        <div className="bg-green-50 p-4 rounded-lg">
                                            <p className="text-sm text-green-600">New Questions</p>
                                            <p className="text-2xl font-bold text-green-900">{uploadSummary.newQuestions}</p>
                                        </div>
                                        <div className="bg-yellow-50 p-4 rounded-lg">
                                            <p className="text-sm text-yellow-600">Similar Found</p>
                                            <p className="text-2xl font-bold text-yellow-900">{uploadSummary.similarDuplicates}</p>
                                        </div>
                                        <div className="bg-red-50 p-4 rounded-lg">
                                            <p className="text-sm text-red-600">Exact Duplicates</p>
                                            <p className="text-2xl font-bold text-red-900">{uploadSummary.exactDuplicates}</p>
                                        </div>
                                    </div>

                                    {uploadSummary.flaggedQuestions.length > 0 && (
                                        <div>
                                            <h4 className="text-md font-semibold text-gray-900 mb-4">
                                                Similar Questions Found
                                            </h4>
                                            <div className="space-y-4 max-h-64 overflow-y-auto">
                                                {uploadSummary.flaggedQuestions.map((question, index) => (
                                                    <div key={index} className="border border-yellow-300 bg-yellow-50 p-4 rounded-md">
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {question.text}
                                                        </p>
                                                        <p className="text-xs text-gray-600 mt-1">
                                                            Similar to existing questions in the database
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex justify-end space-x-4">
                                        <Button
                                            onClick={() => {
                                                setValidationStep("upload")
                                                setUploadSummary(null)
                                                setUploadFile(null)
                                            }}
                                            variant="outline"
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleConfirmImport}
                                            disabled={loading || uploadSummary.newQuestions === 0}
                                            className="btn-assessment-primary"
                                        >
                                            {loading ? "Importing..." : `Confirm Import (${uploadSummary.newQuestions} questions)`}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
