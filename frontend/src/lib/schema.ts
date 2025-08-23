// Minimal shared schema/types for the frontend UI components.

export enum QuestionType {
    MCQ = "mcq",
    DESCRIPTIVE = "descriptive",
    CODING = "coding",
}

export interface Question {
    _id?: string
    prompt: string
    type: QuestionType | string
    options?: string[]
    tags: string[]
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
