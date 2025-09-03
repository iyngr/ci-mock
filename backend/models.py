from datetime import datetime
from enum import Enum
from typing import List, Optional, Any, Dict, Union, Annotated, Literal
from pydantic import BaseModel, Field, ConfigDict, computed_field
import uuid


# ===========================
# COSMOS DB SPECIFIC MODELS
# ===========================

class CosmosDocument(BaseModel):
    """Base class for all Cosmos DB documents"""
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        extra="forbid"
    )
    
    # Azure Cosmos DB standard fields
    id: str = Field(default_factory=lambda: str(uuid.uuid4()), alias="_id", description="Document ID")
    etag: Optional[str] = Field(None, alias="_etag", description="Cosmos DB ETag for optimistic concurrency")
    ts: Optional[float] = Field(None, alias="_ts", description="Cosmos DB timestamp")
    
    @computed_field
    @property
    def partition_key(self) -> str:
        """Override in subclasses to define partition key"""
        return self.id


# ===========================
# ENUMS AND BASE TYPES
# ===========================

class UserRole(str, Enum):
    ADMIN = "admin"
    CANDIDATE = "candidate"


class DeveloperRole(str, Enum):
    """Role that the candidate is interviewing for"""
    PYTHON_BACKEND = "python-backend"
    JAVA_BACKEND = "java-backend"
    NODE_BACKEND = "node-backend"
    REACT_FRONTEND = "react-frontend"
    FULLSTACK_JS = "fullstack-js"
    DEVOPS = "devops"
    MOBILE_DEVELOPER = "mobile-developer"
    DATA_SCIENTIST = "data-scientist"


class SubmissionStatus(str, Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    COMPLETED_AUTO_SUBMITTED = "completed_auto_submitted"
    DISQUALIFIED = "disqualified"


class QuestionType(str, Enum):
    MCQ = "mcq"
    DESCRIPTIVE = "descriptive"
    CODING = "coding"


class ProgrammingLanguage(str, Enum):
    PYTHON = "python"
    JAVA = "java"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"


class ProctoringEventType(str, Enum):
    ATTENTION_LOST = "attention_lost"
    TAB_SWITCH = "tab_switch"
    COPY_PASTE_ATTEMPT = "copy_paste_attempt"
    FULLSCREEN_EXIT = "fullscreen_exit"
    WINDOW_RESIZE = "window_resize"


# ===========================
# USERS CONTAINER MODELS
# ===========================

class User(CosmosDocument):
    """User model for both admins and candidates"""
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_schema_extra={
            "example": {
                "id": "user-uuid-123",
                "name": "Jane Doe",
                "email": "jane.doe@example.com",
                "role": "candidate",
                "createdAt": "2025-08-30T09:00:00Z"
            }
        }
    )
    
    name: str = Field(..., description="Full name of the user")
    email: str = Field(..., description="Email address")
    role: UserRole = Field(..., description="User role: admin or candidate")
    developer_role: Optional[DeveloperRole] = Field(None, alias="developerRole", description="Role candidate is interviewing for (only for candidates)")
    created_at: datetime = Field(default_factory=datetime.utcnow, alias="createdAt")
    
    @computed_field
    @property
    def partition_key(self) -> str:
        """Partition by user role for efficient queries"""
        return self.role.value


class CreateUserRequest(BaseModel):
    """Request model for creating a new user"""
    name: str
    email: str
    role: UserRole
    developer_role: Optional[DeveloperRole] = Field(None, alias="developerRole", description="Required for candidates, optional for admins")


# ===========================
# ASSESSMENTS CONTAINER MODELS
# ===========================

class MCQOption(BaseModel):
    """Multiple choice question option"""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    text: str = Field(..., description="Option text")


class TestCase(BaseModel):
    """Test case for coding questions"""
    input: str = Field(..., description="Input for the test case")
    expected_output: str = Field(..., description="Expected output", alias="expectedOutput")


