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
    [key: string]: any
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
    answer: number | string
    timeSpent: number
    codeSubmissions?: CodeSubmission[]
}

export interface ProctoringEvent {
    timestamp: string
    eventType: string
    details?: Record<string, any>
}

export interface LoginRequest {
    login_code: string
}

export interface AdminLoginRequest {
    email: string
    password: string
}

export interface TestInitiationRequest {
    candidate_email: string
    question_ids: string[]
    duration_hours: number
}

export interface DashboardStats {
    totalTests: number
    completedTests: number
    pendingTests: number
    averageScore: number
    [key: string]: any
}

export interface TestSummary {
    _id: string
    candidateEmail: string
    initiatedBy: string
    status: string
    createdAt: string
    overallScore?: number
    [key: string]: any
}
