# Code Generation Instructions
- When generating commands to be executed in a termnial, ensure that the commands are compatible with Powershell on Windows.
- Powershell expects commands to be separated by semicolons, and environment variables to be set using `$env:VAR_NAME="value"`.
- Poweshell does not support `&&` for command chaining; use semicolons instead.
- Powershell does not support CURL natively; use `Invoke-RestMethod` or `Invoke-WebRequest` for HTTP requests.
- When generating file paths, use backslashes `\` for Windows paths.
- Whenever you intend to run commands such as running a PNPM server or a UV Server, ensure after starting the server, subsequent commands should be run in a new terminal session to prevent stopping the server.
- Avoid documentation unnecessarily. Only provide documentation if explicitly asked for.

# AI-Powered Technical Assessment Platform

This repository contains a comprehensive technical assessment platform built with Next.js 14 and FastAPI, featuring AI-powered evaluation and real-time proctoring capabilities.

**ALWAYS follow these instructions first and only fallback to additional search and context gathering if the information here is incomplete or found to be in error.**

## Repository Current State

### What This Repository Contains
This is a full-featured application with the following structure:
```
ci-mock/
├── .git/                 # Git repository data
├── .github/              # GitHub configuration
│   └── copilot-instructions.md  # This file
├── .gitignore           # Comprehensive gitignore
├── README.md            # Full project documentation
├── backend/             # Python FastAPI backend
│   ├── main.py          # FastAPI application entry point
│   ├── models.py        # Pydantic data models
│   ├── pyproject.toml   # UV package configuration
│   ├── Dockerfile       # Docker configuration
│   ├── routers/         # API route modules
│   │   ├── admin.py     # Admin endpoints
│   │   ├── candidate.py # Candidate assessment endpoints
│   │   └── utils.py     # Utility endpoints
│   └── uv.lock          # UV dependency lock file
└── frontend/            # Next.js 14 TypeScript frontend
    ├── package.json     # PNPM package configuration
    ├── next.config.ts   # Next.js configuration
    ├── tsconfig.json    # TypeScript configuration
    ├── src/             # Source code directory
    ├── public/          # Static assets
    └── pnpm-lock.yaml   # PNPM dependency lock file
```

### Repository Purpose
This repository is a production-ready technical assessment platform featuring:
- **Backend**: Python 3.12 with FastAPI, Motor (MongoDB), Azure integrations
- **Frontend**: Next.js 14 with TypeScript, Tailwind CSS, Monaco Editor
- **Features**: AI evaluation, code execution, real-time proctoring, admin dashboard

## Working Effectively

### Environment Setup
- **Python Version**: Python 3.12+ (specified in backend/.python-version)
- **Package Managers**: UV (backend), PNPM (frontend)
- **Repository Root**: `/home/runner/work/ci-mock/ci-mock`

### Development Setup Commands
To work with this full-stack application:

```bash
# Navigate to repository root
cd /home/runner/work/ci-mock/ci-mock

# Backend setup with UV
cd backend
uv sync                    # Install all dependencies from pyproject.toml
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Frontend setup with PNPM (in new terminal)
cd frontend
pnpm install              # Install all dependencies from package.json
pnpm dev                  # Start development server with Turbopack

# Docker option for backend
cd backend
docker build -t assessment-api .
docker run -p 8000:8000 assessment-api
```

**TIMING EXPECTATIONS:**
- `uv sync`: 30-90 seconds - Install backend dependencies (FastAPI, Motor, etc.)
- `pnpm install`: 60-120 seconds - Install frontend dependencies (Next.js, React, etc.)
- `pnpm dev`: 10-15 seconds startup - Next.js development server
- `uvicorn` startup: 2-3 seconds - FastAPI development server
- Docker build: 2-5 minutes - Complete backend container build

## Application Architecture & Technologies

### Backend (FastAPI)
**Core Technologies:**
- **FastAPI**: Modern Python web framework with automatic API documentation
- **Motor**: Async MongoDB driver for database operations  
- **Pydantic**: Data validation and serialization
- **Uvicorn**: ASGI server for running FastAPI applications
- **UV**: Modern Python package manager (replaces pip/poetry)

**Key Files:**
- `backend/main.py`: FastAPI application entry point with CORS and router setup
- `backend/models.py`: Pydantic models for data validation
- `backend/routers/`: API endpoint modules (admin, candidate, utils)
- `backend/pyproject.toml`: UV package configuration with all dependencies

**Database Integration:**
- Designed for Azure Cosmos DB (MongoDB API)
- Motor async driver for non-blocking database operations
- Mock connections for development

### Frontend (Next.js 14)
**Core Technologies:**
- **Next.js 14**: React framework with App Router and Turbopack
- **TypeScript**: Type-safe JavaScript development
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn/UI**: Modern React component library
- **Monaco Editor**: VS Code editor for code questions
- **Chart.js**: Data visualization for admin dashboard

**Key Files:**
- `frontend/src/`: Main source code directory
- `frontend/package.json`: PNPM dependencies and scripts
- `frontend/next.config.ts`: Next.js configuration
- `frontend/tsconfig.json`: TypeScript compiler configuration

### External Integrations
- **Azure OpenAI**: GPT-5 family (e.g., gpt-5-mini) for AI-powered evaluation
- **Judge0 API**: Code execution and testing
- **Azure Cosmos DB**: NoSQL database for assessments and results

## Development Workflow Commands

### Backend Development (FastAPI)
```bash
cd backend

# Install dependencies
uv sync

# Run development server with auto-reload
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Add new dependencies
uv add fastapi motor pydantic

# Run specific commands in UV environment
uv run python -c "import fastapi; print(fastapi.__version__)"

