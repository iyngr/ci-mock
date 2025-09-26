#!/usr/bin/env python3
"""
Quick test script for the new server-authoritative assessment endpoints.
Run this while the backend is running to validate the new functionality.
"""

import requests
import datetime
from time import sleep

BASE_URL = "http://localhost:8000"

def test_start_assessment():
    """Test the new start assessment endpoint"""
    print("🧪 Testing start assessment endpoint...")
    
    url = f"{BASE_URL}/api/candidate/assessment/start"
    payload = {
        "assessment_id": "test1",
        "candidate_id": "candidate@example.com"
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success! Submission ID: {data['submission_id']}")
            print(f"   Expiration Time: {data['expiration_time']}")
            print(f"   Duration: {data['duration_minutes']} minutes")
            return data['submission_id']
        else:
            print(f"❌ Error: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Exception: {e}")
        return None

def test_submit_assessment(submission_id):
    """Test the new submit assessment endpoint"""
    print("\n🧪 Testing submit assessment endpoint...")
    
    if not submission_id:
        print("❌ No submission ID available")
        return
    
    url = f"{BASE_URL}/api/candidate/assessment/submit"
    payload = {
        "submission_id": submission_id,
        "answers": [
            {
                "question_id": "q1",
                "question_type": "mcq",
                "answer": 1,
                "time_spent": 60
            },
            {
                "question_id": "q2",
                "question_type": "descriptive",
                "answer": "HTTP is unencrypted while HTTPS uses TLS/SSL encryption.",
                "time_spent": 120
            }
        ],
        "proctoring_events": [
            {
                "timestamp": datetime.datetime.utcnow().isoformat(),
                "event_type": "assessment_started",
                "details": {"browser": "Chrome"}
            }
        ]
    }
    
    try:
        response = requests.post(url, json=payload)
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Success! Result ID: {data['resultId']}")
            print(f"   Submission ID: {data['submissionId']}")
            print(f"   Message: {data['message']}")
        else:
            print(f"❌ Error: {response.text}")
            
    except Exception as e:
        print(f"❌ Exception: {e}")

def test_legacy_endpoints():
    """Test that legacy endpoints still work"""
    print("\n🧪 Testing legacy endpoints for backward compatibility...")
    
    # Test legacy login
    try:
        url = f"{BASE_URL}/api/candidate/login"
        payload = {"login_code": "TEST123"}
        response = requests.post(url, json=payload)
        print(f"Legacy login: {response.status_code} - {'✅' if response.status_code == 200 else '❌'}")
    except Exception as e:
        print(f"Legacy login error: {e}")
    
    # Test get assessment
    try:
        url = f"{BASE_URL}/api/candidate/assessment/test1"
        response = requests.get(url)
        print(f"Get assessment: {response.status_code} - {'✅' if response.status_code == 200 else '❌'}")
    except Exception as e:
        print(f"Get assessment error: {e}")

def test_health_check():
    """Test basic health check"""
    print("🧪 Testing health check...")
    
    try:
        response = requests.get(f"{BASE_URL}/health")
        if response.status_code == 200:
            print("✅ Backend is healthy")
            return True
        else:
            print(f"❌ Backend health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Cannot connect to backend: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Testing Server-Authoritative Assessment System")
    print("=" * 50)
    
    # Check if backend is running
    if not test_health_check():
        print("\n❌ Backend is not running. Please start it with:")
        print("   cd backend && uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload")
        return
    
    # Test new endpoints
    submission_id = test_start_assessment()
    
    if submission_id:
        # Wait a moment to simulate user taking assessment
        print("\n⏳ Simulating assessment in progress...")
        sleep(2)
        
        test_submit_assessment(submission_id)
    
    # Test legacy endpoints
    test_legacy_endpoints()
    
    print("\n" + "=" * 50)
    print("🎉 Testing complete!")
    print("\nNext steps:")
    print("1. Test the frontend flow at http://localhost:3001/candidate")
    print("2. Check the complete testing guide: docs/testing-guide.md")
    print("3. Deploy Azure Function for auto-submission")

if __name__ == "__main__":
    main()