class Question(CosmosDocument):
    """Base question model with common fields"""
    type: QuestionType = Field(..., description="Type of question")
    text: str = Field(..., alias="prompt", description="Question text/prompt")
    skill: str = Field(..., description="Skill being tested")
    points: int = Field(default=1, description="Points for this question")
    difficulty: str = Field(default="medium", description="Question difficulty")
    tags: List[str] = Field(default_factory=list, description="Question tags")
    role: Optional[str] = Field(None, description="Target developer role")
    
    @computed_field
    @property
    def partition_key(self) -> str:
        """Partition by question type for efficient queries"""
        if hasattr(self.type, 'value'):
            return self.type.value
        return str(self.type)


class MCQQuestion(Question):
    """Multiple Choice Question model"""
    type: Literal["mcq"] = Field(default="mcq", description="Always MCQ type")
    options: Annotated[List[MCQOption], Field(min_length=2, max_length=6, description="2-6 answer options required")] = Field(..., description="List of answer options")
    correct_answer: str = Field(..., alias="correctAnswer", description="Correct answer option ID")


class DescriptiveQuestion(Question):
    """Descriptive/Essay Question model"""
    type: Literal["descriptive"] = Field(default="descriptive", description="Always descriptive type")
    max_words: Optional[Annotated[int, Field(gt=0, le=5000)]] = Field(None, alias="maxWords", description="Word limit (1-5000)")
    rubric: Optional[Annotated[str, Field(min_length=10, max_length=2000)]] = Field(None, description="Evaluation rubric (10-2000 chars)")


class CodingQuestion(Question):
    """Coding Question model"""
    type: Literal["coding"] = Field(default="coding", description="Always coding type")
    starter_code: Annotated[str, Field(min_length=1, max_length=10000)] = Field(..., alias="starter_code", description="Initial code template (1-10k chars)")
    test_cases: Annotated[List[TestCase], Field(min_length=1, max_length=20)] = Field(..., alias="testCases", description="1-20 test cases required")
    programming_language: ProgrammingLanguage = Field(..., alias="programmingLanguage", description="Required programming language")
    time_limit: Annotated[int, Field(gt=0, le=300)] = Field(default=30, alias="timeLimit", description="Execution time limit (1-300 seconds)")


# Union type for polymorphic questions - this is the key feature!
QuestionUnion = Annotated[
    Union[MCQQuestion, DescriptiveQuestion, CodingQuestion],
    Field(discriminator='type', description="Polymorphic question type")
]


class Assessment(CosmosDocument):
    """Assessment template model"""
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_schema_extra={
            "example": {
                "id": "assessment-uuid-1",
                "title": "Senior Frontend Developer Skill Test",
                "description": "An assessment covering advanced React, TypeScript, and performance concepts.",
                "duration": 60,
                "createdBy": "admin-user-uuid-1",
                "createdAt": "2025-08-31T10:00:00Z",
                "questions": []
            }
        }
    )
    
    title: Annotated[str, Field(min_length=3, max_length=200)] = Field(..., description="Assessment title (3-200 chars)")
    description: Annotated[str, Field(min_length=10, max_length=1000)] = Field(..., description="Assessment description (10-1000 chars)") 
    duration: Annotated[int, Field(gt=0, le=480)] = Field(..., description="Duration in minutes (1-480 max 8 hours)")
    target_role: Optional[DeveloperRole] = Field(None, alias="targetRole", description="Target developer role for this assessment")
    created_by: str = Field(..., alias="createdBy", description="User ID of the admin who created this")
    created_at: datetime = Field(default_factory=datetime.utcnow, alias="createdAt")
    questions: Annotated[List[QuestionUnion], Field(min_length=1, max_length=50)] = Field(default_factory=list, description="1-50 polymorphic questions")
    
    @computed_field
    @property
    def partition_key(self) -> str:
        """Partition by target role for efficient role-based queries"""
        return self.target_role.value if self.target_role else "general"


