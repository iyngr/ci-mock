# End-to-End Testing - Master Document

**Project:** CI-Mock - Technical Assessment Platform  
**Version:** 1.0  
**Date:** October 3, 2025  
**Test Coverage:** SmartMock, Talens, Admin Apps

---

## 📋 Executive Summary

This master document provides a comprehensive overview of end-to-end testing scenarios across all three applications in the CI-Mock technical assessment platform:

1. **SmartMock** - Traditional code-first assessment (20 scenarios)
2. **Talens** - Enhanced assessment with AI interview (20 scenarios)  
3. **Admin** - Administrative dashboard and management (20 scenarios)

**Total Test Scenarios:** 60 comprehensive E2E tests  
**Estimated Testing Time:** 15-20 hours for complete coverage  
**Priority Distribution:** 40 Critical, 15 High, 5 Medium

---

## 🏗️ Application Architecture Overview

### SmartMock App
**Purpose:** Traditional technical assessment platform  
**Key Features:**
- Code-based questions (MCQ, Descriptive, Coding)
- Monaco Editor for coding questions
- Comprehensive proctoring (tab switching, copy/paste, fullscreen)
- Timer-based assessments with grace period
- Auto-submission on violations or time expiry
- **Phase 1 Integration:** Assessment readiness checks (generation progress)

**User Flows:**
1. Landing → Candidate/Admin selection
2. Candidate Login → Instructions → Assessment → Success
3. Admin Login → Dashboard → Manage tests

**Document:** [`E2E_TESTING_SMARTMOCK.md`](./E2E_TESTING_SMARTMOCK.md)

---

### Talens App
**Purpose:** Enhanced assessment experience with AI-powered live interview  
**Key Features:**
- All SmartMock features PLUS:
- **Phase 1:** Server-authoritative timer sync, auto-submission tracking
- **Phase 2:** System Check Modal (mic, internet, WebRTC validation)
- **Phase 3:** WebRTC audio client with adaptive quality control
- **Phase 4:** AI-powered live interview with GPT-4o Realtime API
- Real-time conversation transcript
- Audio quality monitoring (excellent, good, poor, critical)
- Automatic reconnection handling

**User Flows:**
1. Landing → Candidate/Admin selection
2. Candidate Login → Readiness Check → System Check → Instructions → Assessment/Interview → Success
3. Interview-only flow (skip assessment questions)
4. Mixed flow (assessment questions → interview)

**Document:** [`E2E_TESTING_TALENS.md`](./E2E_TESTING_TALENS.md)

---

### Admin App
**Purpose:** Administrative control center for assessment management  
**Key Features:**
- Admin authentication (email/password)
- Dashboard with KPI metrics and charts
- Question management (create, edit, delete MCQ/Descriptive/Coding)
- Test initiation workflow (generate codes, configure assessments)
- Candidate submission reports (answers, proctoring, scores, interview transcripts)
- Smart screen (AI-powered resume analysis)
- Analytics page (charts, metrics, filters)

**User Flows:**
1. Landing → Login → Dashboard
2. Dashboard → Add Questions → Create (MCQ/Descriptive/Coding) → Save
3. Dashboard → Initiate Test → Select questions → Generate code
4. Dashboard → View Report → Review submission (answers, proctoring, interview)
5. Dashboard → Analytics → Filter and analyze data
6. Dashboard → Smart Screen → Upload resume → AI analysis → Initiate test

**Document:** [`E2E_TESTING_ADMIN.md`](./E2E_TESTING_ADMIN.md)

---

## 🔧 Test Environment Setup

### Prerequisites

**System Requirements:**
- Python 3.12+ (backend)
- Node.js 18+ (frontend)
- UV package manager (backend)
- PNPM package manager (frontend)
- Modern browser (Chrome 90+, Edge 90+, Firefox 88+)

**External Dependencies:**
- Azure Cosmos DB (or MongoDB)
- Azure OpenAI (GPT-4o Realtime API for live interview)
- Judge0 API (code execution)

### Environment Configuration

**Backend Setup:**
```powershell
# Navigate to backend
cd backend

# Install dependencies with UV
uv sync

# Configure environment variables (.env)
DATABASE_URL=mongodb://localhost:27017/assessment
AZURE_OPENAI_ENDPOINT=https://your-openai.openai.azure.com/
AZURE_OPENAI_API_KEY=your-api-key
JUDGE0_API_URL=https://judge0-ce.p.rapidapi.com
JUDGE0_API_KEY=your-judge0-key

# Run backend server
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Frontend Setup (All Apps):**
```powershell
# Navigate to frontend root
cd frontend

