import asyncio
import sys
import os
from importlib.machinery import SourceFileLoader
from types import SimpleNamespace
import types

# Ensure repo root is on path early
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, ROOT)

# Load admin router without importing package-level dependencies that may require optional packages
admin_path = os.path.join(ROOT, 'backend', 'routers', 'admin.py')

# Create a minimal fake 'fastapi' module to satisfy imports in admin.py when FastAPI is not installed
fake_fastapi = types.ModuleType('fastapi')
def _make_dummy_router(*a, **k):
    class DummyRouter:
        def options(self, *args, **kwargs):
            def dec(fn):
                return fn
            return dec
        def post(self, *args, **kwargs):
            def dec(fn):
                return fn
            return dec
        def get(self, *args, **kwargs):
            def dec(fn):
                return fn
            return dec
    return DummyRouter()

fake_fastapi.APIRouter = _make_dummy_router
fake_fastapi.HTTPException = Exception
fake_fastapi.Depends = lambda x: x
fake_fastapi.Header = lambda *a, **k: None
fake_fastapi.UploadFile = object
fake_fastapi.File = lambda *a, **k: None
fake_fastapi.BackgroundTasks = object

# Minimal responses submodule
fake_responses = types.ModuleType('fastapi.responses')
fake_responses.JSONResponse = lambda *a, **k: None

sys.modules['fastapi'] = fake_fastapi
sys.modules['fastapi.responses'] = fake_responses

# Also ensure 'models' import resolves to backend.models
models_path = os.path.join(ROOT, 'backend', 'models.py')
models_mod = SourceFileLoader('models', models_path).load_module()
sys.modules['models'] = models_mod

# Load database module as 'database' to satisfy admin imports
database_path = os.path.join(ROOT, 'backend', 'database.py')
database_mod = SourceFileLoader('database', database_path).load_module()
sys.modules['database'] = database_mod

admin_router = SourceFileLoader('admin_router', admin_path).load_module()

class MockDB:
    def __init__(self):
        self.storage = {}
    async def create_item(self, container_name, item, partition_key=None):
        # store by container
        if container_name not in self.storage:
            self.storage[container_name] = []
        self.storage[container_name].append(item)
        return item

async def run_test():
    mock_db = MockDB()
    background_tasks = SimpleNamespace(add_task=lambda *args, **kwargs: None)
    admin = {"admin_id": "admin-test"}

    class Req:
        skill = "Testing"
        question_type = "mcq"
        difficulty = "easy"

    # Monkey patch call_ai_service to avoid network
    async def fake_call_ai_service(endpoint, data):
        return {"question": f"Generated question for {data['skill']} ({data['question_type']})"}

    admin_router.call_ai_service = fake_call_ai_service

    response = await admin_router.generate_question_admin(Req(), background_tasks, admin, mock_db)
    print("Response:", response)
    assert response["success"] is True
    assert "generated_text" in response
    assert mock_db.storage.get("generated_questions"), "Generated question not persisted"

if __name__ == '__main__':
    asyncio.run(run_test())
