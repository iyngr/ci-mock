# Talens (Speech-to-Speech Interviewer)

Frontend-only Next.js app for the live S2S interview. Connects to backend `/api/live-interview` endpoints.

Env:
- NEXT_PUBLIC_API_URL=http://localhost:8000
- NEXT_PUBLIC_REALTIME_REGION=eastus2
- NEXT_PUBLIC_REALTIME_VOICE=verse
- NEXT_PUBLIC_LLM_AGENT_URL=http://localhost:9000

Run:
- pnpm install
- pnpm dev --filter talens
