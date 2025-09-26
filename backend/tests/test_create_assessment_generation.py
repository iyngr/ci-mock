import asyncio
import sys
import os
from importlib.machinery import SourceFileLoader
from types import SimpleNamespace
import types as _types

# Load repo root early
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, ROOT)

# Load modules without installing FastAPI by injecting minimal fakes
fake_fastapi = _types.ModuleType('fastapi')
fake_fastapi.APIRouter = lambda *a, **k: type('DummyRouter', (), {'options': lambda self, *a, **k: (lambda f: f), 'post': lambda self, *a, **k: (lambda f: f), 'get': lambda self, *a, **k: (lambda f: f)})()
fake_fastapi.HTTPException = Exception
fake_fastapi.Depends = lambda x: x
fake_fastapi.Header = lambda *a, **k: None
fake_fastapi.UploadFile = object
fake_fastapi.File = lambda *a, **k: None
fake_fastapi.BackgroundTasks = object
sys.modules['fastapi'] = fake_fastapi
_resp = _types.ModuleType('fastapi.responses')
setattr(_resp, 'JSONResponse', lambda *a, **k: None)
sys.modules['fastapi.responses'] = _resp

# Load backend models and database
models_mod = SourceFileLoader('models', os.path.join(ROOT, 'backend', 'models.py')).load_module()
sys.modules['models'] = models_mod
database_mod = SourceFileLoader('database', os.path.join(ROOT, 'backend', 'database.py')).load_module()
sys.modules['database'] = database_mod

# Load admin router
admin_mod = SourceFileLoader('admin_router', os.path.join(ROOT, 'backend', 'routers', 'admin.py')).load_module()

class MockDB:
    def __init__(self):
        self.storage = {}
    async def create_item(self, container_name, item, partition_key=None):
        if container_name not in self.storage:
            self.storage[container_name] = []
        self.storage[container_name].append(item)
        return item

async def run_test():
    db = MockDB()
    bg = SimpleNamespace(add_task=lambda *a, **k: None)
    admin = {"admin_id": "admin-test"}

    # Fake AI
    async def fake_ai(endpoint, data):
        return {"question": f"AI question for {data.get('skill')} ({data.get('question_type')})"}

    admin_mod.call_ai_service = fake_ai

    class Req:
        title = "Auto Gen Assessment"
        description = "Test"
        duration = 30
        target_role = None
        questions = None
        generate = [{"skill": "Testing", "question_type": "mcq", "difficulty": "easy", "count": 1}]

    res = await admin_mod.create_assessment_admin(Req(), bg, admin, db)
    print("Create Assessment Response:", res)
    assert res['success'] is True
    assert res['question_count'] == 1
    assert 'generated_questions' in db.storage or 'assessments' in db.storage

if __name__ == '__main__':
    asyncio.run(run_test())
