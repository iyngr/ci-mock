# End-to-End Testing Scenarios - SmartMock App

**App:** SmartMock (Traditional Assessment Experience)  
**Location:** `frontend/apps/smartmock/`  
**Purpose:** Code-first technical assessment with proctoring  
**Date:** October 3, 2025

---

## App Overview

**SmartMock** is the traditional technical assessment application featuring:
- Code-based questions (MCQ, Descriptive, Coding)
- Monaco Editor integration for coding questions
- Comprehensive proctoring (tab switches, copy/paste detection, fullscreen enforcement)
- Timer-based assessments with grace period
- Auto-submission on violations or time expiry

---

## Test Environment Setup

### Prerequisites
```bash
# Terminal 1: Backend
cd backend
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: SmartMock Frontend
cd frontend/apps/smartmock
pnpm dev
```

**URLs:**
- SmartMock App: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Test Data Required
- **Admin Credentials:** admin@example.com / admin123
- **Test Assessment Code:** (Generated via Admin → Initiate Test)
- **Sample Questions:** At least 3 questions (1 MCQ, 1 Descriptive, 1 Coding)

---

## E2E Test Scenarios

### Scenario 1: Landing Page & Navigation

**Test ID:** SM-E2E-001  
**Priority:** Critical  
**User Role:** Any

#### Test Steps
1. Navigate to http://localhost:3000
2. Verify landing page loads successfully
3. Check hero section displays "Smart Mock" title
4. Verify tagline: "Intelligent Technical Assessment Platform"
5. Check two action buttons are visible:
   - "I'm a Candidate" (primary button)
   - "I'm an Admin" (outline button)
6. Verify features section displays three cards:
   - AI-Powered Evaluation
   - Real-time Monitoring
   - Detailed Analytics

#### Expected Results
- ✅ Page loads without errors
- ✅ All UI elements render correctly
- ✅ Animations execute smoothly (fadeInUp)
- ✅ Buttons are clickable and styled correctly
- ✅ Background has subtle floating geometric elements
- ✅ Typography follows warm-brown design system

#### Test Data
- N/A

#### Screenshots/Evidence
- [ ] Landing page screenshot
- [ ] Features section screenshot

---

### Scenario 2: Candidate Login Flow

**Test ID:** SM-E2E-002  
**Priority:** Critical  
**User Role:** Candidate

#### Test Steps
1. From landing page, click "I'm a Candidate"
2. Verify redirect to `/candidate` login page
3. Check login form displays:
   - Assessment code input field
   - "Start Assessment" button
4. Leave assessment code empty and click "Start Assessment"
5. Verify error: "Assessment code is required"
6. Enter invalid assessment code: "INVALID123"
7. Click "Start Assessment"
8. Verify error message from backend
9. Enter valid assessment code (from Admin → Initiate Test)
10. Click "Start Assessment"
11. Verify successful authentication

#### Expected Results
- ✅ Redirects to `/candidate` page
- ✅ Login form renders with clean design
- ✅ Empty submission shows validation error
- ✅ Invalid code shows backend error message
- ✅ Valid code authenticates successfully
- ✅ localStorage stores:
   - candidateToken
   - candidateId
   - submissionId
   - testId
   - testTitle
   - durationMinutes
- ✅ Redirects to `/candidate/instructions`

#### Test Data
- **Valid Code:** (Generated via Admin → Initiate Test, e.g., "TEST-ABC-123")
- **Invalid Code:** "INVALID123"

#### Screenshots/Evidence
- [ ] Login page screenshot
- [ ] Error state screenshot
- [ ] Success redirect screenshot

---

### Scenario 3: Instructions & Consent Flow

**Test ID:** SM-E2E-003  
**Priority:** Critical  
**User Role:** Candidate (Authenticated)

#### Test Steps
1. After successful login, verify redirect to `/candidate/instructions`
2. Check instructions modal displays:
   - Test title
   - Duration
   - Total questions count
   - Proctoring rules
   - Consent checkbox
3. Try clicking "Start Assessment" without consent
4. Verify button is disabled
5. Check consent checkbox
6. Verify "Start Assessment" button becomes enabled
7. Click "Start Assessment"
8. Verify fullscreen request is triggered
9. Accept fullscreen (press F11 or allow browser prompt)
10. Verify redirect to `/candidate/assessment`