# Install dependencies
pnpm install

# Start SmartMock (Terminal 1)
cd apps/smartmock
pnpm dev  # Port 3000

# Start Talens (Terminal 2)
cd apps/talens
pnpm dev  # Port 3001

# Start Admin (Terminal 3)
cd apps/admin
pnpm dev  # Port 3002
```

### URLs
- **Backend API:** http://localhost:8000
- **API Docs:** http://localhost:8000/docs
- **SmartMock:** http://localhost:3000
- **Talens:** http://localhost:3001
- **Admin:** http://localhost:3002

### Test Data Setup

**Admin Credentials:**
- Email: admin@example.com
- Password: admin123

**Sample Data Required:**
- 10+ questions (mix of MCQ, Descriptive, Coding)
- 3-5 test assessments with various statuses (pending, in_progress, completed)
- 2-3 candidate submissions (with proctoring events)
- 1-2 interview transcripts (for Talens testing)
- Sample resumes (PDF files for Smart Screen testing)

---

## 📊 Test Scenario Distribution

### By Priority

| Priority  | SmartMock | Talens | Admin  | Total  |
| --------- | --------- | ------ | ------ | ------ |
| Critical  | 12        | 15     | 13     | **40** |
| High      | 5         | 4      | 6      | **15** |
| Medium    | 3         | 1      | 1      | **5**  |
| **Total** | **20**    | **20** | **20** | **60** |

### By Category

| Category                | SmartMock | Talens | Admin  | Total  |
| ----------------------- | --------- | ------ | ------ | ------ |
| Authentication          | 1         | 1      | 3      | 5      |
| Landing/Navigation      | 1         | 1      | 2      | 4      |
| Assessment Questions    | 6         | 2      | -      | 8      |
| Proctoring              | 4         | 1      | -      | 5      |
| Timer/Submission        | 3         | 3      | -      | 6      |
| System Checks           | -         | 2      | -      | 2      |
| Live Interview          | -         | 6      | -      | 6      |
| Audio/WebRTC            | -         | 3      | -      | 3      |
| Dashboard/Reports       | 1         | -      | 4      | 5      |
| Question Management     | -         | -      | 3      | 3      |
| Test Creation           | -         | -      | 2      | 2      |
| Analytics               | -         | -      | 1      | 1      |
| Smart Screen            | -         | -      | 1      | 1      |
| Admin Functions         | -         | -      | 3      | 3      |
| Regression (Happy Path) | 3         | 3      | 1      | 7      |
| Network/Error Handling  | 1         | 2      | -      | 3      |
| **Total**               | **20**    | **20** | **20** | **60** |

---

## 🎯 Cross-Application Testing Scenarios

These scenarios test the complete workflow across multiple applications:

### Scenario CA-001: Complete Assessment Lifecycle (SmartMock)

**Workflow:** Admin creates test → Candidate takes test → Admin views report

**Steps:**
1. **Admin App:**
   - Login as admin
   - Navigate to "Add Questions"
   - Create 3 questions (1 MCQ, 1 Descriptive, 1 Coding)
   - Navigate to "Initiate Test"
   - Create test with 3 questions, duration 30 min
   - Generate assessment code: TEST-ABC-123
2. **SmartMock App:**
   - Navigate to candidate login
   - Enter code: TEST-ABC-123
   - Read instructions → Start assessment
   - Answer all 3 questions
   - Submit assessment
3. **Admin App:**
   - Refresh dashboard
   - Locate completed test
   - Click "View Report"
   - Verify all answers, proctoring events, scores

**Expected:** Complete lifecycle works end-to-end, all data persists correctly.

---

### Scenario CA-002: Complete Assessment Lifecycle with Interview (Talens)

**Workflow:** Admin creates test with interview → Candidate completes both → Admin views full report

**Steps:**
1. **Admin App:**
   - Login as admin
   - Navigate to "Initiate Test"
   - Create test with 5 questions + live interview enabled
   - Interview: 30 min, Role "Senior Developer"
   - Generate code: TEST-XYZ-789
2. **Talens App:**
   - Login with code: TEST-XYZ-789
   - Complete system check (mic, internet, WebRTC)
   - Read instructions → Start
   - Answer 5 assessment questions
   - Proceed to live interview
   - Complete 10-minute interview with AI
   - End interview → Success page
3. **Admin App:**
   - Refresh dashboard
   - View report for submission
   - Verify:
     - All 5 question answers
     - Interview transcript (10+ conversation turns)
     - Proctoring events
     - AI evaluation scores

**Expected:** Complete flow with both assessment and interview works seamlessly.

---

### Scenario CA-003: Smart Screen to Assessment Flow

**Workflow:** Admin screens resume → Initiates test → Candidate takes test

**Steps:**
1. **Admin App:**
   - Login as admin
   - Navigate to "Smart Screen"
   - Upload resume: candidate_resume.pdf
   - Enter role: "Senior Full-Stack Developer"
   - Enter skills: "React, Node.js, MongoDB"
   - Analyze resume (AI processing)
   - Verify strong match (85/100)
   - Click "Initiate Test" from results
   - Pre-filled candidate email: candidate@example.com
   - Select 5 questions
   - Generate code: TEST-SCREEN-456
2. **SmartMock or Talens:**
   - Candidate receives email with code
   - Login with code: TEST-SCREEN-456
   - Complete assessment
3. **Admin App:**
   - View report
   - Compare resume skills with assessment performance

**Expected:** Seamless flow from resume screening to test initiation to completion.

---

### Scenario CA-004: Multi-Candidate Testing

**Workflow:** Admin creates single test → Multiple candidates take same test → Admin compares

**Steps:**
1. **Admin App:**
   - Create test with 5 questions
   - Generate 3 assessment codes (for 3 candidates)
2. **SmartMock/Talens (3 instances):**
   - Candidate A: Completes test in 25 min, 1 proctoring violation
   - Candidate B: Completes test in 40 min, 0 violations
   - Candidate C: Time expires, auto-submitted at 60 min, 3 violations
3. **Admin App:**
   - View reports for all 3 candidates
   - Compare:
     - Time taken (25, 40, 60 min)
     - Violations (1, 0, 3)
     - Scores (if graded)
   - Navigate to Analytics
   - View distribution chart showing all 3 submissions

**Expected:** Multiple candidates can take same test, admin can compare results.

---

## 🧪 Testing Best Practices

### Before Testing
1. **Environment Validation:**
   - ✅ Backend running (http://localhost:8000/health returns 200)
   - ✅ All three frontends running (ports 3000, 3001, 3002)
   - ✅ Database connected (check backend logs)
   - ✅ Azure OpenAI configured (for Talens interview testing)
   - ✅ Test data seeded (questions, users, sample submissions)

2. **Browser Setup:**
   - Use Chrome/Edge (best WebRTC support for Talens)
   - Clear cache before critical tests
   - Enable microphone permissions for Talens
   - Disable browser extensions that may interfere (ad blockers, script blockers)

3. **Test Data Preparation:**
   - Create 10+ questions covering all types and difficulties
   - Generate 3-5 assessment codes with various configurations
   - Prepare sample resumes for Smart Screen testing

### During Testing
1. **Documentation:**
   - Take screenshots at each major step
   - Record videos for complex flows (live interview, cross-app scenarios)
   - Note exact timestamps for timing-related tests
   - Copy error messages and console logs

2. **Data Validation:**
   - Check backend logs for API calls
   - Verify database records after each operation
   - Use browser DevTools → Network tab to inspect requests/responses
   - Use Application → Local Storage to verify session data

3. **Edge Case Testing:**
   - Test with slow internet (throttle network in DevTools)
   - Test with denied microphone permissions (Talens)
   - Test with invalid/expired tokens
   - Test with malformed data inputs

### After Testing
1. **Cleanup:**
   - Remove test submissions from database
   - Clear browser cache and localStorage
   - Reset test data to initial state

2. **Reporting:**
   - Update test execution logs with Pass/Fail status
   - Create bug tickets for failures with:
     - Steps to reproduce
     - Expected vs actual results
     - Screenshots/videos
     - Console logs and network traces
   - Document workarounds or blockers

3. **Regression:**
   - Re-run failed scenarios after fixes
   - Run full happy path scenarios before release
   - Verify no new issues introduced by fixes

---

## 📈 Performance Benchmarks

### SmartMock
| Metric              | Target | Notes                     |
| ------------------- | ------ | ------------------------- |
| Landing Page Load   | < 2s   | First contentful paint    |
| Login Response      | < 1s   | Authentication API call   |
| Assessment Load     | < 3s   | Questions fetch + render  |
| Monaco Editor Load  | < 2s   | Syntax highlighting ready |
| Answer Submission   | < 1s   | API response time         |
| Auto-Submit Trigger | < 2s   | On timer/violation        |

### Talens
| Metric                 | Target | Notes                                |
| ---------------------- | ------ | ------------------------------------ |
| System Check Execution | < 15s  | All 3 checks (mic, internet, WebRTC) |
| Interview Page Load    | < 3s   | Including interview plan fetch       |
| WebRTC Connection      | < 5s   | On stable network                    |
| AI Response Latency    | < 2s   | Depends on Azure OpenAI load         |
| Audio Quality Update   | 3-5s   | Frequency of quality monitoring      |
| Reconnection Attempt   | 5s     | Interval between retries             |
| All SmartMock Metrics  | Same   | Inherited features                   |

### Admin
| Metric                | Target | Notes                             |
| --------------------- | ------ | --------------------------------- |
| Dashboard Load        | < 3s   | Includes KPI data fetch           |
| Question Creation     | < 2s   | Save to backend                   |
| Test Initiation       | < 3s   | Code generation + save            |
| Report Load           | < 4s   | Submission + proctoring + scoring |
| Analytics Load        | < 5s   | Chart rendering                   |
| Smart Screen Analysis | < 30s  | AI resume processing              |

---

## 🔒 Security Testing Checklist

### Authentication & Authorization
- [ ] **Invalid credentials rejected** (all apps)
- [ ] **Expired tokens handled gracefully** (auto-logout)
- [ ] **Protected routes require authentication** (redirect to login)
- [ ] **Admin routes not accessible to candidates**
- [ ] **Candidate data isolated by session** (no cross-candidate data leaks)

### Input Validation
- [ ] **XSS prevention:** HTML/script tags in question text are escaped
- [ ] **SQL/NoSQL injection:** Special characters in search/filter inputs don't break queries
- [ ] **File upload validation:** Only PDF files accepted for resumes (Smart Screen)
- [ ] **Assessment code validation:** Only valid codes allow login

### Proctoring & Integrity
- [ ] **Timer cannot be manipulated** (server-side validation)
- [ ] **Copy/paste blocked** in assessment questions
- [ ] **Tab switching tracked** and enforced (auto-submit after limit)
- [ ] **Fullscreen enforcement** (exit detection and re-activation)
- [ ] **Network tampering detected** (WebRTC quality monitoring in Talens)

### Data Privacy
- [ ] **Candidate data encrypted** in transit (HTTPS)
- [ ] **Tokens not exposed** in URLs or logs
- [ ] **Proctoring events anonymized** in analytics
- [ ] **Interview transcripts secure** (access controlled)

---

## 🐛 Known Issues & Workarounds

### SmartMock
1. **Issue:** Fullscreen on dual monitors may not cover both screens  
   **Workaround:** Use single monitor or primary display  
   **Severity:** Low

2. **Issue:** Copy/paste from PDF viewers sometimes not blocked  
   **Workaround:** Additional backend validation  
   **Severity:** Medium

### Talens
1. **Issue:** Safari has limited WebRTC support (audio quality may be poor)  
   **Workaround:** Use Chrome or Edge for live interview  
   **Severity:** High

2. **Issue:** Slow networks (< 1 Mbps) cause frequent reconnections  
   **Workaround:** Recommend stable internet, show quality warnings  
   **Severity:** Medium

3. **Issue:** Microphone echo on some devices  
   **Workaround:** Recommend headphones  
   **Severity:** Low

### Admin
1. **Issue:** Loading 1000+ questions is slow (no pagination)  
   **Workaround:** Implement pagination or lazy loading  
   **Severity:** Medium

2. **Issue:** PDF report export may timeout on large submissions  
   **Workaround:** Generate reports asynchronously  
   **Severity:** Low

3. **Issue:** Dashboard requires manual refresh (no real-time updates)  
   **Workaround:** Add auto-refresh or WebSocket updates  
   **Severity:** Low

---

## 📝 Test Execution Summary

### Execution Order (Recommended)

**Week 1: Critical Scenarios**
- Day 1: SmartMock Critical (12 scenarios) - 4-6 hours
- Day 2: Talens Critical (15 scenarios) - 6-8 hours
- Day 3: Admin Critical (13 scenarios) - 5-7 hours
- Day 4: Cross-application Critical (4 scenarios) - 3-4 hours

**Week 2: High Priority**
- Day 1: SmartMock High (5 scenarios) - 2-3 hours
- Day 2: Talens High (4 scenarios) - 2-3 hours
- Day 3: Admin High (6 scenarios) - 3-4 hours

**Week 3: Medium Priority & Regression**
- Day 1: All Medium scenarios (5 scenarios) - 2-3 hours
- Day 2: Full regression (Happy Path scenarios) - 4-5 hours
- Day 3: Bug fixes and re-testing - variable

**Total Estimated Time:** 35-45 hours

### Reporting Template

**Test Execution Report - [Date]**

**Tester:** [Name]  
**Environment:** [Dev/Staging/Prod]  
**Browser:** [Chrome 120, Edge 119, etc.]

**Summary:**
- Total Scenarios Executed: X/60
- Passed: X
- Failed: X
- Blocked: X
- Pass Rate: X%

**Critical Issues:**
1. [Issue description] - Scenario ADM-E2E-XXX
2. [Issue description] - Scenario TAL-E2E-XXX

**Medium Issues:**
1. [Issue description]
2. [Issue description]

**Recommendations:**
- [Recommendation 1]
- [Recommendation 2]

**Next Steps:**
- [Action item 1]
- [Action item 2]

---

## 🔗 Quick Links

### Testing Documents
- [SmartMock E2E Testing](./E2E_TESTING_SMARTMOCK.md) - 20 scenarios
- [Talens E2E Testing](./E2E_TESTING_TALENS.md) - 20 scenarios
- [Admin E2E Testing](./E2E_TESTING_ADMIN.md) - 20 scenarios

### Additional Documentation
- [API Endpoints Summary](./docs/API_ENDPOINTS_SUMMARY.md)
- [Hybrid Scoring Implementation](./docs/HYBRID_SCORING_IMPLEMENTATION.md)
- [Server-Authoritative Assessment](./docs/server-authoritative-assessment.md)
- [Red Teaming Test Cases](./docs/red-teaming-test-cases.md)
- [Testing Guide](./docs/testing-guide.md)

### External Resources
- [Backend README](./backend/README.md)
- [Frontend README](./frontend/README.md)
- [API Documentation](http://localhost:8000/docs) (when backend running)

---

## ✅ Pre-Release Checklist

### Code Quality
- [ ] All TypeScript errors resolved (0 errors)
- [ ] All ESLint warnings addressed
- [ ] Code formatted with Prettier
- [ ] No console.log statements in production code
- [ ] All commented-out code removed

### Testing
- [ ] All Critical scenarios passed (40/40)
- [ ] All High priority scenarios passed (14/15 minimum)
- [ ] Happy path scenarios passed (7/7)
- [ ] Cross-application scenarios passed (4/4)
- [ ] Performance benchmarks met (90%+)

### Security
- [ ] Authentication tested (valid and invalid)
- [ ] Authorization tested (protected routes)
- [ ] Input validation tested (XSS, injection)
- [ ] Proctoring features tested (timer, violations)
- [ ] Data privacy verified (no leaks)

### Documentation
- [ ] E2E test scenarios documented
- [ ] Known issues documented with workarounds
- [ ] API endpoints documented
- [ ] Environment setup documented
- [ ] Deployment guide reviewed

### Infrastructure
- [ ] Backend running stable (no crashes in 24 hours)
- [ ] Frontend builds successfully (all 3 apps)
- [ ] Database migrations applied
- [ ] Azure OpenAI configured and tested
- [ ] Judge0 API configured and tested
- [ ] Monitoring and logging enabled

### User Acceptance
- [ ] Admin tested complete workflow (create → monitor → report)
- [ ] Candidate tested assessment flow (SmartMock)
- [ ] Candidate tested interview flow (Talens)
- [ ] Stakeholders signed off on features
- [ ] User feedback incorporated

---

## 📞 Support & Contact

**For Testing Issues:**
- Review individual E2E documents for detailed steps
- Check Known Issues section for workarounds
- Review backend logs: `backend/logs/`
- Check browser console for frontend errors

**For Environment Issues:**
- Verify all services running (backend, 3 frontends)
- Check environment variables configured
- Verify database connection
- Check Azure OpenAI and Judge0 API credentials

**For Reporting Bugs:**
- Use GitHub Issues with template
- Include: Steps to reproduce, expected vs actual, screenshots, logs
- Tag with severity: Critical, High, Medium, Low
- Assign to appropriate team member

---

**Document Version:** 1.0  
**Last Updated:** October 3, 2025  
**Next Review:** After first production release  
**Maintained by:** QA Team
