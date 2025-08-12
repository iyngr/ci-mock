# CI Mock - Python Development Environment

CI Mock is a minimal Python repository designed for testing CI/CD workflows and GitHub Copilot agent functionality. This repository serves as a mock environment with a standard Python project structure.

**ALWAYS follow these instructions first and only fallback to additional search and context gathering if the information here is incomplete or found to be in error.**

## Working Effectively

### Environment Setup
- **Python Version**: Python 3.12.3 is available at `/usr/bin/python` and `/usr/bin/python3`
- **Package Manager**: pip 24.0 is pre-installed
- **Repository Root**: `/home/runner/work/ci-mock/ci-mock`

### Bootstrap and Setup Commands
Execute these commands to set up a complete Python development environment:

```bash
# Navigate to repository root
cd /home/runner/work/ci-mock/ci-mock

# Install essential Python development tools (NEVER CANCEL: Takes 10-60 seconds)
pip install pytest black flake8 mypy --quiet

# Create virtual environment (optional but recommended for new projects)
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows (if needed)
```

**TIMING EXPECTATIONS:**
- `pip install` commands: 10-60 seconds - NEVER CANCEL, set timeout to 120+ seconds
- Virtual environment creation: 3-5 seconds
- Python script execution: < 1 second for simple scripts
- Test execution: < 1 second for small test suites, set timeout to 30+ seconds for larger suites
- Code formatting (black): < 5 seconds
- Linting (flake8): < 5 seconds  
- Type checking (mypy): < 10 seconds

### Building and Testing

#### Create a Basic Python Project Structure
```bash
# Create basic project structure
mkdir -p src tests
touch src/__init__.py
touch tests/__init__.py

# Example: Create a simple module
echo "def add(a, b):
    return a + b

def multiply(a, b):
    return a * b" > src/calculator.py

# Example: Create corresponding tests
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

#### Run Tests
```bash
# Run all tests (NEVER CANCEL: Usually < 5 seconds, set timeout to 30+ seconds for larger test suites)
python -m pytest tests/ -v

# Run tests with coverage (if coverage is installed)
pip install coverage --quiet
coverage run -m pytest tests/
coverage report
```

#### Code Quality and Linting
**ALWAYS run these before committing changes:**

```bash
# Format code with black (< 5 seconds)
black src/ tests/

# Check code style with flake8 (< 5 seconds)
flake8 src/ tests/

# Type checking with mypy (< 10 seconds)
mypy src/

# Run all quality checks together
black src/ tests/ && flake8 src/ tests/ && mypy src/ && python -m pytest tests/ -v
```

### Manual Validation Scenarios

**CRITICAL**: Always perform these validation steps after making changes:

1. **Basic Python Functionality Test**:
   ```bash
   # Create and run a simple test script
   echo "print('Hello, CI Mock Environment!')" > validate_test.py
   python validate_test.py
   rm validate_test.py
   ```

2. **Package Installation Test**:
   ```bash
   # Test package installation works
   pip install requests --quiet
   python -c "import requests; print('Package installation successful')"
   ```

3. **Complete Development Workflow Test**:
   ```bash
   # Create, test, and validate a complete Python module
   mkdir -p temp_validation/tests
   echo "def hello_world(): return 'Hello, World!'" > temp_validation/main.py
   echo "def test_hello():
       def hello_world(): return 'Hello, World!'
       assert hello_world() == 'Hello, World!'" > temp_validation/tests/test_main.py
   cd temp_validation && python -m pytest tests/ -v
   cd .. && rm -rf temp_validation/
   ```

## Project Structure and Navigation

### Current Repository Contents
```
ci-mock/
├── .git/                 # Git repository data
├── .github/              # GitHub configuration and workflows
│   └── copilot-instructions.md  # This file
├── .gitignore           # Python-focused gitignore
└── README.md            # Basic project documentation
```

### Key Development Patterns
- **Source Code**: Place application code in `src/` directory
- **Tests**: Place test files in `tests/` directory matching `test_*.py` pattern
- **Configuration**: Use `pyproject.toml` or `setup.py` for package configuration
- **Dependencies**: List requirements in `requirements.txt` or use `pip freeze`

### Common Development Tasks

#### Adding New Dependencies
```bash
# Install and save dependencies
pip install package_name
pip freeze > requirements.txt  # Save current environment

# Install from requirements
pip install -r requirements.txt
```

#### Creating Package Configuration
```bash
# Create basic pyproject.toml
echo '[build-system]
requires = ["setuptools>=45", "wheel"]
build-backend = "setuptools.build_meta"

[project]
name = "ci-mock"
version = "0.1.0"
description = "Mock CI environment for testing"
requires-python = ">=3.12"' > pyproject.toml
```

#### Git Workflow Integration
```bash
# Always check status before committing
git status

# Stage and commit changes
git add .
git commit -m "Description of changes"

# Validate changes don't break anything
python -m pytest tests/ -v && black --check src/ tests/ && flake8 src/ tests/
```

## Critical Reminders

### Timing and Cancellation Rules
- **NEVER CANCEL** any package installation commands - they may take up to 60 seconds
- **NEVER CANCEL** test runs - even large test suites typically complete within 30 seconds
- **NEVER CANCEL** linting operations - they complete within 10 seconds
- Always set timeouts of 120+ seconds for pip commands and 30+ seconds for test commands

### Validation Requirements
- **ALWAYS test actual functionality** after making changes - don't just start/stop applications
- **ALWAYS run the complete linting suite** before considering work complete
- **ALWAYS verify that example code snippets work** by executing them
- **ALWAYS clean up temporary files** created during testing

### Common Validation Commands Summary
```bash
# Complete validation sequence (run this before any PR)
cd /home/runner/work/ci-mock/ci-mock
python -c "print('Python environment working')"
pip install pytest black flake8 mypy --quiet
echo "def test(): pass" > temp_test.py && python -m pytest temp_test.py -v && rm temp_test.py
echo "Code validation complete"
```

## Troubleshooting

### Python Environment Issues
- If `python` command fails, use `python3` explicitly
- If pip installation fails, try `python -m pip install` instead of `pip install`
- If virtual environment activation fails, check you're in the correct directory

### Test Execution Issues
- Ensure test files follow `test_*.py` naming convention
- Check that test functions start with `test_`
- Verify module imports use correct relative paths

### Package Installation Issues
- Use `--quiet` flag to reduce verbose output
- If packages fail to install, check for firewall/network restrictions
- Document any known installation failures in your changes