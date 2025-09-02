# AI-Powered Technical Assessment Platform

A comprehensive technical assessment platform built with Next.js 14 and FastAPI, featuring AI-powered evaluation, real-time proctoring, and **server-authoritative session management**.

## 🏗️ Architecture

- **Frontend**: Next.js 14 with TypeScript, Tailwind CSS, and Shadcn/UI
- **Backend**: Python 3.12 with FastAPI and Pydantic
- **Database**: Azure Cosmos DB (NoSQL API) with motor driver
- **Auto-Submit Service**: Azure Functions with timer triggers
- **LLM Integration**: Azure OpenAI Service (GPT-4o)
- **Code Execution**: Judge0 API
- **Package Management**: PNPM (frontend), UV (backend)

## 🚀 Features

### For Candidates
- ✅ Secure login with unique assessment codes
- ✅ Interactive instructions with fullscreen mode
- ✅ **Server-controlled assessment timing** (tamper-resistant)
- ✅ Multi-question type support (MCQ, Descriptive, Coding)
- ✅ Monaco Editor for coding questions with syntax highlighting
- ✅ Real-time code execution and testing
- ✅ Timer and navigation controls
- ✅ Proctoring features (fullscreen monitoring, tab switching detection)
- ✅ **Automatic submission on server-side expiry**

### For Administrators
- ✅ Secure admin authentication
- ✅ Dashboard with KPI metrics and charts
- ✅ Test initiation with question selection
- ✅ Real-time test monitoring
- ✅ Searchable test-taker table
- ✅ Detailed candidate reports
- ✅ AI-powered evaluation and scoring
- ✅ **Auto-submission monitoring and reporting**

### Security & Integrity
- 🔒 **Server-authoritative timing** - Backend controls all session lifecycle
- 🔒 **Auto-submission service** - Azure Function handles abandoned sessions
- 🔒 **Tamper-resistant** - Frontend cannot modify assessment duration
- 🔒 **Audit trail** - Complete session tracking and logging
- 🔒 **Time synchronization** - All timing based on server clock

## 📸 Screenshots

| Candidate Login | Assessment Instructions | Assessment Interface |
|----------------|------------------------|---------------------|
| ![Candidate Login](https://github.com/user-attachments/assets/7ba13b85-dd50-4d09-8059-9fdcbee79ee2) | ![Instructions](https://github.com/user-attachments/assets/c5424573-1a9b-49e6-8092-214f655c1a02) | ![MCQ Question](https://github.com/user-attachments/assets/9bb77899-e48b-4c2c-99dd-bd632649e82e) |

| Descriptive Question | Coding Question | Admin Dashboard |
|---------------------|-----------------|-----------------|
| ![Descriptive](https://github.com/user-attachments/assets/9250ce9b-7101-4003-9470-fdb317d2efdf) | ![Coding](https://github.com/user-attachments/assets/1d80f6a5-ab25-4134-a014-dfb75230ce55) | ![Dashboard](https://github.com/user-attachments/assets/admin-dashboard.png) |

| Test Initiation |
|----------------|
| ![Test Initiation](https://github.com/user-attachments/assets/admin-initiate-test.png) |

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+ and PNPM
- Python 3.12+
- UV package manager

### Backend Setup
```bash
cd backend
uv sync
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend Setup
```bash
cd frontend
pnpm install
pnpm dev
```

## 🧪 Demo Credentials

**Candidate Assessment:**
- Login Code: `TEST123`

**Admin Portal:**
- Email: `admin@example.com`
- Password: `admin123`

## 🚀 Deployment

### Auto-Submit Service Deployment
```bash
# Deploy auto-submit service
cd auto-submit
func azure functionapp publish func-assessment-autosubmit
```

### Backend Setup
```bash
cd backend
# Copy environment template and configure
cp .env.example .env
# Edit .env with your Judge0 API key and other settings

# Install dependencies and run
uv sync
uv run uvicorn main:app --reload
```

### Frontend (Vercel)
```bash
cd frontend
vercel --prod
```

## 📝 API Endpoints

### Candidate Routes (NEW: Server-Authoritative)
- `POST /api/candidate/login` - Validate login code
- `POST /api/candidate/assessment/start` - **NEW**: Start assessment session
- `GET /api/candidate/assessment/{test_id}` - Get assessment questions
- `POST /api/candidate/assessment/submit` - **NEW**: Submit with submission ID
- `POST /api/candidate/submit` - Legacy submit endpoint (deprecated)

### Admin Routes
- `POST /api/admin/login` - Admin authentication
- `GET /api/admin/dashboard` - Dashboard statistics
- `POST /api/admin/tests` - Create new test
- `GET /api/admin/report/{result_id}` - Detailed report

### Utility Routes
- `POST /api/utils/run-code` - Execute code via Judge0
- `POST /api/utils/evaluate` - AI-powered evaluation

### Azure Function (Auto-Submit Service)
- **Timer Trigger**: Runs every 5 minutes to auto-submit expired assessments
- **Database**: Queries Cosmos DB for expired in-progress submissions
- **Action**: Updates status to `completed_auto_submitted`

## 🔧 Configuration

### Environment Variables
```env
# Backend
DATABASE_URL=mongodb://localhost:27017/assessment
AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your-judge0-key

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000

# Azure Function Environment Variables
COSMOS_DB_ENDPOINT=https://your-cosmos.documents.azure.com:443/
COSMOS_DB_NAME=assessment-db
AI_SCORING_ENDPOINT=https://your-api.com/api/utils/evaluate
```

## 🔧 Server-Authoritative System

This platform implements a **server-authoritative assessment timing system** for enhanced security and integrity:

### Key Benefits
- **Tamper Resistance**: Assessment duration cannot be modified client-side
- **Automatic Cleanup**: Abandoned sessions are automatically closed
- **Audit Trail**: Complete session lifecycle tracking
- **Time Synchronization**: All timing decisions made by trusted server

### Architecture Flow
1. **Start Assessment**: Frontend calls `/api/candidate/assessment/start`
2. **Server Control**: Backend creates session with expiration time
3. **Timer Display**: Frontend shows countdown to server expiration
4. **Auto-Submit**: Azure Function auto-submits expired sessions
5. **Final Submission**: Uses submission ID instead of test ID

### Documentation
- [📖 Server-Authoritative System Documentation](./docs/server-authoritative-assessment.md)
- [🧪 Testing Guide](./docs/testing-guide.md)
- [🚀 Auto-Submit Service Deployment](./auto-submit/deployment.md)
- [⚡ Judge0 Setup Guide](./docs/judge0-setup.md)

## 🎯 Current Status

- ✅ **Task 1**: Project Setup & Database Schema
- ✅ **Task 2**: Candidate Assessment Module (Frontend)
- ✅ **Task 3**: Admin Portal Module (Frontend)
- ✅ **Task 4**: Backend Application (FastAPI) - Complete Implementation
- ✅ **Task 5**: Server-Authoritative Assessment System
- ✅ **Task 6**: Auto-Submit Azure Function
- ⏳ **Task 5**: Detailed Candidate Report Module
- ⏳ **Task 6**: Production Deployment

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.