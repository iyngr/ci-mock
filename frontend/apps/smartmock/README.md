# Frontend (Next.js 14)

TypeScript / App Router UI for Candidate & Admin workflows of the AI Technical Assessment Platform.

---
## 1. Responsibilities
| Domain    | Responsibilities                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate | Login, instructions, assessment workspace (MCQ / Descriptive / Coding), live code execution (Judge0), timer display, navigation, submission confirmation |
| Admin     | Dashboard KPIs, initiate tests, manage questions (single + bulk AI enhancement), review submissions & reports                                            |
| RAG/AI UX | Optional hooks to request AI-generated questions; pending advanced retrieval UX                                                                          |
| Integrity | Fullscreen prompt + tab switch detection (proctoring signals sent to backend)                                                                            |

The backend is authoritative for: timing, scoring, final submission state, and RAG retrieval. Frontend never mutates canonical timers directly.

---
## 2. Tech Stack
* Next.js 14 (App Router)
* React 19
* TypeScript strict mode
* Tailwind CSS + Shadcn/UI primitives
* Monaco Editor (@monaco-editor/react) for coding questions
* Chart.js for admin metrics
* Light client/server component split (server components for data fetch where feasible)

---
## 3. Project Structure (Selected)
```
src/
	app/
		admin/              # Admin routes (dashboard, initiate-test, reports, add-questions)
		candidate/          # Candidate-facing flows (instructions, assessment, success)
	components/
		AssessmentConsole.tsx  # Core assessment orchestration component
		report/                # Report view components
		ui/                    # Shadcn-style wrappers (button, input, textarea)
	lib/
		schema.ts          # Zod schemas / validation
		utils.ts           # Shared helpers
		roleConfig.ts      # Role/permission mapping
```

---
## 4. Environment Variables
Create `frontend/.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
```
`NEXT_PUBLIC_API_URL` is the only required variable for local dev. In production provide the deployed backend base URL (HTTPS).

Optional future additions (not yet required):
* `NEXT_PUBLIC_FEATURE_RAG=true` – enable RAG UI affordances when backend vector features are live.

---
## 5. Development
```bash
pnpm install
pnpm dev
```
Visit http://localhost:3000.

### Linting & Type Safety
```bash
pnpm lint
```
(Add `pnpm typecheck` script once stricter tsc build target is introduced.)

### Production Build
```bash
pnpm build
pnpm start
```

---
## 6. Data Flow (Candidate Assessment)
1. Candidate enters code → POST `/api/candidate/login`
2. Starts assessment → POST `/api/candidate/assessment/start` (server returns submission + expiry)
3. Frontend renders questions + shows server-sourced deadline
4. Code execution → POST `/api/utils/run-code` (Judge0 proxy)
5. Submission → POST `/api/candidate/assessment/submit`
6. Success page polls / receives evaluation summary (LLM evaluation async path)

---
## 7. Question Authoring Flow (Admin)
* Add single question with AI enhancement → backend normalizes skill + stores in `generated_questions` if AI-generated.
* Bulk upload triggers semantic duplicate detection and grammar fixes (final confirmation persists batch).

---
## 8. Styling & UI
* Tailwind utility-first styling
* Shadcn/UI base components wrapped in `components/ui/`
* Monaco Editor theme optimized for coding readability

---
## 9. Performance Notes
* Server Components reduce client bundle size for static admin metrics
* Incremental rendering for assessment page (editor + question list loaded progressively)
* Memoization in `AssessmentConsole` to prevent editor re-mounts on navigation

---
## 10. Future Enhancements
| Area                 | Planned                                          |
| -------------------- | ------------------------------------------------ |
| RAG UI               | Inline suggested hints / context panels          |
| Accessibility        | Enhanced keyboard nav & ARIA roles audit         |
| Internationalization | Language pack scaffolding                        |
| Real-time updates    | WebSocket or SSE for evaluation status streaming |
| Offline handling     | Graceful reconnect + submission resilience       |

---
## 11. Deployment
Primary options:
* Vercel (edge-friendly, fast iterations)
* Azure Static Web Apps (if consolidating on Azure)
* Azure Container Apps (if container uniformity desired)

Remember to set `NEXT_PUBLIC_API_URL` to the backend public URL at build time.

---
## 12. Contributing
1. Open issue for UX changes affecting assessment flow
2. Keep components small & typed; prefer composition over inheritance
3. Co-locate styles; avoid deep prop drilling (use context providers)
4. Update this README if a new env var or top-level route is added

---
## 13. License
MIT (see root `LICENSE`).
