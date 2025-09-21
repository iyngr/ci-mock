"""Simple smoke test for backend APIs.

Run: python scripts\smoke_test_backend.py

This script hits key endpoints and reports pass/fail. It expects the backend to be running at http://localhost:8002
"""
import requests
import sys
import time

BASE = "http://localhost:8002"

tests = []


def run_test(name, fn):
    print(f"-> {name}...", end=" ")
    try:
        ok, detail = fn()
        print("PASS" if ok else "FAIL")
        if not ok:
            print("   ", detail)
        return ok
    except Exception as e:
        print("ERROR")
        print("   ", e)
        return False


def test_root():
    r = requests.get(BASE + "/")
    return (r.status_code == 200, r.text)


def test_health():
    r = requests.get(BASE + "/health")
    return (r.status_code == 200 and 'healthy' in r.text.lower(), r.text)


def test_rag_health():
    r = requests.get(BASE + "/api/rag/health")
    return (r.status_code == 200 and 'status' in r.json(), r.text)


def test_rag_search():
    payload = {"question": "What is the purpose of the assessment platform?"}
    r = requests.post(BASE + "/api/rag/ask", json=payload, timeout=10)
    ok = r.status_code == 200 and isinstance(r.json(), dict)
    return (ok, r.text)


def test_scoring_dev_create():
    r = requests.post(BASE + "/api/scoring/dev/create-mock-submission", json={})
    ok = r.status_code == 200 and r.json().get('success') is True
    return (ok, r.text)


def test_scoring_dev_evals():
    # Use a known id if created recently; fallback to listing
    r = requests.get(BASE + "/api/scoring/dev/evaluations/sub_31c915f0")
    return (r.status_code == 200 and 'evaluations' in r.json(), r.text)


def test_utils_run_code():
    payload = {"language": "python", "code": "print('hello')", "submissionId": "test_sub", "questionId": "q1"}
    r = requests.post(BASE + "/api/utils/run-code", json=payload, timeout=10)
    return (r.status_code == 200 and isinstance(r.json(), dict), r.text)


TEST_FUNCTIONS = [
    ("root", test_root),
    ("health", test_health),
    ("rag_health", test_rag_health),
    ("rag_ask", test_rag_search),
    ("scoring_create_mock", test_scoring_dev_create),
    ("scoring_read_evals", test_scoring_dev_evals),
    ("utils_run_code", test_utils_run_code),
]


def main():
    print("Backend smoke test — base:", BASE)
    results = []
    for name, fn in TEST_FUNCTIONS:
        ok = run_test(name, fn)
        results.append((name, ok))
        time.sleep(0.2)

    failed = [n for n, ok in results if not ok]
    print("\nSummary:")
    print(f"  Passed: {len(results) - len(failed)}/{len(results)}")
    if failed:
        print("  Failed:")
        for f in failed:
            print("   -", f)
        sys.exit(2)
    else:
        print("  All checks passed")
        sys.exit(0)


if __name__ == '__main__':
    main()
