# AI-Powered Technical Assessment Platform

A comprehensive technical assessment platform built with Next.js 14 and FastAPI, featuring AI-powered evaluation and real-time proctoring.

## 🏗️ Architecture

- **Frontend**: Next.js 14 with TypeScript, Tailwind CSS, and Shadcn/UI
- **Backend**: Python 3.12 with FastAPI and Pydantic
- **Database**: Azure Cosmos DB (NoSQL API) with motor driver
- **LLM Integration**: Azure OpenAI Service (GPT-4o)
- **Code Execution**: Judge0 API
- **Package Management**: PNPM (frontend), UV (backend)

## 🚀 Features

### For Candidates
- ✅ Secure login with unique assessment codes
- ✅ Interactive instructions with fullscreen mode
- ✅ Multi-question type support (MCQ, Descriptive, Coding)
- ✅ Monaco Editor for coding questions with syntax highlighting
- ✅ Real-time code execution and testing
- ✅ Timer and navigation controls
- ✅ Proctoring features (fullscreen monitoring, tab switching detection)
- ✅ Auto-submission on time expiry

### For Administrators
- ✅ Secure admin authentication
- ✅ Dashboard with KPI metrics and charts
- ✅ Test initiation with question selection
- ✅ Real-time test monitoring
- ✅ Searchable test-taker table
- ✅ Detailed candidate reports
- ✅ AI-powered evaluation and scoring

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

### Backend (Docker)
```bash
cd backend
docker build -t assessment-api .
docker run -p 8000:8000 assessment-api
```

### Frontend (Vercel)
```bash
cd frontend
vercel --prod
```

## 📝 API Endpoints

### Candidate Routes
- `POST /api/candidate/login` - Validate login code
- `GET /api/candidate/assessment/{test_id}` - Get assessment questions
- `POST /api/candidate/submit` - Submit assessment answers

### Admin Routes
- `POST /api/admin/login` - Admin authentication
- `GET /api/admin/dashboard` - Dashboard statistics
- `POST /api/admin/tests` - Create new test
- `GET /api/admin/report/{result_id}` - Detailed report

### Utility Routes
- `POST /api/utils/run-code` - Execute code via Judge0
- `POST /api/utils/evaluate` - AI-powered evaluation

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
```

## 🎯 Current Status

- ✅ **Task 1**: Project Setup & Database Schema
- ✅ **Task 2**: Candidate Assessment Module (Frontend)
- ✅ **Task 3**: Admin Portal Module (Frontend)
- ✅ **Task 4**: Backend Application (FastAPI) - Basic Implementation
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