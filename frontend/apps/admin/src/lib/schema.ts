// Minimal shared schema/types for the frontend UI components.

export enum QuestionType {
    MCQ = "mcq",
    DESCRIPTIVE = "descriptive",
    CODING = "coding",
}

export enum DeveloperRole {
    PYTHON_BACKEND = "python-backend",
    JAVA_BACKEND = "java-backend",
    NODE_BACKEND = "node-backend",
    REACT_FRONTEND = "react-frontend",
    FULLSTACK_JS = "fullstack-js",
    DEVOPS = "devops",
}

export enum ProgrammingLanguage {
    PYTHON = "python",
    JAVA = "java",
    JAVASCRIPT = "javascript",
    TYPESCRIPT = "typescript",
    CSHARP = "csharp",
    CPP = "cpp",
    HTML = "html",
    CSS = "css",
    BASH = "bash",
    YAML = "yaml",
}

export interface Question {
    _id?: string
    prompt: string
    type: QuestionType | string
    role: DeveloperRole | string
    language?: ProgrammingLanguage | string
    options?: string[]
    tags: string[]
    starter_code?: string
    show_preview?: boolean
    // other fields may exist on the backend
    [key: string]: unknown
}

export interface CodeSubmission {
    code: string
    timestamp: string
    output?: string
    error?: string
}

export interface Answer {
    questionId: string
    questionType: QuestionType | string
    submittedAnswer: string  // Changed from 'answer' to match backend, only string type
    timeSpent: number
    codeSubmissions?: CodeSubmission[]
}

export interface ProctoringEvent {
    timestamp: string
    eventType: string
    details?: Record<string, unknown>
}

export interface LoginRequest {
    loginCode: string  // Fixed: Changed from login_code to loginCode to match backend alias
}

export interface AdminLoginRequest {
    email: string
    password: string
}

export interface TestInitiationRequest {
    candidate_email: string
    developer_role: string
    question_ids?: string[]
    duration_hours: number
}

export interface DashboardStats {
    totalTests: number
    completedTests: number
    pendingTests: number
    averageScore: number
    [key: string]: unknown
}

export interface TestSummary {
    _id: string
    candidateEmail: string
    initiatedBy: string
    status: string
    createdAt: string
    overallScore?: number
    [key: string]: unknown
}
