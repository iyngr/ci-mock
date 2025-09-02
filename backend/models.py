from datetime import datetime
from enum import Enum
from typing import List, Optional, Any, Dict, Union, Annotated
from pydantic import BaseModel, Field, ConfigDict
from bson import ObjectId


class PyObjectId(ObjectId):
    @classmethod
    def __get_validators__(cls):
        yield cls.validate

    @classmethod
    def validate(cls, v):
        if not ObjectId.is_valid(v):
            raise ValueError("Invalid objectid")
        return ObjectId(v)

    @classmethod
    def __get_pydantic_json_schema__(cls, field_schema):
        field_schema.update(type="string")


class TestStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    EXPIRED = "expired"


class QuestionType(str, Enum):
    MCQ = "mcq"
    DESCRIPTIVE = "descriptive"
    CODING = "coding"


class DeveloperRole(str, Enum):
    PYTHON_BACKEND = "python-backend"
    JAVA_BACKEND = "java-backend"
    NODE_BACKEND = "node-backend"
    REACT_FRONTEND = "react-frontend"
    FULLSTACK_JS = "fullstack-js"
    DEVOPS = "devops"


class ProgrammingLanguage(str, Enum):
    PYTHON = "python"
    JAVA = "java"
    JAVASCRIPT = "javascript"
    TYPESCRIPT = "typescript"
    CSHARP = "csharp"
    CPP = "cpp"
    HTML = "html"
    CSS = "css"
    BASH = "bash"
    YAML = "yaml"


class Admin(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    email: str
    name: str
    hashed_password: str


class Question(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    type: QuestionType
    role: DeveloperRole
    language: Optional[ProgrammingLanguage] = None  # For coding questions
    prompt: str
    tags: List[str] = []
    options: Optional[List[str]] = None  # For MCQ questions
    correct_answer: Optional[Union[str, int]] = None  # For MCQ (index) or text answers
    starter_code: Optional[str] = None  # Initial code template for coding questions
    test_cases: Optional[List[Dict[str, Any]]] = None  # For coding questions
    evaluation_hints: Optional[str] = None  # For LLM evaluation
    show_preview: Optional[bool] = None  # Override role default for preview


class Test(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    candidate_email: str
    login_code: str
    role: DeveloperRole
    status: TestStatus = TestStatus.PENDING
    initiated_by: str  # Admin email
    created_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: datetime
    question_ids: List[str]


class ProctoringEvent(BaseModel):
    timestamp: datetime
    event_type: str  # "tab_switch", "fullscreen_exit", etc.
    details: Optional[Dict[str, Any]] = None


class Answer(BaseModel):
    question_id: str
    question_type: QuestionType
    answer: Union[str, int, List[str]]  # Flexible answer format
    time_spent: Optional[int] = None  # Time in seconds
    code_submissions: Optional[List[Dict[str, Any]]] = None  # For coding questions


class Submission(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    test_id: str
    candidate_email: str
    start_time: datetime = Field(default_factory=datetime.utcnow)
    expiration_time: datetime
    status: str = "in-progress"  # "in-progress", "completed", "completed_auto_submitted"
    answers: List[Answer] = []
    proctoring_events: List[ProctoringEvent] = []
    submitted_at: Optional[datetime] = None


class Result(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    submission_id: str
    test_id: str
    candidate_email: str
    started_at: datetime
    completed_at: datetime
    proctoring_events: List[ProctoringEvent] = []
    answers: List[Answer] = []
    overall_score: Optional[float] = None
    final_summary: Optional[str] = None  # AI-generated summary


# Request/Response models
class LoginRequest(BaseModel):
    login_code: str


class AdminLoginRequest(BaseModel):
    email: str
    password: str


class TestInitiationRequest(BaseModel):
    candidate_email: str
    question_ids: List[str]
    duration_hours: int = 2


class StartAssessmentRequest(BaseModel):
    assessment_id: str
    candidate_id: str


class StartAssessmentResponse(BaseModel):
    submission_id: str
    expiration_time: datetime
    duration_minutes: int


class UpdateSubmissionRequest(BaseModel):
    submission_id: str
    answers: List[Answer]
    proctoring_events: List[ProctoringEvent] = []


class SubmissionRequest(BaseModel):
    test_id: str
    answers: List[Answer]
    proctoring_events: List[ProctoringEvent] = []


class CodeExecutionRequest(BaseModel):
    language: str
    code: str
    stdin: Optional[str] = None


class EvaluationRequest(BaseModel):
    result_id: str