class CreateAssessmentRequest(BaseModel):
    """Request model for creating a new assessment"""
    title: str
    description: str
    duration: int
    target_role: Optional[DeveloperRole] = Field(None, alias="targetRole")
    questions: List[Question]


# ===========================
# SUBMISSIONS CONTAINER MODELS
# ===========================

class AnswerEvaluation(BaseModel):
    """Evaluation results for coding questions"""
    passed: bool = Field(..., description="Whether the code passed all test cases")
    output: Optional[str] = Field(None, description="Code execution output")
    error: Optional[str] = Field(None, description="Execution error if any")
    test_results: Optional[List[Dict[str, Any]]] = Field(None, alias="testResults", description="Individual test case results")


class Answer(BaseModel):
    """Individual answer within a submission"""
    question_id: str = Field(..., alias="questionId", description="ID of the question being answered")
    question_type: QuestionType = Field(..., alias="questionType", description="Type of the question")
    submitted_answer: str = Field(..., alias="submittedAnswer", description="The candidate's answer")
    time_spent: int = Field(..., alias="timeSpent", description="Time spent on this question in seconds")
    evaluation: Optional[AnswerEvaluation] = Field(None, description="Evaluation results for coding questions")


class ProctoringEvent(BaseModel):
    """Proctoring event during assessment"""
    timestamp: datetime = Field(..., description="When the event occurred")
    event_type: ProctoringEventType = Field(..., alias="eventType", description="Type of proctoring event")
    details: Optional[Dict[str, Any]] = Field(None, description="Additional event details")


class Submission(CosmosDocument):
    """Submission model for assessment results"""
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_schema_extra={
            "example": {
                "id": "submission-uuid-1",
                "assessmentId": "assessment-uuid-1",
                "candidateId": "candidate-user-uuid-1",
                "status": "completed",
                "startTime": "2025-09-01T14:00:00Z",
                "endTime": "2025-09-01T14:55:00Z",
                "score": 85.5,
                "answers": [],
                "proctoringEvents": [],
                "autoSubmitted": False,
                "violationCount": 2,
                "autoSubmitReason": None,
                "autoSubmitTimestamp": None
            }
        }
    )
    
    assessment_id: str = Field(..., alias="assessmentId", description="ID of the assessment template")
    candidate_id: str = Field(..., alias="candidateId", description="ID of the candidate user")
    status: SubmissionStatus = Field(..., description="Current status of the submission")
    start_time: datetime = Field(..., alias="startTime", description="When the assessment started")
    end_time: Optional[datetime] = Field(None, alias="endTime", description="When the assessment ended")
    expiration_time: datetime = Field(..., alias="expirationTime", description="Server-side expiration time")
    score: Optional[float] = Field(None, description="Overall score (0-100)")
    answers: List[Answer] = Field(default_factory=list, description="List of candidate answers")
    proctoring_events: List[ProctoringEvent] = Field(default_factory=list, alias="proctoringEvents", description="Proctoring events during assessment")
    
    # Proctoring violation tracking
    auto_submitted: bool = Field(default=False, alias="autoSubmitted", description="Whether test was auto-submitted due to violations")
    violation_count: int = Field(default=0, alias="violationCount", description="Total number of proctoring violations")
    auto_submit_reason: Optional[str] = Field(None, alias="autoSubmitReason", description="Reason for auto-submission (e.g., 'exceeded_violation_limit', 'suspicious_activity')")
    auto_submit_timestamp: Optional[datetime] = Field(None, alias="autoSubmitTimestamp", description="When auto-submission occurred")
    
    # Assessment session management
    login_code: str = Field(..., alias="loginCode", description="Unique code for candidate access")
    created_by: str = Field(..., alias="createdBy", description="Admin who initiated this assessment")
    
    @computed_field
    @property
    def partition_key(self) -> str:
        """Partition by assessment ID for efficient queries"""
        return self.assessment_id