#### Expected Results
- ✅ Instructions page loads with test details
- ✅ Rules clearly displayed:
   - No tab switching
   - No copy/paste
   - Must remain in fullscreen
   - Timer enforcement
- ✅ Consent checkbox required before proceeding
- ✅ Fullscreen activated on assessment start
- ✅ Smooth transition to assessment page

#### Test Data
- N/A (uses data from login)

#### Screenshots/Evidence
- [ ] Instructions modal screenshot
- [ ] Consent checkbox state
- [ ] Fullscreen activation

---

### Scenario 4: Assessment - MCQ Question

**Test ID:** SM-E2E-004  
**Priority:** Critical  
**User Role:** Candidate (In Assessment)

#### Test Steps
1. On assessment page, verify UI elements:
   - Timer display (top right)
   - Question counter (e.g., "Question 1 of 5")
   - MCQ question text
   - Radio button options (A, B, C, D)
   - "Next Question" button
2. Verify timer counts down in real-time
3. Select an option (e.g., Option B)
4. Verify radio button selection works
5. Click "Next Question"
6. Verify answer is saved (check console/network)
7. Verify navigation to next question

#### Expected Results
- ✅ MCQ question displays correctly
- ✅ Radio buttons are mutually exclusive
- ✅ Selected option is visually highlighted
- ✅ Timer updates every second
- ✅ Answer submission succeeds
- ✅ Question navigation works smoothly
- ✅ Progress indicator updates (1/5 → 2/5)

#### Test Data
- **Question Type:** MCQ
- **Options:** 4 choices (A, B, C, D)

#### Screenshots/Evidence
- [ ] MCQ question screenshot
- [ ] Selected option state
- [ ] Network request for answer submission

---

### Scenario 5: Assessment - Descriptive Question

**Test ID:** SM-E2E-005  
**Priority:** High  
**User Role:** Candidate (In Assessment)

#### Test Steps
1. Navigate to descriptive question (Question 2)
2. Verify UI displays:
   - Question text
   - Large textarea for answer
   - Character count (if present)
   - "Next Question" button
3. Type answer in textarea: "This is my descriptive answer explaining..."
4. Verify text input works smoothly
5. Verify textarea auto-expands or scrolls
6. Click "Next Question"
7. Verify answer is saved
8. Navigate back to Question 2 (if navigation allowed)
9. Verify answer persists

#### Expected Results
- ✅ Descriptive question renders correctly
- ✅ Textarea accepts multi-line input
- ✅ Text formatting is preserved
- ✅ Answer saves successfully
- ✅ Answer persists on navigation (if allowed)
- ✅ No character limit errors (unless specified)

#### Test Data
- **Question Type:** Descriptive
- **Sample Answer:** "This is my descriptive answer explaining the concept of polymorphism in object-oriented programming..."

#### Screenshots/Evidence
- [ ] Descriptive question screenshot
- [ ] Filled textarea state
- [ ] Answer persistence verification

---

### Scenario 6: Assessment - Coding Question (Monaco Editor)

**Test ID:** SM-E2E-006  
**Priority:** Critical  
**User Role:** Candidate (In Assessment)

#### Test Steps
1. Navigate to coding question (Question 3)
2. Verify Monaco Editor loads:
   - Syntax highlighting enabled
   - Line numbers visible
   - Theme: VS Dark or light
   - Language selector (if present)
3. Verify starter code is pre-filled (if provided)
4. Write a function in the editor:
   ```python
   def fibonacci(n):
       if n <= 1:
           return n
       return fibonacci(n-1) + fibonacci(n-2)
   ```
5. Verify syntax highlighting updates in real-time
6. Test editor features:
   - Tab indentation works
   - Auto-completion (if enabled)
   - Bracket matching
7. Click "Run Code" (if available)
8. Verify code execution and output display
9. Click "Next Question" or "Submit"
10. Verify code submission succeeds

#### Expected Results
- ✅ Monaco Editor loads without errors
- ✅ Syntax highlighting works for selected language
- ✅ Code editing is smooth and responsive
- ✅ Editor features work (indentation, matching)
- ✅ Code runs successfully (if run button present)
- ✅ Output displays correctly
- ✅ Code submission succeeds
- ✅ Code is saved to backend