# Docker development
docker build -t assessment-api .
docker run -p 8000:8000 -e DATABASE_URL=mongodb://localhost:27017 assessment-api
```

### Frontend Development (Next.js)
```bash
cd frontend

# Install dependencies
pnpm install

# Run development server with Turbopack
pnpm dev

# Build for production
pnpm build

# Run production build locally
pnpm start

# Lint TypeScript and React code
pnpm lint

# Add new dependencies
pnpm add @monaco-editor/react
pnpm add -D @types/node
```

### Full-Stack Development
```bash
# Start both services simultaneously (use separate terminals)

# Terminal 1: Backend
cd backend && uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Frontend  
cd frontend && pnpm dev

# Access points:
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

## Working with Existing Codebase

### Understanding the API Structure
The backend follows a clean architecture pattern:

```python
# backend/main.py - FastAPI app setup
from fastapi import FastAPI
app = FastAPI(title="AI Technical Assessment Platform API")

# Router organization
from routers import candidate, admin, utils
app.include_router(candidate.router, prefix="/api/candidate")
app.include_router(admin.router, prefix="/api/admin") 
app.include_router(utils.router, prefix="/api/utils")
```

**Key API Endpoints:**
- `POST /api/candidate/login` - Validate assessment codes
- `GET /api/candidate/assessment/{test_id}` - Get questions
- `POST /api/admin/login` - Admin authentication
- `POST /api/utils/run-code` - Execute code via Judge0

### Working with the Frontend
The frontend uses Next.js 14 App Router structure:

```typescript
// Modern Next.js patterns in use:
- App Router (not Pages Router)
- TypeScript for type safety
- Tailwind CSS for styling
- Server and Client Components
- Monaco Editor for code editing
```

### Database Integration
```python
# backend/main.py - Database setup
from motor.motor_asyncio import AsyncIOMotorClient

# Designed for Azure Cosmos DB
# Currently uses mock connections for development
# Production will connect to MongoDB API
```

## Development Patterns and Guidelines

### Code Organization
**Backend Structure:**
```
backend/
├── main.py              # FastAPI app and CORS setup
├── models.py            # Pydantic models for validation
├── routers/             # Feature-based route organization
│   ├── admin.py         # Admin management endpoints
│   ├── candidate.py     # Assessment taking endpoints
│   └── utils.py         # Code execution and AI evaluation
└── pyproject.toml       # UV dependency management
```

**Frontend Structure:**
```
frontend/
├── src/                 # Next.js 14 App Router structure
├── package.json         # PNPM dependencies (React 19, Next.js 14)
├── next.config.ts       # Next.js configuration
└── tsconfig.json        # TypeScript configuration
```

### Key Technologies in Use
**Backend Dependencies (from pyproject.toml):**
- `fastapi>=0.116.1` - Modern Python web framework
- `motor>=3.7.1` - Async MongoDB driver
- `pydantic>=2.11.7` - Data validation
- `uvicorn>=0.35.0` - ASGI server
- `python-jose[cryptography]>=3.5.0` - JWT handling

**Frontend Dependencies (from package.json):**
- `next: 15.4.6` - React framework
- `react: 19.1.0` - Latest React version
- `@monaco-editor/react: ^4.7.0` - Code editor
- `tailwindcss: ^4` - Utility-first CSS
- `chart.js: ^4.5.0` - Data visualization

### Environment Configuration
**Development Environment Variables:**
```bash
# Backend (.env)
DATABASE_URL=mongodb://localhost:27017/assessment
AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your-judge0-key

# Frontend (.env.local)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Git Workflow for Full-Stack Development
```bash
# Check status across both directories
git status

# Common development workflow
cd backend && uv sync                    # Update backend deps
cd ../frontend && pnpm install          # Update frontend deps

# Test both services before committing
cd backend && uv run uvicorn main:app --host 0.0.0.0 --port 8000 &
cd frontend && pnpm build               # Verify frontend builds
curl http://localhost:8000/health       # Verify backend responds

# Commit changes
git add .
git commit -m "feat: add new assessment feature"
```

## Critical Reminders

### Working with Full-Stack Application
- **UNDERSTAND ARCHITECTURE**: This is a production application, not a toy project
- **USE CORRECT PACKAGE MANAGERS**: UV for backend, PNPM for frontend  
- **RESPECT EXISTING PATTERNS**: Follow FastAPI router structure and Next.js App Router
- **TEST BOTH LAYERS**: Ensure backend API and frontend build successfully

### Timing and Performance Expectations
- **Backend startup**: 2-3 seconds with `uvicorn --reload`
- **Frontend dev server**: 10-15 seconds with `pnpm dev` (Turbopack)
- **Full build**: 2-3 minutes for production builds
- **Docker build**: 3-5 minutes for complete backend container

### Common Workflows
- **API Development**: Work in `backend/routers/` with FastAPI patterns
- **UI Development**: Work in `frontend/src/` with Next.js 14 App Router
- **Database Changes**: Update `backend/models.py` for schema changes
- **Adding Dependencies**: Use `uv add` for backend, `pnpm add` for frontend

## Troubleshooting

### Backend Issues
- **Import Errors**: Ensure `uv sync` completed successfully
- **Port Conflicts**: Backend runs on :8000, frontend on :3000
- **Database Connection**: Check MongoDB connection string in development

### Frontend Issues  
- **Build Failures**: Check TypeScript errors with `pnpm lint`
- **Module Not Found**: Ensure `pnpm install` completed
- **API Connection**: Verify backend is running on port 8000

### Integration Issues
- **CORS Errors**: Check CORS middleware in `backend/main.py`
- **API Calls Failing**: Verify backend health at `/health` endpoint
- **Environment Variables**: Check both backend and frontend env files