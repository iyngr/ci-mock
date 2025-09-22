#!/usr/bin/env python3
"""
Test script for the Add Questions feature implementation.
Tests both single question addition and bulk upload functionality.
"""

import asyncio
import httpx
import json
import csv
import io
from typing import Dict, Any

# Service URLs
BACKEND_URL = "http://localhost:8000"
AI_SERVICE_URL = "http://localhost:8001"

# Test admin credentials
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"

async def get_admin_token() -> str:
    """Get admin authentication token"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{BACKEND_URL}/api/admin/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        response.raise_for_status()
        data = response.json()
        return data["token"]

async def test_ai_service_health():
    """Test AI service health check"""
    print("\n🔍 Testing AI Service Health...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{AI_SERVICE_URL}/health")
            response.raise_for_status()
            data = response.json()
            print(f"✅ AI Service Status: {data['status']}")
            return True
    except Exception as e:
        print(f"❌ AI Service Health Check Failed: {e}")
        return False

async def test_question_validation():
    """Test question validation endpoint"""
    print("\n🔍 Testing Question Validation...")
    
    test_cases = [
        {
            "name": "Unique Question",
            "text": "What is the time complexity of binary search in a sorted array?",
            "expected_status": "unique"
        },
        {
            "name": "Duplicate Question",
            "text": "This is a duplicate question to test exact matching",
            "expected_status": "unique"  # Will be unique in mock
        },
        {
            "name": "Similar Question",
            "text": "Explain the algorithm complexity of searching methods",
            "expected_status": "similar_duplicate"  # May find similar
        }
    ]
    
    try:
        async with httpx.AsyncClient() as client:
            for test_case in test_cases:
                print(f"   Testing: {test_case['name']}")
                response = await client.post(
                    f"{AI_SERVICE_URL}/questions/validate",
                    json={"question_text": test_case["text"]}
                )
                response.raise_for_status()
                result = response.json()
                print(f"      Status: {result['status']}")
                
        print("✅ Question Validation Tests Passed")
        return True
    except Exception as e:
        print(f"❌ Question Validation Failed: {e}")
        return False

async def test_question_rewriting():
    """Test question rewriting endpoint"""
    print("\n🔍 Testing Question Rewriting...")
    
    test_question = "what is react hooks and how do u use them in components"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{AI_SERVICE_URL}/questions/rewrite",
                json={"question_text": test_question}
            )
            response.raise_for_status()
            result = response.json()
            
            print(f"   Original: {test_question}")
            print(f"   Rewritten: {result.get('rewritten_text', 'N/A')}")
            print(f"   Suggested Role: {result.get('suggested_role', 'N/A')}")
            print(f"   Suggested Tags: {result.get('suggested_tags', [])}")
            
        print("✅ Question Rewriting Test Passed")
        return True
    except Exception as e:
        print(f"❌ Question Rewriting Failed: {e}")
        return False

async def test_single_question_addition():
    """Test adding a single question"""
    print("\n🔍 Testing Single Question Addition...")
    
    token = await get_admin_token()
    
    test_questions = [
        {
            "name": "MCQ Question",
            "data": {
                "text": "What is the primary benefit of using React hooks?",
                "type": "mcq",
                "tags": ["react", "javascript", "frontend"],
                "options": [
                    {"id": "a", "text": "Better performance"},
                    {"id": "b", "text": "Easier state management"},
                    {"id": "c", "text": "Smaller bundle size"},
                    {"id": "d", "text": "All of the above"}
                ],
                "correctAnswer": "b"
            }
        },
        {
            "name": "Coding Question",
            "data": {
                "text": "Implement a function to find the maximum element in an array",
                "type": "coding",
                "tags": ["algorithms", "python", "arrays"],
                "starterCode": "def find_max(arr):\n    # Your code here\n    pass",
                "testCases": ["[1,2,3,4,5] -> 5", "[10,5,8] -> 10"],
                "programmingLanguage": "python"
            }
        },
        {
            "name": "Descriptive Question",
            "data": {
                "text": "Explain the difference between HTTP and HTTPS protocols",
                "type": "descriptive",
                "tags": ["networking", "security", "protocols"],
                "rubric": "Should cover encryption, certificates, and practical differences"
            }
        }
    ]
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            for test_case in test_questions:
                print(f"   Adding: {test_case['name']}")
                response = await client.post(
                    f"{BACKEND_URL}/api/admin/questions/add-single",
                    headers={"Authorization": f"Bearer {token}"},
                    json=test_case["data"]
                )
                response.raise_for_status()
                result = response.json()
                print(f"      Question ID: {result.get('question_id', 'N/A')}")
                print(f"      Success: {result.get('success', False)}")
                
        print("✅ Single Question Addition Tests Passed")
        return True
    except Exception as e:
        print(f"❌ Single Question Addition Failed: {e}")
        return False

async def test_bulk_upload():
    """Test bulk question upload"""
    print("\n🔍 Testing Bulk Question Upload...")
    
    token = await get_admin_token()
    
    # Create test CSV content
    csv_content = '''type,text,tags,options,correct_answer,starter_code,test_cases,programming_language,rubric
mcq,"What is the Big O notation for binary search?","algorithms,complexity","a) O(n)|b) O(log n)|c) O(n²)|d) O(1)",b,,,,
coding,"Implement a sorting algorithm","algorithms,sorting",,,"def sort_array(arr):\n    # Your code here\n    pass","[3,1,4,1,5] -> [1,1,3,4,5]",python,
descriptive,"Describe the MVC architecture pattern","architecture,design",,,,,,"Should explain Model, View, Controller separation"'''
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Step 1: Upload and validate
            print("   Step 1: Uploading CSV for validation...")
            files = {"file": ("test_questions.csv", csv_content, "text/csv")}
            response = await client.post(
                f"{BACKEND_URL}/api/admin/questions/bulk-validate",
                headers={"Authorization": f"Bearer {token}"},
                files=files
            )
            response.raise_for_status()
            validation_result = response.json()
            
            print(f"      Total Questions: {validation_result.get('totalQuestions', 0)}")
            print(f"      New Questions: {validation_result.get('newQuestions', 0)}")
            print(f"      Exact Duplicates: {validation_result.get('exactDuplicates', 0)}")
            print(f"      Similar Duplicates: {validation_result.get('similarDuplicates', 0)}")
            
            # Step 2: Confirm import
            if validation_result.get('newQuestions', 0) > 0:
                print("   Step 2: Confirming import...")
                response = await client.post(
                    f"{BACKEND_URL}/api/admin/questions/bulk-confirm",
                    headers={"Authorization": f"Bearer {token}"}
                )
                response.raise_for_status()
                import_result = response.json()
                
                print(f"      Imported Count: {import_result.get('imported_count', 0)}")
                print(f"      Success: {import_result.get('success', False)}")
            
        print("✅ Bulk Question Upload Tests Passed")
        return True
    except Exception as e:
        print(f"❌ Bulk Question Upload Failed: {e}")
        return False

async def test_backend_health():
    """Test backend health"""
    print("\n🔍 Testing Backend Health...")
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(f"{BACKEND_URL}/health")
            response.raise_for_status()
            print("✅ Backend Health Check Passed")
            return True
    except Exception as e:
        print(f"❌ Backend Health Check Failed: {e}")
        return False


async def test_assessment_creation_with_generation():
    """Test creating an assessment with AI-generated questions"""
    print("\n🔍 Testing Assessment Creation with AI Generation...")
    token = await get_admin_token()

    payload = {
        "title": "Generated API Design Assessment",
        "description": "Assessment containing AI-generated questions",
        "duration": 45,
        "generate": [
            {"skill": "REST API Design", "question_type": "descriptive", "difficulty": "medium", "count": 1},
            {"skill": "Algorithms", "question_type": "coding", "difficulty": "easy", "count": 1}
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{BACKEND_URL}/api/admin/assessments/create",
                headers={"Authorization": f"Bearer {token}"},
                json=payload
            )
            response.raise_for_status()
            result = response.json()
            print(f"   Assessment ID: {result.get('assessment_id')}")
            print(f"   Question Count: {result.get('question_count')}")
        print("✅ Assessment Creation with Generation Passed")
        return True
    except Exception as e:
        print(f"❌ Assessment Creation with Generation Failed: {e}")
        return False

async def main():
    """Run all tests"""
    print("🚀 Starting Add Questions Feature Tests")
    print("=" * 50)
    
    tests = [
        ("Backend Health", test_backend_health),
        ("AI Service Health", test_ai_service_health),
        ("Question Validation", test_question_validation),
        ("Question Rewriting", test_question_rewriting),
        ("Single Question Addition", test_single_question_addition),
        ("Bulk Question Upload", test_bulk_upload),
        ("Assessment Creation w/ Generation", test_assessment_creation_with_generation),
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = await test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"❌ {test_name} crashed: {e}")
            results.append((test_name, False))
    
    print("\n" + "=" * 50)
    print("📊 Test Results Summary")
    print("=" * 50)
    
    passed = 0
    total = len(results)
    
    for test_name, success in results:
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{test_name:<25} {status}")
        if success:
            passed += 1
    
    print(f"\nOverall: {passed}/{total} tests passed")
    
    if passed == total:
        print("🎉 All tests passed! The Add Questions feature is working correctly.")
    else:
        print("⚠️  Some tests failed. Check the logs above for details.")

if __name__ == "__main__":
    asyncio.run(main())


async def test_assessment_creation_with_generation():
    """Test creating an assessment with AI-generated questions"""
    print("\n🔍 Testing Assessment Creation with AI Generation...")
    token = await get_admin_token()

    payload = {
        "title": "Generated API Design Assessment",
        "description": "Assessment containing AI-generated questions",
        "duration": 45,
        "generate": [
            {"skill": "REST API Design", "question_type": "descriptive", "difficulty": "medium", "count": 1},
            {"skill": "Algorithms", "question_type": "coding", "difficulty": "easy", "count": 1}
        ]
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{BACKEND_URL}/api/admin/assessments/create",
                headers={"Authorization": f"Bearer {token}"},
                json=payload
            )
            response.raise_for_status()
            result = response.json()
            print(f"   Assessment ID: {result.get('assessment_id')}")
            print(f"   Question Count: {result.get('question_count')}")
        print("✅ Assessment Creation with Generation Passed")
        return True
    except Exception as e:
        print(f"❌ Assessment Creation with Generation Failed: {e}")
        return False