#### Test Data
- **Question Type:** Coding
- **Language:** Python
- **Sample Code:** Fibonacci function

#### Screenshots/Evidence
- [ ] Monaco Editor screenshot
- [ ] Code execution output
- [ ] Network request for code submission

---

### Scenario 7: Proctoring - Tab Switch Detection

**Test ID:** SM-E2E-007  
**Priority:** Critical  
**User Role:** Candidate (In Assessment)

#### Test Steps
1. While on assessment page (any question)
2. Press `Alt+Tab` to switch to another window/tab
3. Return to assessment tab
4. Verify warning modal appears:
   - Title: "Warning 1 of 3"
   - Message: "You attempted to exit the assessment window..."
   - Shows remaining warnings count
5. Click "Return to Assessment"
6. Verify modal closes and assessment resumes
7. Switch tabs again (Warning 2)
8. Return and dismiss warning
9. Switch tabs a third time (Warning 3)
10. Verify assessment is auto-submitted after 3 violations

#### Expected Results
- ✅ Tab switch detected immediately
- ✅ Warning modal appears (fullscreen overlay, z-index 9999)
- ✅ Violation count increments (1/3, 2/3, 3/3)
- ✅ Proctoring event logged to backend
- ✅ After 3 violations, assessment auto-submits
- ✅ Redirect to success page with violation message

#### Test Data
- **Max Violations:** 3 tab switches

#### Screenshots/Evidence
- [ ] Warning modal screenshot (Warning 1/3)
- [ ] Auto-submission after 3 violations
- [ ] Backend proctoring log

---

### Scenario 8: Proctoring - Copy/Paste Detection

**Test ID:** SM-E2E-008  
**Priority:** High  
**User Role:** Candidate (In Assessment)

#### Test Steps
1. On descriptive or coding question
2. Select text in the question or editor
3. Press `Ctrl+C` (copy)
4. Verify notification appears: "Copy action detected..."
5. Click close on notification
6. Press `Ctrl+V` (paste) in textarea/editor
7. Verify notification appears: "Paste action detected..."
8. Verify paste is blocked (no text pasted)
9. Press `Ctrl+X` (cut)
10. Verify notification appears: "Cut action detected..."
11. Verify proctoring events logged

#### Expected Results
- ✅ Copy action detected and logged
- ✅ Paste action blocked and logged
- ✅ Cut action detected and logged
- ✅ Notifications appear (red toast, top-right)
- ✅ Notifications auto-dismiss after 3 seconds
- ✅ Multiple violations do NOT cause auto-submit (configurable limit)
- ✅ All events sent to backend proctoring log

#### Test Data
- **Sample Text:** "function test() { return true; }"

#### Screenshots/Evidence
- [ ] Copy detection notification
- [ ] Paste blocked notification
- [ ] Proctoring events in backend

---

### Scenario 9: Proctoring - Fullscreen Exit Detection

**Test ID:** SM-E2E-009  
**Priority:** Critical  
**User Role:** Candidate (In Assessment)

#### Test Steps
1. Ensure assessment is in fullscreen mode
2. Press `Esc` key to exit fullscreen
3. Verify warning modal appears immediately
4. Verify modal message: "You exited fullscreen mode..."
5. Click "Return to Assessment"
6. Verify fullscreen is re-activated
7. Exit fullscreen again (2nd violation)
8. Dismiss warning
9. Exit fullscreen a third time (if limit is 3)
10. Verify auto-submission (if configured)

#### Expected Results
- ✅ Fullscreen exit detected instantly
- ✅ Warning modal appears (cannot be dismissed easily)
- ✅ Fullscreen re-activated on "Return to Assessment"
- ✅ Violation counter increments
- ✅ Proctoring event logged
- ✅ After limit, assessment auto-submits
- ✅ Redirect to success page

#### Test Data
- **Max Fullscreen Exits:** 2-3 (configurable)

#### Screenshots/Evidence
- [ ] Fullscreen exit warning modal
- [ ] Auto-submission after limit

---

### Scenario 10: Timer Expiration & Grace Period

**Test ID:** SM-E2E-010  
**Priority:** Critical  
**User Role:** Candidate (In Assessment)

