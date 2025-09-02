# Updated Data Model with Developer Roles

## ✅ **Your Data Model Implementation**

You're absolutely correct about needing `DeveloperRole`! Here's how the updated models support your assessment platform:

### **Complete Role System**

```python
# Two different types of roles:

class UserRole(str, Enum):
    """System access role"""
    ADMIN = "admin"        # Can create assessments, view reports
    CANDIDATE = "candidate" # Can take assessments

class DeveloperRole(str, Enum):
    """Interview position role"""
    PYTHON_BACKEND = "python-backend"
    JAVA_BACKEND = "java-backend"
    NODE_BACKEND = "node-backend"
    REACT_FRONTEND = "react-frontend"
    FULLSTACK_JS = "fullstack-js"
    DEVOPS = "devops"
    MOBILE_DEVELOPER = "mobile-developer"
    DATA_SCIENTIST = "data-scientist"
```

### **Updated Models with Developer Roles**

## **1. Users Container**

```json
{
    "id": "candidate-uuid-123",
    "name": "John Smith",
    "email": "john.smith@example.com",
    "role": "candidate",              // UserRole: System permission
    "developerRole": "react-frontend", // DeveloperRole: What they're interviewing for
    "createdAt": "2025-09-01T10:00:00Z"
}

{
    "id": "admin-uuid-456", 
    "name": "HR Manager",
    "email": "hr@company.com",
    "role": "admin",                  // UserRole: System permission
    "developerRole": null,            // Not applicable for admins
    "createdAt": "2025-08-30T09:00:00Z"
}
```

## **2. Assessments Container (Role-Specific)**

```json
{
    "id": "assessment-uuid-1",
    "title": "Senior React Developer Assessment",
    "description": "Advanced React, TypeScript, and performance optimization.",
    "duration": 90,
    "targetRole": "react-frontend",   // DeveloperRole: Assessment is for React devs
    "createdBy": "admin-uuid-456",
    "createdAt": "2025-09-01T08:00:00Z",
    "questions": [
        {
            "id": "q1",
            "type": "coding",
            "text": "Implement a custom React hook for data fetching",
            "skill": "React Hooks",
            "programmingLanguage": "javascript",
            "starterCode": "function useApi(url) {\n  // Your implementation\n}"
        },
        {
            "id": "q2", 
            "type": "mcq",
            "text": "What is the purpose of React.memo()?",
            "skill": "Performance Optimization",
            "options": [
                {"id": "opt1", "text": "Memoize component renders"},
                {"id": "opt2", "text": "Manage component state"}
            ],
            "correctAnswer": "opt1"
        }
    ]
}
```

## **3. Submissions Container**

```json
{
    "id": "submission-uuid-1",
    "assessmentId": "assessment-uuid-1",
    "candidateId": "candidate-uuid-123",
    "status": "completed",
    "startTime": "2025-09-01T14:00:00Z",
    "endTime": "2025-09-01T15:25:00Z",
    "expirationTime": "2025-09-01T15:30:00Z",
    "score": 88.5,
    "loginCode": "ABC123DEF",
    "createdBy": "admin-uuid-456",
    "answers": [
        {
            "questionId": "q1",
            "submittedAnswer": "function useApi(url) {\n  const [data, setData] = useState(null);\n  // ... implementation\n}",
            "evaluation": {
                "passed": true,
                "output": "Hook works correctly"
            }
        },
        {
            "questionId": "q2",
            "submittedAnswer": "opt1"
        }
    ],
    "proctoringEvents": [
        {
            "timestamp": "2025-09-01T14:15:00Z",
            "eventType": "tab_switch",
            "details": {"url": "stackoverflow.com"}
        }
    ]
}
```

## **🎯 How Developer Roles Work in Practice**

### **1. Assessment Creation Flow**
```python
# Admin creates role-specific assessment
assessment = Assessment(
    title="Senior Python Backend Developer Test",
    target_role=DeveloperRole.PYTHON_BACKEND,  # Questions tailored for Python devs
    questions=[
        # Python-specific coding questions
        # Backend architecture questions
        # Database optimization questions
    ]
)
```

### **2. Candidate Assignment Flow**
```python
# Admin initiates assessment for specific candidate
submission = Submission(
    assessment_id="python-backend-assessment",
    candidate_id="candidate-with-python-role",  # Candidate's developerRole should match
    login_code="XYZ789"
)
```

### **3. Question Filtering by Role**
```python
# Questions can be filtered/selected based on target role
python_questions = [q for q in questions if q.skill in ["Python", "Django", "FastAPI"]]
react_questions = [q for q in questions if q.skill in ["React", "TypeScript", "CSS"]]
```

## **🔄 Cosmos DB Schema Handling**

### **How Cosmos DB Works with Your Models**

1. **No Schema Definition Required**: Cosmos DB stores JSON documents directly
2. **Application-Level Validation**: Pydantic models validate data on read/write
3. **Runtime Type Safety**: Python backend ensures data integrity
4. **Frontend Type Safety**: TypeScript interfaces mirror the Pydantic models

### **Example Data Flow**

```python
# 1. Create candidate (Backend validates with Pydantic)
user_data = {
    "name": "Alice Johnson",
    "email": "alice@example.com", 
    "role": "candidate",
    "developerRole": "react-frontend"
}
user = User(**user_data)  # Pydantic validation
await users_collection.insert_one(user.model_dump(by_alias=True))

# 2. Cosmos DB stores as JSON (no schema required)
# 3. Read back and validate
doc = await users_collection.find_one({"email": "alice@example.com"})
user = User(**doc)  # Pydantic parsing and validation
```

## **📊 Benefits of This Model**

### ✅ **Role-Based Assessment Matching**
- Assessments can be targeted to specific developer roles
- Questions automatically filtered by skill relevance
- Scoring can be role-specific

### ✅ **Flexible User Management**
- Candidates have both system role (candidate) AND developer role (react-frontend)
- Admins only need system role
- Easy to query: "Find all React Frontend candidates"

### ✅ **Analytics and Reporting**
```python
# Get performance by developer role
react_candidates = await submissions.find({"candidateRole": "react-frontend"})
python_candidates = await submissions.find({"candidateRole": "python-backend"})

# Role-specific insights
average_react_score = calculate_average([s.score for s in react_candidates])
```

### ✅ **Assessment Customization**
- Create different assessments for different roles
- Reuse questions across multiple role-specific assessments
- Track which roles perform better on which skills

## **🎯 Next Steps**

Your data model is now complete with:
- ✅ **Users Container**: UserRole + DeveloperRole support
- ✅ **Assessments Container**: Role-specific assessments  
- ✅ **Submissions Container**: Full tracking with role context
- ✅ **Cosmos DB Ready**: No schema definition needed
- ✅ **Type Safety**: Pydantic + TypeScript validation

The developer role is essential for your assessment platform - it enables role-specific testing, better candidate matching, and detailed analytics by position type!