class CreateSubmissionRequest(BaseModel):
    """Request model for creating a new submission (starting an assessment)"""
    assessment_id: str = Field(..., alias="assessmentId")
    candidate_email: str = Field(..., alias="candidateEmail")
    candidate_name: str = Field(..., alias="candidateName")
    duration_override: Optional[int] = Field(None, alias="durationOverride", description="Override assessment duration in minutes")


class UpdateSubmissionRequest(BaseModel):
    """Request model for updating submission answers"""
    answers: List[Answer]
    proctoring_events: Optional[List[ProctoringEvent]] = Field(None, alias="proctoringEvents")


# ===========================
# SCORING SYSTEM MODELS
# ===========================

class MCQScoreResult(BaseModel):
    """Result of MCQ direct validation"""
    question_id: str = Field(..., alias="questionId")
    correct: bool = Field(..., description="Whether the answer is correct")
    selected_option_id: str = Field(..., alias="selectedOptionId")
    correct_option_id: str = Field(..., alias="correctOptionId")
    points_awarded: float = Field(..., alias="pointsAwarded")


class LLMScoreResult(BaseModel):
    """Result of LLM-based scoring for descriptive/coding questions"""
    question_id: str = Field(..., alias="questionId")
    score: float = Field(..., description="Score from 0.0 to 1.0")
    feedback: Optional[str] = Field(None, description="AI-generated feedback")
    rubric_breakdown: Optional[Dict[str, float]] = Field(None, alias="rubricBreakdown")
    points_awarded: float = Field(..., alias="pointsAwarded")


class ScoringTriageRequest(BaseModel):
    """Request for hybrid scoring workflow"""
    submission_id: str = Field(..., alias="submissionId")


class ScoringTriageResponse(BaseModel):
    """Response from hybrid scoring workflow"""
    submission_id: str = Field(..., alias="submissionId")
    total_score: float = Field(..., alias="totalScore")
    max_possible_score: float = Field(..., alias="maxPossibleScore")
    percentage_score: float = Field(..., alias="percentageScore")
    mcq_results: List[MCQScoreResult] = Field(default_factory=list, alias="mcqResults")
    llm_results: List[LLMScoreResult] = Field(default_factory=list, alias="llmResults")
    evaluation_time: float = Field(..., alias="evaluationTime", description="Total evaluation time in seconds")
    cost_breakdown: Dict[str, Any] = Field(default_factory=dict, alias="costBreakdown")


class MCQValidationRequest(BaseModel):
    """Request for single MCQ validation"""
    question_id: str = Field(..., alias="questionId")
    selected_option_id: str = Field(..., alias="selectedOptionId")


class MCQBatchValidationRequest(BaseModel):
    """Request for batch MCQ validation"""
    mcq_answers: List[MCQValidationRequest] = Field(..., alias="mcqAnswers")


class MCQBatchValidationResponse(BaseModel):
    """Response for batch MCQ validation"""
    results: List[MCQScoreResult]
    total_correct: int = Field(..., alias="totalCorrect")
    total_questions: int = Field(..., alias="totalQuestions")


# ===========================
# API REQUEST/RESPONSE MODELS
# ===========================

class CodeExecutionRequest(BaseModel):
    """Request model for code execution"""
    language: str = Field(..., description="Programming language")
    code: str = Field(..., description="Code to execute")
    stdin: Optional[str] = Field("", description="Standard input for the code")


class CodeExecutionResponse(BaseModel):
    """Response model for code execution"""
    success: bool = Field(..., description="Whether execution was successful")
    output: Optional[str] = Field(None, description="Code execution output")
    error: Optional[str] = Field(None, description="Error message if execution failed")
    execution_time: float = Field(..., alias="executionTime", description="Execution time in seconds")


class EvaluationRequest(BaseModel):
    """Request model for AI evaluation"""
    submission_id: str = Field(..., alias="submissionId")