#### Test Steps
1. Start assessment (or use short duration for testing, e.g., 2 minutes)
2. Answer questions normally
3. When timer reaches 1 minute remaining:
   - Verify grace period warning modal appears
   - Message: "Your assessment will be submitted in 1 minute..."
4. Continue answering within grace period
5. When timer reaches 0:00:00:
   - Verify assessment auto-submits immediately
   - Verify redirect to success page
   - Verify "Auto-submitted (Time Expired)" message
6. Check backend for submission record
7. Verify all answers (completed or not) are saved

#### Expected Results
- ✅ Grace period warning appears at 1 minute
- ✅ Warning is dismissible but timer continues
- ✅ At 0:00, assessment force-submits
- ✅ No user action required for submission
- ✅ Redirect to success page within 2 seconds
- ✅ Success page shows auto-submission badge
- ✅ Backend has complete submission record
- ✅ Partial answers are saved

#### Test Data
- **Duration:** 2 minutes (for fast testing)
- **Grace Period:** 1 minute warning

#### Screenshots/Evidence
- [ ] Grace period warning modal
- [ ] Timer at 0:00:00
- [ ] Success page with auto-submit badge
- [ ] Backend submission record

---

### Scenario 11: Manual Submission (Complete Assessment)

**Test ID:** SM-E2E-011  
**Priority:** Critical  
**User Role:** Candidate (In Assessment)

#### Test Steps
1. Answer all questions in the assessment (MCQ, Descriptive, Coding)
2. Navigate to last question
3. Click "Submit Assessment" button
4. Verify confirmation modal appears:
   - "All questions answered. Submit now?"
5. Click "Cancel" (test cancel flow)
6. Verify modal closes and assessment continues
7. Click "Submit Assessment" again
8. Click "Confirm" in modal
9. Verify submission processing
10. Verify redirect to `/candidate/success`
11. Check success page displays:
    - "Assessment Submitted Successfully"
    - Test title
    - Submission timestamp
    - Thank you message

#### Expected Results
- ✅ Submit button available on last question
- ✅ Confirmation modal appears
- ✅ Cancel button works (returns to assessment)
- ✅ Confirm button submits assessment
- ✅ Loading state during submission
- ✅ Success redirect within 2 seconds
- ✅ Success page displays correctly
- ✅ Backend has complete submission
- ✅ All answers saved correctly

#### Test Data
- **Complete Assessment:** All 3+ questions answered

#### Screenshots/Evidence
- [ ] Confirmation modal
- [ ] Success page screenshot
- [ ] Backend submission record (via API)

---

### Scenario 12: Incomplete Assessment Submission

**Test ID:** SM-E2E-012  
**Priority:** High  
**User Role:** Candidate (In Assessment)

#### Test Steps
1. Answer only 2 out of 5 questions
2. Leave questions 3, 4, 5 unanswered
3. Try to submit assessment
4. Verify incomplete warning modal appears:
   - "You have 3 unanswered questions (Q3, Q4, Q5)"
   - "Are you sure you want to submit?"
5. Click "Cancel"
6. Verify return to assessment
7. Click Submit again
8. Click "Confirm" in incomplete modal
9. Verify submission succeeds
10. Verify success page shows "Assessment Submitted" (no auto-submit badge)

#### Expected Results
- ✅ Incomplete modal lists unanswered question numbers
- ✅ Clear warning message displayed
- ✅ Cancel button works
- ✅ Confirm button submits partial assessment
- ✅ Backend accepts partial submission
- ✅ Unanswered questions saved as null/empty
- ✅ Success page displays normally

#### Test Data
- **Total Questions:** 5
- **Answered:** 2 (Q1, Q2)
- **Unanswered:** 3 (Q3, Q4, Q5)

#### Screenshots/Evidence
- [ ] Incomplete warning modal
- [ ] Success page
- [ ] Backend record showing partial answers

---

### Scenario 13: Network Interruption Handling

**Test ID:** SM-E2E-013  
**Priority:** Medium  
**User Role:** Candidate (In Assessment)

#### Test Steps
1. Start assessment and answer Question 1
2. Open browser DevTools → Network tab
3. Simulate offline: Set throttling to "Offline"
4. Try to navigate to next question
5. Verify error handling:
   - Error message: "Failed to save answer. Please check your connection."
   - Answer NOT lost (still in UI)
