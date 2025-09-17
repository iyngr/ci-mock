import sys
import os
from importlib.machinery import SourceFileLoader
import types
import unittest

# Ensure repo root on path
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
sys.path.insert(0, ROOT)

# --- Fake minimal FastAPI to satisfy router imports ---
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
fake_fastapi.BackgroundTasks = object
sys.modules['fastapi'] = fake_fastapi

# Minimal constants module
constants_mod = types.ModuleType('constants')
constants_mod.CONTAINER = {
    "ASSESSMENTS": "assessments",
    "SUBMISSIONS": "submissions",
    "QUESTIONS": "questions",
    "GENERATED_QUESTIONS": "generated_questions",
    "KNOWLEDGE_BASE": "knowledge_base",
    "CODE_EXECUTIONS": "code_executions",
    "EVALUATIONS": "evaluations",
    "RAG_QUERIES": "rag_queries",
    "INTERVIEWS": "interviews",
    "INTERVIEW_TRANSCRIPTS": "interview_transcripts",
}
sys.modules['constants'] = constants_mod

# Load models and expose as 'models' for scoring import
models_path = os.path.join(ROOT, 'backend', 'models.py')
models_mod = SourceFileLoader('models', models_path).load_module()
sys.modules['models'] = models_mod

# Provide a fake 'database' module to avoid azure.cosmos dependency at import time
fake_db = types.ModuleType('database')
class _DummyService:
    pass
async def _fake_get_service(*args, **kwargs):
    return _DummyService()

fake_db.CosmosDBService = _DummyService
fake_db.get_cosmosdb_service = _fake_get_service
sys.modules['database'] = fake_db

# Disable Azure usage paths for this test before importing scoring
os.environ['USE_AZURE_OPENAI'] = 'false'

# Load scoring module
scoring_path = os.path.join(ROOT, 'backend', 'routers', 'scoring.py')
scoring_mod = SourceFileLoader('scoring_router', scoring_path).load_module()


class RubricHelperTests(unittest.TestCase):
    def test_extract_breakdown_and_weighted_score(self):
        criteria = ["communication", "problemSolving", "explanationQuality"]
        result = {
            "scores": {
                "communication": 0.9,
                "problemSolving": 0.5,
                "explanationQuality": 1.2,  # clamp to 1.0
            }
        }
        breakdown = scoring_mod._extract_breakdown(result, criteria)
        self.assertEqual(set(breakdown.keys()), set(criteria))
        self.assertTrue(0.0 <= breakdown['communication'] <= 1.0)
        self.assertEqual(breakdown['explanationQuality'], 1.0)

        weights = {"communication": 0.2, "problemSolving": 0.2, "explanationQuality": 0.15}
        score = scoring_mod._weighted_score(breakdown, weights)
        self.assertTrue(0.0 <= score <= 1.0)

    def test_format_feedback_band_label_present(self):
        # Simple breakdown that should produce a reasonable overall percent and a band label string
        breakdown = {"communication": 0.8, "problemSolving": 0.7, "explanationQuality": 0.9}
        rubric = {
            "weights": {"communication": 0.2, "problemSolving": 0.2, "explanationQuality": 0.15},
            "bands": {"0-39": "Below", "40-59": "Developing", "60-74": "Solid", "75-89": "Strong", "90-100": "Exceptional"}
        }
        text = scoring_mod._format_feedback(breakdown, rubric)
        self.assertIsInstance(text, str)
        self.assertIn("Overall", text)
        self.assertIn("%", text)
        self.assertIn("Strongest", text)


if __name__ == '__main__':
    unittest.main()
