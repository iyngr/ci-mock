#!/usr/bin/env python3
"""
Demo script for the Add Questions feature.
Shows the complete workflow with sample questions.
"""

import asyncio
import httpx

BACKEND_URL = "http://localhost:8000"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin123"

async def demo_add_questions():
    """Demonstrate the Add Questions feature"""
    print("🚀 Add Questions Feature Demo")
    print("=" * 50)
    
    # Get admin token
    print("🔐 Authenticating admin...")
    async with httpx.AsyncClient() as client:
        auth_response = await client.post(
            f"{BACKEND_URL}/api/admin/login",
            json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}
        )
        token = auth_response.json()["token"]
        print("✅ Admin authenticated successfully")
    
    # Demo questions to add
    demo_questions = [
        {
            "name": "React Hooks MCQ",
            "data": {
                "text": "what are react hooks",
                "type": "mcq",
                "tags": ["react", "frontend"],
                "options": [
                    {"id": "a", "text": "Functions that let you use state"},
                    {"id": "b", "text": "Class components"},
                    {"id": "c", "text": "CSS styling methods"},
                    {"id": "d", "text": "None of the above"}
                ],
                "correctAnswer": "a"
            }
        },
        {
            "name": "Python Coding Challenge",
            "data": {
                "text": "implement fibonacci sequence",
                "type": "coding",
                "tags": ["python", "algorithms"],
                "starterCode": "def fibonacci(n):\n    # implement here\n    pass",
                "testCases": ["fibonacci(5) -> 5", "fibonacci(10) -> 55"],
                "programmingLanguage": "python"
            }
        },
        {
            "name": "System Design Question",
            "data": {
                "text": "explain microservices architecture",
                "type": "descriptive",
                "tags": ["architecture", "system-design"],
                "rubric": "Should cover service independence, communication, scalability"
            }
        }
    ]
    
    print(f"\n📝 Adding {len(demo_questions)} sample questions...")
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        for i, question in enumerate(demo_questions, 1):
            print(f"\n{i}. Adding: {question['name']}")
            print(f"   Original text: '{question['data']['text']}'")
            
            try:
                response = await client.post(
                    f"{BACKEND_URL}/api/admin/questions/add-single",
                    headers={"Authorization": f"Bearer {token}"},
                    json=question["data"]
                )
                
                if response.status_code == 200:
                    result = response.json()
                    print(f"   ✅ Success! Question ID: {result.get('question_id')}")
                    print(f"   🤖 AI Enhanced: '{result.get('enhanced_text', 'N/A')}'")
                    print(f"   🎯 Suggested Role: {result.get('suggested_role', 'N/A')}")
                    print(f"   🏷️  Suggested Tags: {result.get('suggested_tags', [])}")
                elif response.status_code == 409:
                    print("   ⚠️  Duplicate detected - this is expected behavior")
                else:
                    print(f"   ❌ Failed: {response.status_code}")
                    
            except Exception as e:
                print(f"   ❌ Error: {e}")
    
    print("\n🎉 Demo completed!")
    print("💡 To see the full interface, visit: http://localhost:3000/admin/add-questions")

if __name__ == "__main__":
    asyncio.run(demo_add_questions())