6. Re-enable network
7. Click "Next Question" again
8. Verify answer saves successfully
9. Verify assessment continues normally

#### Expected Results
- ✅ Offline state detected
- ✅ Error message displayed clearly
- ✅ Answer data preserved in UI
- ✅ No data loss on network failure
- ✅ Retry succeeds when network restored
- ✅ Assessment resumes without issues

#### Test Data
- **Network State:** Offline → Online
- **Question:** Any question type

#### Screenshots/Evidence
- [ ] Error message on network failure
- [ ] Successful retry after reconnection
- [ ] Network tab showing failed/successful requests

---

### Scenario 14: Browser Refresh During Assessment

**Test ID:** SM-E2E-014  
**Priority:** Medium  
**User Role:** Candidate (In Assessment)

#### Test Steps
1. Start assessment and answer 2 questions
2. Press `F5` or `Ctrl+R` to refresh the page
3. Verify behavior:
   - Option A: Redirected to login (session lost)
   - Option B: Assessment reloads with progress preserved
4. If redirected to login:
   - Re-login with same code
   - Verify redirect to assessment
   - Verify previous answers are preserved
5. If assessment reloads:
   - Verify question progress restored (e.g., on Question 3)
   - Verify previous answers are shown

#### Expected Results
- ✅ Refresh handling is graceful (no crashes)
- ✅ Either session persists or requires re-authentication
- ✅ Previous answers are NOT lost
- ✅ Assessment state restored from backend
- ✅ Timer continues from saved state
- ✅ No duplicate submissions

#### Test Data
- **Questions Answered:** 2 out of 5
- **Current Question:** Question 3

#### Screenshots/Evidence
- [ ] State before refresh
- [ ] State after refresh
- [ ] Backend session/submission record

---

### Scenario 15: Success Page & Completion

**Test ID:** SM-E2E-015  
**Priority:** High  
**User Role:** Candidate (Completed Assessment)

#### Test Steps
1. Complete and submit assessment
2. Verify redirect to `/candidate/success`
3. Check success page displays:
   - Success icon (checkmark)
   - "Assessment Submitted Successfully" heading
   - Test title
   - Submission timestamp
   - Thank you message
   - Next steps (if any)
4. Verify no "Back" or "Edit" buttons (submission is final)
5. Try to navigate back to assessment (`/candidate/assessment`)
6. Verify redirect back to success page (cannot re-take)
7. Check localStorage for submission status
8. Log out (if logout option available)

#### Expected Results
- ✅ Success page loads without errors
- ✅ All completion details displayed
- ✅ Professional, polished UI
- ✅ Cannot navigate back to assessment
- ✅ Assessment is finalized in backend
- ✅ Submission marked as complete
- ✅ Candidate cannot re-submit

#### Test Data
- **Submission:** Complete or partial assessment

#### Screenshots/Evidence
- [ ] Success page screenshot
- [ ] Backend submission status (via API)
- [ ] Redirect behavior from assessment URL

---

## Proctoring Event Logs

### Expected Proctoring Events (Backend Logs)

All proctoring events should be logged to backend via:
```
POST /api/candidate/assessment/{submissionId}/proctoring
```

**Event Types Logged:**
1. `tab_switch` - User switched tabs/windows
2. `window_blur` - Window lost focus
3. `fullscreen_exit` - User exited fullscreen
4. `copy_attempt` - Copy action detected
5. `paste_attempt` - Paste action detected
6. `cut_attempt` - Cut action detected
7. `context_menu` - Right-click menu opened
8. `keyboard_shortcut` - Suspicious keyboard shortcut (e.g., F12)

**Validation:**
- ✅ Each event includes timestamp
- ✅ Event details (type, context) are accurate
- ✅ Events are sent immediately (not batched)
- ✅ Backend stores events with submissionId

---

## Admin View Testing

### Scenario 16: View Submission Report (Admin)

**Test ID:** SM-E2E-016  
**Priority:** High  
**User Role:** Admin

#### Test Steps
1. Log in as admin (admin@example.com / admin123)
2. Navigate to Dashboard
3. View recent submissions list
4. Click on a candidate submission
5. Verify report page displays:
   - Candidate details
   - Test title
   - Submission timestamp
   - All answers (MCQ, Descriptive, Coding)
   - Proctoring events (tab switches, violations)
   - Time taken
   - Auto-submission status (if applicable)
