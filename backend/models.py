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
    prompt: str
    tags: List[str] = []
    options: Optional[List[str]] = None  # For MCQ questions
    correct_answer: Optional[Union[str, int]] = None  # For MCQ (index) or text answers
    test_cases: Optional[List[Dict[str, Any]]] = None  # For coding questions
    evaluation_hints: Optional[str] = None  # For LLM evaluation


class Test(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    candidate_email: str
    login_code: str
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


class Result(BaseModel):
    model_config = ConfigDict(
        populate_by_name=True,
        arbitrary_types_allowed=True,
        json_encoders={ObjectId: str}
    )
    
    id: Optional[PyObjectId] = Field(default_factory=PyObjectId, alias="_id")
    test_id: str
    candidate_email: str
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
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