class EvaluationResponse(BaseModel):
    """Response model for AI evaluation"""
    success: bool = Field(..., description="Whether evaluation was successful")
    evaluation: Optional[Dict[str, Any]] = Field(None, description="Evaluation results")
    message: str = Field(..., description="Status message")


class LoginRequest(BaseModel):
    """Request model for candidate login"""
    login_code: str = Field(..., alias="loginCode", description="Assessment login code")


class LoginResponse(BaseModel):
    """Response model for candidate login"""
    success: bool = Field(..., description="Whether login was successful")
    submission_id: Optional[str] = Field(None, alias="submissionId", description="Submission ID if login successful")
    candidate_name: Optional[str] = Field(None, alias="candidateName", description="Candidate name")
    message: str = Field(..., description="Status message")


class AdminLoginRequest(BaseModel):
    """Request model for admin login"""
    email: str = Field(..., description="Admin email")
    password: str = Field(..., description="Admin password")


class AdminLoginResponse(BaseModel):
    """Response model for admin login"""
    success: bool = Field(..., description="Whether login was successful")
    admin_id: Optional[str] = Field(None, alias="adminId", description="Admin ID if login successful")
    token: Optional[str] = Field(None, description="JWT token for authentication")
    message: str = Field(..., description="Status message")


# ===========================
# DASHBOARD/ANALYTICS MODELS
# ===========================

class DashboardStats(BaseModel):
    """Dashboard statistics model"""
    total_assessments: int = Field(..., alias="totalAssessments")
    total_candidates: int = Field(..., alias="totalCandidates") 
    active_sessions: int = Field(..., alias="activeSessions")
    completion_rate: float = Field(..., alias="completionRate")
    average_score: float = Field(..., alias="averageScore")


class CandidateReport(BaseModel):
    """Individual candidate report model"""
    submission_id: str = Field(..., alias="submissionId")
    candidate_name: str = Field(..., alias="candidateName")
    candidate_email: str = Field(..., alias="candidateEmail")
    assessment_title: str = Field(..., alias="assessmentTitle")
    status: SubmissionStatus
    score: Optional[float]
    start_time: datetime = Field(..., alias="startTime")
    end_time: Optional[datetime] = Field(None, alias="endTime")
    duration_minutes: Optional[int] = Field(None, alias="durationMinutes")
    proctoring_flags: int = Field(..., alias="proctoringFlags", description="Number of proctoring violations")


# ===========================
# LEGACY COMPATIBILITY
# ===========================

class TestStatus(str, Enum):
    """Legacy enum - use SubmissionStatus instead"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress" 
    COMPLETED = "completed"
    EXPIRED = "expired"


class TestInitiationRequest(BaseModel):
    """Legacy request model for test initiation"""
    candidate_email: str
    question_ids: List[str]
    duration_hours: int = 2


class StartAssessmentRequest(BaseModel):
    """Request model for starting an assessment"""
    assessment_id: str
    candidate_id: str


class StartAssessmentResponse(BaseModel):
    """Response model for starting an assessment"""
    submission_id: str
    expiration_time: datetime = Field(..., alias="expirationTime")
    duration_minutes: int = Field(..., alias="durationMinutes")


class SubmissionRequest(BaseModel):
    """Legacy submission request model"""
    test_id: str
    answers: List[Answer]
    proctoring_events: List[ProctoringEvent] = Field(default_factory=list, alias="proctoringEvents")
    
    # Auto-submission tracking
    auto_submitted: bool = Field(default=False, alias="autoSubmitted", description="Whether test was auto-submitted due to violations")
    violation_count: int = Field(default=0, alias="violationCount", description="Total number of proctoring violations")
    auto_submit_reason: Optional[str] = Field(None, alias="autoSubmitReason", description="Reason for auto-submission")
    auto_submit_timestamp: Optional[datetime] = Field(None, alias="autoSubmitTimestamp", description="When auto-submission occurred")