6. Check MCQ answers show selected option
7. Check descriptive answers show full text
8. Check coding answers show full code
9. Verify proctoring event timeline

#### Expected Results
- ✅ Report page loads successfully
- ✅ All submission data displayed accurately
- ✅ Answers are formatted correctly
- ✅ Proctoring events are listed with timestamps
- ✅ Violations are highlighted (if any)
- ✅ Admin can export/download report (if feature exists)

#### Test Data
- **Submission:** Any completed assessment

#### Screenshots/Evidence
- [ ] Report page screenshot
- [ ] Proctoring events section
- [ ] Answer display (all question types)

---

## Performance Testing

### Scenario 17: Load Testing - Monaco Editor

**Test ID:** SM-E2E-017  
**Priority:** Medium  
**User Role:** Candidate (In Assessment)

#### Test Steps
1. Navigate to coding question
2. Paste large code file (~1000 lines)
3. Verify editor performance:
   - Syntax highlighting loads within 2 seconds
   - No UI freezing or lag
   - Smooth scrolling
4. Type rapidly in editor
5. Verify no input lag
6. Run code (if run feature exists)
7. Verify output displays within 5 seconds

#### Expected Results
- ✅ Monaco Editor handles large files
- ✅ No performance degradation
- ✅ Syntax highlighting remains responsive
- ✅ Typing is smooth (no input lag)
- ✅ Code execution completes within reasonable time

#### Test Data
- **Code File:** 1000+ lines of Python code

---

## Accessibility Testing

### Scenario 18: Keyboard Navigation

**Test ID:** SM-E2E-018  
**Priority:** Medium  
**User Role:** Candidate

#### Test Steps
1. Start assessment
2. Use `Tab` key to navigate through UI elements
3. Verify focus indicators are visible
4. Navigate MCQ options using `Arrow` keys
5. Select option using `Space` or `Enter`
6. Navigate to "Next Question" button using `Tab`
7. Press `Enter` to proceed
8. Verify keyboard-only navigation works for entire assessment

#### Expected Results
- ✅ All interactive elements are keyboard-accessible
- ✅ Focus indicators visible (outline/border)
- ✅ Logical tab order
- ✅ MCQ selection works with keyboard
- ✅ Buttons activate with `Enter` or `Space`
- ✅ No keyboard traps

---

## Security Testing

### Scenario 19: Token Validation

**Test ID:** SM-E2E-019  
**Priority:** Critical  
**User Role:** Candidate

#### Test Steps
1. Log in and start assessment
2. Open browser DevTools → Application → Local Storage
3. Note the `candidateToken`
4. Modify token value to invalid string
5. Try to navigate to next question or submit
6. Verify backend rejects request (401 Unauthorized)
7. Verify redirect to login page
8. Clear localStorage and try to access `/candidate/assessment` directly
9. Verify redirect to login

#### Expected Results
- ✅ Invalid token is rejected by backend
- ✅ User redirected to login on auth failure
- ✅ Cannot access protected routes without valid token
- ✅ Session state is validated server-side

---

## Regression Testing

### Scenario 20: Full User Journey (Happy Path)

**Test ID:** SM-E2E-020  
**Priority:** Critical  
**User Role:** Candidate (Complete Flow)

#### Test Steps - Complete End-to-End Flow
1. **Landing:** Navigate to SmartMock homepage
2. **Candidate Login:** Click "I'm a Candidate" → Enter valid code → Submit
3. **Instructions:** Read instructions → Check consent → Click "Start Assessment"
4. **Fullscreen:** Accept fullscreen mode
5. **Assessment:**
   - Q1 (MCQ): Select option → Next
   - Q2 (Descriptive): Type answer → Next
   - Q3 (Coding): Write code → Run (if available) → Next
   - Q4 (MCQ): Select option → Next
   - Q5 (Descriptive): Type answer → Submit Assessment
6. **Confirmation:** Confirm submission in modal
7. **Success:** Verify success page displays
8. **Admin View:** Admin logs in → Views submission report

