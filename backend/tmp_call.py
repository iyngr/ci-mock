import requests
r = requests.post('http://localhost:8002/api/scoring/dev/create-mock-submission', timeout=30)
print(r.status_code)
print(r.text)
