# CI Mock - Minimal Python Repository

CI Mock is a minimal Python repository designed for testing CI/CD workflows and GitHub Copilot agent functionality. This is an **empty starter repository** that serves as a clean testing environment.

**ALWAYS follow these instructions first and only fallback to additional search and context gathering if the information here is incomplete or found to be in error.**

## Repository Current State

### What This Repository Contains
The repository is currently minimal and contains only:
```
ci-mock/
├── .git/                 # Git repository data
├── .github/              # GitHub configuration
│   └── copilot-instructions.md  # This file
├── .gitignore           # Comprehensive Python gitignore
└── README.md            # Basic project documentation (just "# ci-mock")
```

**There is NO existing source code, NO src/ directory, NO tests, NO Python modules, NO package configuration.**

### Repository Purpose
This repository serves as a clean testing environment for:
- Testing CI/CD workflows with Python projects
- GitHub Copilot agent functionality validation
- Mock development environment setup
- Clean slate experimentation

## Working Effectively

### Environment Setup
- **Python Version**: Python 3.12.3 is available at `/usr/bin/python` and `/usr/bin/python3`
- **Package Manager**: pip 24.0 is pre-installed
- **Repository Root**: `/home/runner/work/ci-mock/ci-mock`

### Bootstrap Commands for Starting from Scratch
Since this is an empty repository, you'll need to create everything from scratch:

```bash
# Navigate to repository root
cd /home/runner/work/ci-mock/ci-mock

# Install essential Python development tools (NEVER CANCEL: Takes 10-60 seconds)
pip install pytest black flake8 mypy --quiet

# Create virtual environment (recommended for any development)
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows (if needed)
```

**TIMING EXPECTATIONS:**
- `pip install` commands: 10-60 seconds - NEVER CANCEL, set timeout to 120+ seconds
- Virtual environment creation: 3-5 seconds
- Python script execution: < 1 second for simple scripts
- Test execution: < 1 second for small test suites
- Code formatting (black): < 5 seconds
- Linting (flake8): < 5 seconds  
- Type checking (mypy): < 10 seconds

## Creating a Python Project from Scratch

### Basic Project Structure Setup
Create a standard Python project structure:

```bash
# Create basic project directories
mkdir -p src tests docs
touch src/__init__.py
touch tests/__init__.py

# Create a simple example module
echo "def add(a, b):
    \"\"\"Add two numbers.\"\"\"
    return a + b

def multiply(a, b):
    \"\"\"Multiply two numbers.\"\"\"
    return a * b" > src/calculator.py

# Create corresponding tests
echo "import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from calculator import add, multiply

def test_add():
    assert add(2, 3) == 5
    assert add(-1, 1) == 0

def test_multiply():
    assert multiply(3, 4) == 12
    assert multiply(0, 5) == 0" > tests/test_calculator.py
```

### Project Configuration
Create basic project configuration files:

```bash
# Create pyproject.toml for modern Python packaging
echo '[build-system]
requires = ["setuptools>=45", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "ci-mock"
version = "0.1.0"
description = "Mock CI environment for testing"
requires-python = ">=3.12"
dependencies = []

[project.optional-dependencies]
dev = ["pytest", "black", "flake8", "mypy"]

[tool.black]
line-length = 88

[tool.pytest.ini_options]
testpaths = ["tests"]' > pyproject.toml

# Create requirements files
echo "# Production dependencies
# (none currently)" > requirements.txt

echo "# Development dependencies
pytest>=7.0.0
black>=22.0.0
flake8>=4.0.0
mypy>=0.910" > requirements-dev.txt
```

### Development Workflow Commands

#### Testing (after creating tests)
```bash
# Run tests (only works after creating test files)
python -m pytest tests/ -v

# Run tests with coverage
pip install coverage --quiet
coverage run -m pytest tests/
coverage report
```

#### Code Quality (after creating source files)
```bash
# Format code with black
black src/ tests/

# Check code style with flake8  
flake8 src/ tests/

# Type checking with mypy
mypy src/

# Run all quality checks together
black src/ tests/ && flake8 src/ tests/ && mypy src/ && python -m pytest tests/ -v
```

### Quick Validation Workflows

#### 1. Basic Python Environment Test
```bash
# Test Python is working
echo "print('Hello, CI Mock Environment!')" > validate_test.py
python validate_test.py
rm validate_test.py
```

#### 2. Package Installation Test
```bash
# Test package installation capability
pip install requests --quiet
python -c "import requests; print('Package installation successful')"
```

#### 3. Complete Development Workflow Test
```bash
# Create and test a complete mini-project
mkdir -p /tmp/test_project
echo "def hello(): return 'Hello World'" > /tmp/test_project/main.py
echo "
import sys
sys.path.append('/tmp/test_project')
from main import hello

def test_hello():
    assert hello() == 'Hello World'
" > /tmp/test_project/test_main.py

cd /tmp/test_project && python -m pytest test_main.py -v
cd /home/runner/work/ci-mock/ci-mock
rm -rf /tmp/test_project
```

## Development Patterns and Guidelines

### Recommended Directory Structure
When building out the project, follow this structure:
```
ci-mock/
├── src/                  # Source code
│   ├── __init__.py
│   └── [modules].py
├── tests/                # Test files
│   ├── __init__.py
│   └── test_[modules].py
├── docs/                 # Documentation
├── .github/              # GitHub workflows/configs
├── .gitignore           # Git ignore rules
├── README.md            # Project documentation
├── pyproject.toml       # Project configuration
├── requirements.txt     # Production dependencies
└── requirements-dev.txt # Development dependencies
```

### Git Workflow
```bash
# Check status before making changes
git status

# Add and commit changes
git add .
git commit -m "Descriptive commit message"

# Before committing, validate everything works
python -c "print('Basic Python check')"
```

## Critical Reminders

### Working with Empty Repository
- **START FROM SCRATCH**: Don't assume any existing code or directories exist
- **CREATE STRUCTURE FIRST**: Set up directories and files before running tools
- **VALIDATE INCREMENTALLY**: Test each piece as you build it

### Timing and Cancellation Rules
- **NEVER CANCEL** pip install commands - they take 10-60 seconds
- **NEVER CANCEL** test runs - they complete quickly but need time
- Always set timeout to 120+ seconds for pip commands

### Common Gotchas
- Don't run `pytest` before creating test files - it will fail
- Don't run `black` or `flake8` on non-existent directories
- Don't assume imports work before creating the modules
- Always check if files/directories exist before referencing them

## Troubleshooting

### "No tests ran" or "No Python files found"
- This is expected in the empty repository
- Create test files first using the examples above

### "ModuleNotFoundError" 
- Modules don't exist yet in this empty repository
- Create source files first, then import them

### Command failures
- Many development commands will fail until you create the appropriate files
- Build the project structure incrementally and test at each step