#### Expected Results
- ✅ Complete flow works without errors
- ✅ Each step transitions smoothly
- ✅ All data persists correctly
- ✅ Submission is recorded in backend
- ✅ Admin can view complete report
- ✅ No console errors
- ✅ No UI glitches
- ✅ Total time: ~5-10 minutes (depending on question difficulty)

#### Screenshots/Evidence
- [ ] Video recording of complete flow
- [ ] Screenshot at each major step
- [ ] Backend submission record

---

## Test Metrics & Success Criteria

### Coverage Targets
- **Critical Scenarios:** 100% pass rate
- **High Priority:** 95% pass rate
- **Medium Priority:** 90% pass rate

### Performance Benchmarks
- **Page Load:** < 2 seconds (landing, login)
- **Assessment Load:** < 3 seconds (questions fetch)
- **Monaco Editor Load:** < 2 seconds (first render)
- **Answer Submission:** < 1 second (API response)
- **Auto-Submit Trigger:** < 2 seconds (on timer/violation)

### Browser Support
- ✅ Chrome 90+ (primary)
- ✅ Firefox 88+
- ✅ Edge 90+
- ✅ Safari 14+ (macOS)

### Device Support
- ✅ Desktop (1920x1080, 1366x768)
- ✅ Laptop (1440x900, 1366x768)
- ⚠️ Tablet (limited - proctoring may be restricted)
- ❌ Mobile (not supported - screen size too small)

---

## Known Issues & Limitations

1. **Fullscreen on Dual Monitors:** May not cover both screens
2. **Copy/Paste from PDF:** Some users report paste blocks from PDFs work unexpectedly
3. **Monaco Editor on Safari:** Occasional syntax highlighting delays
4. **Network Errors:** Retry logic may need improvement for flaky connections

---

## Test Execution Log

| Test ID    | Scenario          | Status    | Date | Tester | Notes |
| ---------- | ----------------- | --------- | ---- | ------ | ----- |
| SM-E2E-001 | Landing Page      | ⏳ Pending | -    | -      | -     |
| SM-E2E-002 | Candidate Login   | ⏳ Pending | -    | -      | -     |
| SM-E2E-003 | Instructions      | ⏳ Pending | -    | -      | -     |
| SM-E2E-004 | MCQ Question      | ⏳ Pending | -    | -      | -     |
| SM-E2E-005 | Descriptive Q     | ⏳ Pending | -    | -      | -     |
| SM-E2E-006 | Coding Q          | ⏳ Pending | -    | -      | -     |
| SM-E2E-007 | Tab Switch        | ⏳ Pending | -    | -      | -     |
| SM-E2E-008 | Copy/Paste        | ⏳ Pending | -    | -      | -     |
| SM-E2E-009 | Fullscreen Exit   | ⏳ Pending | -    | -      | -     |
| SM-E2E-010 | Timer Expiry      | ⏳ Pending | -    | -      | -     |
| SM-E2E-011 | Manual Submit     | ⏳ Pending | -    | -      | -     |
| SM-E2E-012 | Incomplete Submit | ⏳ Pending | -    | -      | -     |
| SM-E2E-013 | Network Fail      | ⏳ Pending | -    | -      | -     |
| SM-E2E-014 | Browser Refresh   | ⏳ Pending | -    | -      | -     |
| SM-E2E-015 | Success Page      | ⏳ Pending | -    | -      | -     |
| SM-E2E-016 | Admin Report      | ⏳ Pending | -    | -      | -     |
| SM-E2E-017 | Load Test         | ⏳ Pending | -    | -      | -     |
| SM-E2E-018 | Accessibility     | ⏳ Pending | -    | -      | -     |
| SM-E2E-019 | Security          | ⏳ Pending | -    | -      | -     |
| SM-E2E-020 | Happy Path        | ⏳ Pending | -    | -      | -     |

**Legend:**
- ✅ Pass
- ❌ Fail
- ⏳ Pending
- ⚠️ Partial Pass (with issues)

---

## Next Steps

1. Execute all Critical (Priority) test scenarios
2. Document failures with screenshots/logs
3. Create bug tickets for any issues found
4. Re-test after fixes
5. Execute High and Medium priority scenarios
6. Perform exploratory testing for edge cases
7. Final regression before production deployment

---

**Document Version:** 1.0  
**Last Updated:** October 3, 2025  
**Next Review:** After SmartMock deployment
