# End-to-End Testing Scenarios - Talens App

**App:** Talens (Enhanced Assessment Experience with AI Interview)  
**Location:** `frontend/apps/talens/`  
**Purpose:** Advanced assessment with system checks, AI-powered live interview, and comprehensive monitoring  
**Date:** October 3, 2025

---

## App Overview

**Talens** is the enhanced technical assessment application featuring all SmartMock features PLUS:

### Phase 1 Integrations
- ✅ Server-authoritative timer sync
- ✅ Auto-submission tracking with grace period warnings
- ✅ Assessment readiness checks (generation progress)
- ✅ Real-time status monitoring

### Phase 2 Integrations
- ✅ System Check Modal (pre-assessment validation)
- ✅ Microphone permission and quality testing
- ✅ Internet connectivity verification
- ✅ WebRTC capabilities detection
- ✅ Device compatibility checks

### Phase 3 Integrations
- ✅ WebRTC Realtime Audio Client
- ✅ Adaptive bitrate control for audio quality
- ✅ Network quality monitoring
- ✅ Audio quality metrics (latency, jitter, packet loss)
- ✅ Automatic reconnection handling

### Phase 4 Integrations
- ✅ AI-Powered Live Interview Experience
- ✅ Real-time conversation with GPT-4o Realtime API
- ✅ Visual AI state indicators (idle, listening, speaking, thinking)
- ✅ Conversation transcript with finalized turns
- ✅ Audio quality badges (excellent, good, poor, critical)
- ✅ Connection status monitoring with reconnection attempts
- ✅ Interview plan display with role and sections
- ✅ End interview flow with confirmation modal

### SmartMock Features (Inherited)
- Code-based questions (MCQ, Descriptive, Coding)
- Monaco Editor integration
- Comprehensive proctoring
- Timer-based assessments
- Auto-submission on violations

---

## Test Environment Setup

### Prerequisites
```powershell
# Terminal 1: Backend
cd backend
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Talens Frontend
cd frontend/apps/talens
pnpm dev
```

**URLs:**
- Talens App: http://localhost:3001 (or configured port)
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Test Data Required
- **Admin Credentials:** admin@example.com / admin123
- **Test Assessment Code:** (Generated via Admin → Initiate Test with live_interview: true)
- **Azure OpenAI Credentials:** Valid endpoint and API key (for live interview)
- **Microphone Access:** Required for live interview testing
- **Stable Internet:** Required for WebRTC quality tests

---

## E2E Test Scenarios

### Scenario 1: Landing Page & Navigation

**Test ID:** TAL-E2E-001  
**Priority:** Critical  
**User Role:** Any

#### Test Steps
1. Navigate to Talens homepage (http://localhost:3001)
2. Verify landing page loads successfully
3. Check hero section displays "Smart Mock" title (shared branding)
4. Verify tagline: "Intelligent Technical Assessment Platform"
5. Check two action buttons:
   - "I'm a Candidate" (primary button)
   - "I'm an Admin" (outline button)
6. Verify features section displays:
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

---

### Scenario 2: Candidate Login Flow

**Test ID:** TAL-E2E-002  
**Priority:** Critical  
**User Role:** Candidate

#### Test Steps
1. From landing page, click "I'm a Candidate"
2. Verify redirect to `/candidate` login page
3. Check login form displays assessment code input
4. Enter valid assessment code (with live_interview: true)
5. Click "Start Assessment"
6. Verify successful authentication
7. Verify localStorage stores:
   - candidateToken
   - candidateId
   - submissionId
   - testId
   - testTitle
   - durationMinutes
   - **interviewEnabled** (true)
   - **interviewPlan** (JSON with role, sections)

#### Expected Results
- ✅ Login form renders correctly
- ✅ Valid code authenticates successfully
- ✅ Interview-enabled flag is stored
- ✅ Interview plan (role, duration, sections) is retrieved
- ✅ Redirects to `/candidate/instructions`

#### Test Data
- **Valid Code:** TEST-LIVE-ABC (with live_interview: true)

---

### Scenario 3: Phase 1 - Assessment Readiness Check (Generating)

**Test ID:** TAL-E2E-003  
**Priority:** Critical  
**User Role:** Candidate (Authenticated)

#### Test Steps
1. Log in with assessment code for test that is currently generating questions
2. Verify redirect to `/candidate/instructions`
3. Check that **GenerationProgress** component displays:
   - Loading animation
   - "Generating your assessment..." message
   - Progress indicator: "2 of 5 questions ready"
   - Estimated time remaining
4. Wait for generation to complete
5. Verify automatic transition to System Check Modal

#### Expected Results
- ✅ Generation progress screen displays instead of instructions
- ✅ Real-time progress updates (poll every 3 seconds)
- ✅ Clean, professional loading UI
- ✅ Automatic transition when status changes to 'ready'
- ✅ No errors or crashes during waiting period

#### Test Data
- **Assessment Status:** generating
- **Ready Questions:** 2/5, then 5/5

---

### Scenario 4: Phase 1 - Assessment Readiness Check (Failed)

**Test ID:** TAL-E2E-004  
**Priority:** High  
**User Role:** Candidate (Authenticated)

#### Test Steps
1. Log in with assessment code for test that failed generation
2. Verify redirect to `/candidate/instructions`
3. Check that **AssessmentNotReady** component displays:
   - Error icon
   - "Assessment generation failed" message
   - Error details (if available)
   - "Refresh" button
4. Click "Refresh" button
5. Verify page reloads and re-checks status

#### Expected Results
- ✅ Error state displays clearly
- ✅ User-friendly error message
- ✅ Refresh button works
- ✅ No crash or infinite loop
- ✅ Contact support option (if available)

#### Test Data
- **Assessment Status:** generation_failed

---

### Scenario 5: Phase 2 - System Check Modal (First Launch)

**Test ID:** TAL-E2E-005  
**Priority:** Critical  
**User Role:** Candidate (Authenticated, Assessment Ready)

#### Test Steps
1. After login and readiness check passes, verify System Check Modal appears
2. Check modal displays all validation sections:
   - **Microphone Access** (unchecked initially)
   - **Internet Connectivity** (unchecked initially)
   - **WebRTC Support** (unchecked initially)
3. Click "Start System Check" button
4. Observe automatic validation sequence:
   - Step 1: Microphone permission request (browser prompt)
   - Step 2: Internet speed test (5-10 seconds)
   - Step 3: WebRTC capabilities check (2-3 seconds)
5. Grant microphone permission when prompted
6. Wait for all checks to complete
7. Verify all three sections show green checkmarks
8. Verify "Continue to Assessment" button becomes enabled
9. Click "Continue to Assessment"
10. Verify modal closes and instructions modal appears

#### Expected Results
- ✅ System Check Modal appears before instructions
- ✅ All three checks execute sequentially
- ✅ Microphone permission request appears
- ✅ Denying microphone shows clear error message
- ✅ Internet speed check completes (checks connectivity)
- ✅ WebRTC check validates browser support
- ✅ All checks pass → green checkmarks displayed
- ✅ "Continue" button disabled until all checks pass
- ✅ Smooth transition to instructions modal

#### Test Data
- **Browser:** Chrome/Edge (best WebRTC support)
- **Microphone:** Available and functional

#### Screenshots/Evidence
- [ ] System Check Modal (initial state)
- [ ] Microphone permission prompt
- [ ] All checks passed state
- [ ] Instructions modal after system check

---

### Scenario 6: Phase 2 - System Check Failures

**Test ID:** TAL-E2E-006  
**Priority:** High  
**User Role:** Candidate (Authenticated)

#### Test Steps

**Sub-Test 6A: Microphone Access Denied**
1. Launch System Check Modal
2. Click "Start System Check"
3. When browser prompts for microphone permission, click "Block"
4. Verify error message: "Microphone access denied. Please grant permission to continue."
5. Verify "Retry" button appears
6. Click "Retry"
7. Grant permission this time
8. Verify check passes

**Sub-Test 6B: Slow Internet Connection**
1. Use browser DevTools → Network → Set throttling to "Slow 3G"
2. Launch System Check Modal
3. Click "Start System Check"
4. Grant microphone permission
5. Wait for internet speed check
6. Verify warning message: "Slow internet detected. Interview quality may be affected."
7. Verify option to continue anyway or cancel

**Sub-Test 6C: WebRTC Not Supported**
1. Use old browser or disable WebRTC in settings
2. Launch System Check Modal
3. Click "Start System Check"
4. Verify error: "WebRTC not supported. Please use Chrome, Edge, or Firefox."
5. Verify "Continue" button remains disabled

#### Expected Results
- ✅ Microphone denial shows clear error with retry option
- ✅ Slow internet shows warning but allows continuation
- ✅ WebRTC unsupported blocks assessment start
- ✅ All error messages are user-friendly
- ✅ Retry buttons work correctly

#### Test Data
- **Network Throttling:** Slow 3G, Offline
- **Browser:** Chrome (WebRTC test), IE11 (no WebRTC)

---

### Scenario 7: Instructions & Consent Flow (with System Check Passed)

**Test ID:** TAL-E2E-007  
**Priority:** Critical  
**User Role:** Candidate (System Check Passed)

#### Test Steps
1. After System Check passes, verify instructions modal appears
2. Check instructions display:
   - Test title
   - Duration (e.g., 60 minutes)
   - Total questions count
   - **NEW:** "This assessment includes a live AI interview" badge
   - Proctoring rules
   - Consent checkbox
3. Verify consent checkbox is required
4. Check consent checkbox
5. Click "Start Assessment"
6. Verify fullscreen request
7. Accept fullscreen
8. Verify redirect to `/candidate/assessment` OR `/candidate/live-interview` (depending on test configuration)

#### Expected Results
- ✅ Instructions modal displays after system check
- ✅ Live interview badge is visible (if enabled)
- ✅ Consent checkbox required
- ✅ Fullscreen activation works
- ✅ Redirect to correct starting point (assessment or interview)

#### Test Data
- **Interview Enabled:** true
- **Starting Point:** assessment (questions first) or interview (interview first)

---

### Scenario 8: Phase 4 - Live Interview Launch

**Test ID:** TAL-E2E-008  
**Priority:** Critical  
**User Role:** Candidate (Authenticated, System Check Passed)

#### Test Steps
1. From instructions or after completing assessment questions, navigate to `/candidate/live-interview`
2. Verify interview page loads with:
   - Interview plan sidebar (role, duration, sections)
   - AI avatar in center (idle state, warm-brown/10 background)
   - Connection status indicator (disconnected)
   - Audio quality badge (checking...)
   - Control buttons (Microphone, End Interview)
3. Verify microphone button is in "muted" state initially
4. Click microphone button to unmute
5. Verify browser prompts for microphone permission (if not granted in system check)
6. Grant permission
7. Observe connection sequence:
   - Status changes to "Connecting..."
   - WebRTC session establishes
   - Status changes to "Connected"
   - Audio quality badge updates (Excellent/Good/Poor/Critical)
8. Verify AI avatar transitions to "listening" state (green glow)
9. Speak into microphone: "Hello, I'm ready for the interview"
10. Verify AI responds (avatar changes to "speaking" state, blue glow)
11. Wait for AI to finish speaking
12. Verify conversation transcript appears below avatar

#### Expected Results
- ✅ Interview page loads without errors
- ✅ Interview plan displays correctly (role, sections from backend)
- ✅ AI avatar renders with correct idle state
- ✅ Microphone permission works
- ✅ WebRTC connection establishes within 5 seconds
- ✅ Connection status updates in real-time
- ✅ Audio quality badge reflects network conditions
- ✅ AI avatar states transition correctly (idle → listening → speaking → listening)
- ✅ Conversation transcript displays user and AI turns
- ✅ Audio plays smoothly (AI voice)

#### Test Data
- **Azure OpenAI Endpoint:** Valid GPT-4o Realtime endpoint
- **API Key:** Valid Azure OpenAI API key
- **Role:** "Senior Full-Stack Developer"
- **Sections:** Technical skills, Problem-solving, System design

#### Screenshots/Evidence
- [ ] Interview page initial state
- [ ] Connection status: Connected
- [ ] Audio quality badge: Excellent
- [ ] AI avatar: Listening state
- [ ] AI avatar: Speaking state
- [ ] Conversation transcript

---

### Scenario 9: Phase 3 - Audio Quality Monitoring

**Test ID:** TAL-E2E-009  
**Priority:** High  
**User Role:** Candidate (In Live Interview)

#### Test Steps
1. Start live interview and connect successfully
2. Verify audio quality badge displays "Excellent" or "Good" (on stable network)
3. Open browser DevTools → Network → Set throttling to "Fast 3G"
4. Continue conversation
5. Verify audio quality badge updates to "Poor" or "Critical"
6. Verify quality metrics update in real-time:
   - Latency increases (shown in console or UI)
   - Jitter increases
   - Packet loss detected
7. Observe adaptive bitrate controller:
   - Audio bitrate reduces automatically
   - Audio quality degrades gracefully (no complete cutoff)
8. Reset network throttling to "No throttling"
9. Verify audio quality badge improves back to "Excellent" or "Good"
10. Verify audio bitrate increases automatically

#### Expected Results
- ✅ Audio quality badge reflects real network conditions
- ✅ Quality updates every 3-5 seconds
- ✅ Adaptive bitrate controller works:
   - Reduces bitrate on poor network (64kbps → 32kbps → 16kbps)
   - Increases bitrate on good network (16kbps → 32kbps → 64kbps)
- ✅ Audio remains functional even on "Poor" quality
- ✅ "Critical" quality shows warning to user
- ✅ No audio dropouts or complete disconnection on temporary network issues

#### Test Data
- **Network Conditions:** No throttling, Fast 3G, Slow 3G
- **Expected Quality:** Excellent → Good → Poor → Critical → Good

#### Screenshots/Evidence
- [ ] Quality badge: Excellent (good network)
- [ ] Quality badge: Poor (throttled network)
- [ ] Quality badge: Critical (severe throttling)
- [ ] Console logs showing bitrate adjustments

---

### Scenario 10: Phase 3 - Network Disconnection & Reconnection

**Test ID:** TAL-E2E-010  
**Priority:** Critical  
**User Role:** Candidate (In Live Interview)

#### Test Steps
1. Start live interview and establish connection
2. Conduct conversation with AI (speak 2-3 turns)
3. Open DevTools → Network → Set throttling to "Offline"
4. Verify connection status changes to "Reconnecting (1/5)..."
5. Wait 5 seconds
6. Verify reconnection attempt counter increments: "Reconnecting (2/5)..."
7. Wait for 3-4 reconnection attempts
8. Re-enable network (set throttling to "No throttling")
9. Verify connection restores:
   - Status changes to "Connected"
   - Audio quality badge updates
   - AI avatar returns to listening state
10. Continue conversation
11. Verify interview resumes normally (no data loss)

#### Expected Results
- ✅ Disconnection detected within 2-3 seconds
- ✅ Status changes to "Reconnecting (X/5)..."
- ✅ Reconnection attempts increment every 5 seconds
- ✅ Maximum 5 reconnection attempts before failure
- ✅ When network restored, connection re-establishes automatically
- ✅ Interview resumes without starting over
- ✅ Previous conversation history preserved
- ✅ No audio artifacts or crashes

#### Test Data
- **Network State:** Online → Offline (15 seconds) → Online

#### Screenshots/Evidence
- [ ] Connection status: Reconnecting (3/5)
- [ ] Connection status: Connected (after restore)
- [ ] Conversation transcript preserved

---

### Scenario 11: Phase 4 - AI Conversation Flow

**Test ID:** TAL-E2E-011  
**Priority:** Critical  
**User Role:** Candidate (In Live Interview)

#### Test Steps
1. Start live interview and connect
2. Verify AI initiates conversation: "Hello, I'm your AI interviewer. Let's begin with..."
3. Verify conversation transcript displays AI's opening message
4. Respond to AI: "Yes, I'm ready"
5. Verify transcript displays your response (as "User")
6. AI asks first technical question: "Can you explain dependency injection?"
7. Respond with detailed answer (30-60 seconds)
8. Verify AI avatar shows:
   - "Listening" state while you speak (green glow)
   - "Thinking" state briefly after you finish (amber glow)
   - "Speaking" state when AI responds (blue glow)
9. AI provides follow-up question or moves to next topic
10. Complete 3-5 conversation turns
11. Verify conversation transcript shows all turns in order:
   - AI: "Hello, I'm your AI interviewer..."
   - User: "Yes, I'm ready"
   - AI: "Can you explain dependency injection?"
   - User: "Dependency injection is a design pattern..."
   - AI: "Great, can you provide an example?"
12. Verify finalized turns are marked (checkmark or indicator)

#### Expected Results
- ✅ AI initiates conversation naturally
- ✅ AI listens to full user response (no interruption)
- ✅ AI provides relevant follow-up questions
- ✅ AI avatar states transition smoothly (listening → thinking → speaking)
- ✅ Conversation transcript displays all turns
- ✅ Finalized turns are visually distinguished from in-progress
- ✅ Conversation feels natural (not robotic)
- ✅ AI adapts questions based on candidate's responses

#### Test Data
- **Role:** Senior Full-Stack Developer
- **Topics:** Dependency Injection, RESTful APIs, Database Design
- **Duration:** 10-15 minutes

#### Screenshots/Evidence
- [ ] AI opening message in transcript
- [ ] AI avatar in "listening" state
- [ ] AI avatar in "thinking" state
- [ ] AI avatar in "speaking" state
- [ ] Complete conversation transcript (5+ turns)

---

### Scenario 12: Phase 4 - End Interview Flow

**Test ID:** TAL-E2E-012  
**Priority:** Critical  
**User Role:** Candidate (In Live Interview)

#### Test Steps
1. Conduct interview for at least 5 minutes
2. Click "End Interview" button (phone icon)
3. Verify confirmation modal appears:
   - Title: "End Interview?"
   - Message: "Are you sure you want to end the interview? This action cannot be undone."
   - Buttons: "Cancel", "End Interview"
4. Click "Cancel"
5. Verify modal closes and interview continues
6. Click "End Interview" again
7. Click "End Interview" in confirmation modal
8. Verify interview ends:
   - WebRTC connection closes
   - Connection status changes to "Disconnected"
   - AI avatar returns to "Idle" state
   - Conversation transcript is saved
9. Verify redirect to success page OR assessment page (if questions remain)
10. Check backend for interview transcript record

#### Expected Results
- ✅ "End Interview" button always visible
- ✅ Confirmation modal prevents accidental ending
- ✅ "Cancel" works correctly
- ✅ "End Interview" confirmation closes connection cleanly
- ✅ Conversation transcript saved to backend
- ✅ No errors or crashes on disconnect
- ✅ Redirect to appropriate next page
- ✅ Interview cannot be restarted once ended

#### Test Data
- **Interview Duration:** At least 5 minutes
- **Conversation Turns:** 3-5 turns minimum

#### Screenshots/Evidence
- [ ] End interview confirmation modal
- [ ] Disconnected state after ending
- [ ] Backend interview transcript record (via API)

---

### Scenario 13: Phase 4 - Interview Plan Display

**Test ID:** TAL-E2E-013  
**Priority:** Medium  
**User Role:** Candidate (In Live Interview)

#### Test Steps
1. Start live interview
2. Verify interview plan sidebar displays:
   - **Role:** "Senior Full-Stack Developer" (or configured role)
   - **Duration:** "30 minutes" (or configured duration)
   - **Sections:** (expand/collapse)
     - Technical Skills
       - JavaScript frameworks (React, Vue, Angular)
       - Backend technologies (Node.js, Python, Java)
       - Database systems (SQL, NoSQL)
     - Problem Solving
       - Algorithm design
       - Code optimization
       - Debugging strategies
     - System Design
       - Scalability considerations
       - Microservices architecture
       - API design
3. Verify sections are clearly organized
4. Verify plan matches backend configuration

#### Expected Results
- ✅ Interview plan renders correctly
- ✅ Role displayed prominently
- ✅ Duration shown (helps candidate pace themselves)
- ✅ Sections organized hierarchically
- ✅ Items under each section listed clearly
- ✅ Plan matches backend data (no hardcoded values)

#### Test Data
- **Backend Interview Plan:** JSON with role, duration, sections

---

### Scenario 14: Assessment Questions (SmartMock Features in Talens)

**Test ID:** TAL-E2E-014  
**Priority:** Critical  
**User Role:** Candidate (In Assessment)

#### Test Steps
1. After system check and instructions, navigate to `/candidate/assessment`
2. Verify assessment page displays (same as SmartMock):
   - Timer display (top right) - **Phase 1: Server-synced timer**
   - Question counter
   - MCQ/Descriptive/Coding questions
   - Monaco Editor for coding questions
3. Verify **Phase 1 features**:
   - Timer syncs with server every 30 seconds
   - Grace period warning at 1 minute remaining
   - Auto-submission tracking status (if enabled)
4. Answer all questions
5. Submit assessment
6. Verify redirect to success page OR live interview (if interview is after questions)

#### Expected Results
- ✅ All SmartMock features work in Talens
- ✅ Phase 1 timer sync prevents client-side manipulation
- ✅ Grace period warning appears correctly
- ✅ Auto-submission tracking displays if enabled
- ✅ Assessment submission succeeds
- ✅ Correct redirect based on configuration

#### Test Data
- **Questions:** 3-5 questions (MCQ, Descriptive, Coding)
- **Timer:** 30 minutes
- **Interview After:** true or false

---

### Scenario 15: Phase 1 - Timer Sync & Grace Period

**Test ID:** TAL-E2E-015  
**Priority:** Critical  
**User Role:** Candidate (In Assessment)

#### Test Steps
1. Start assessment with 5-minute duration (for testing)
2. Verify timer displays correctly (e.g., "05:00")
3. Open browser DevTools → Application → Local Storage
4. Modify `expirationTime` to add 10 minutes
5. Refresh page
6. Verify timer re-syncs with server (ignores local manipulation)
7. Continue assessment until timer reaches 1:00 (1 minute remaining)
8. Verify **GracePeriodWarning** modal appears:
   - Title: "Time Running Out"
   - Message: "Your assessment will be auto-submitted in 1 minute"
   - Button: "I Understand"
9. Click "I Understand"
10. Continue answering
11. When timer reaches 0:00:00, verify:
    - Assessment auto-submits immediately
    - Redirect to success page
    - Success page shows "Auto-submitted (Time Expired)" badge

#### Expected Results
- ✅ Timer syncs with server every 30 seconds (cannot be manipulated)
- ✅ Grace period warning appears at 1 minute
- ✅ Warning is dismissible but timer continues
- ✅ Auto-submission occurs exactly at 0:00:00
- ✅ Success page indicates auto-submission reason
- ✅ Backend has complete submission record

#### Test Data
- **Duration:** 5 minutes (for fast testing)
- **Grace Period:** 1 minute

#### Screenshots/Evidence
- [ ] Timer before and after sync (showing correction)
- [ ] Grace period warning modal
- [ ] Success page with auto-submit badge

---

### Scenario 16: Phase 1 - Auto-Submission Tracking

**Test ID:** TAL-E2E-016  
**Priority:** Medium  
**User Role:** Candidate (In Assessment)

#### Test Steps
1. Start assessment configured with auto-submission tracking enabled
2. Verify UI displays auto-submission status (e.g., near timer):
   - "Auto-submission: Enabled"
   - Icon indicator (shield or clock)
3. Answer questions normally
4. Verify status remains visible throughout assessment
5. Trigger auto-submission by:
   - Option A: Wait for timer to expire
   - Option B: Trigger 3 proctoring violations (tab switches)
6. Verify auto-submission status updates: "Auto-submission: Triggered"
7. Verify assessment submits automatically
8. Verify success page shows reason for auto-submission

#### Expected Results
- ✅ Auto-submission status visible when enabled
- ✅ Status updates in real-time
- ✅ Auto-submission triggers correctly (timer or violations)
- ✅ Submission completes without user action
- ✅ Reason for auto-submission is logged and displayed

#### Test Data
- **Auto-submission:** Enabled
- **Triggers:** Timer expiry, 3 proctoring violations

---

### Scenario 17: Proctoring Features (Inherited from SmartMock)

**Test ID:** TAL-E2E-017  
**Priority:** Critical  
**User Role:** Candidate (In Assessment)

#### Test Steps
Verify all SmartMock proctoring features work in Talens:

**Sub-Test 17A: Tab Switch Detection**
1. Switch tabs 3 times
2. Verify warning modals appear (1/3, 2/3, 3/3)
3. Verify auto-submission after 3rd violation

**Sub-Test 17B: Copy/Paste Detection**
1. Attempt to copy code
2. Verify notification: "Copy action detected"
3. Attempt to paste
4. Verify paste is blocked

**Sub-Test 17C: Fullscreen Exit Detection**
1. Exit fullscreen (press Esc)
2. Verify warning modal
3. Verify fullscreen re-activation

#### Expected Results
- ✅ All proctoring features from SmartMock work identically in Talens
- ✅ Proctoring events logged to backend
- ✅ Violations tracked and enforced

#### Test Data
- Same as SmartMock proctoring tests

---

### Scenario 18: Complete End-to-End Flow (Happy Path with Interview)

**Test ID:** TAL-E2E-018  
**Priority:** Critical  
**User Role:** Candidate (Complete Flow)

#### Test Steps - Full Journey
1. **Landing:** Navigate to Talens homepage → Click "I'm a Candidate"
2. **Login:** Enter valid code (with interview enabled) → Submit
3. **Phase 1 - Readiness:** Wait for generation (if generating) → Ready
4. **Phase 2 - System Check:**
   - System Check Modal appears
   - Click "Start System Check"
   - Grant microphone permission
   - Wait for all checks to pass (Mic, Internet, WebRTC)
   - Click "Continue to Assessment"
5. **Instructions:** Read instructions → Check consent → "Start Assessment"
6. **Fullscreen:** Accept fullscreen
7. **Assessment (if questions first):**
   - Answer Q1 (MCQ) → Next
   - Answer Q2 (Descriptive) → Next
   - Answer Q3 (Coding) → Submit
8. **Phase 4 - Live Interview:**
   - Interview page loads
   - Click microphone to unmute
   - Wait for connection (5 seconds)
   - AI starts conversation
   - Respond to 3-5 questions
   - End interview via "End Interview" button
9. **Success:** Verify success page displays completion
10. **Admin View:** Admin logs in → Views submission + interview transcript

#### Expected Results
- ✅ Complete flow works without errors
- ✅ All phase integrations work seamlessly:
   - Phase 1: Timer sync, auto-submission tracking
   - Phase 2: System checks pass
   - Phase 3: WebRTC connection stable
   - Phase 4: Interview completes successfully
- ✅ Assessment questions and interview both completed
- ✅ All data saved to backend
- ✅ Admin can view full report (questions + interview)
- ✅ Total time: 15-30 minutes (depending on interview length)

#### Screenshots/Evidence
- [ ] Video recording of complete flow
- [ ] Screenshot at each major phase
- [ ] Backend submission + interview transcript

---

### Scenario 19: Interview-Only Flow (No Assessment Questions)

**Test ID:** TAL-E2E-019  
**Priority:** High  
**User Role:** Candidate

#### Test Steps
1. Log in with code for interview-only test (no assessment questions)
2. Complete system check
3. Read instructions (should mention "interview only")
4. Click "Start Assessment" (should redirect to interview, not questions)
5. Verify redirect to `/candidate/live-interview`
6. Complete interview (5-10 minutes)
7. End interview
8. Verify redirect to success page (no assessment questions page)
9. Check backend for interview transcript only (no question responses)

#### Expected Results
- ✅ Interview-only flow skips assessment questions
- ✅ Direct redirect from instructions to interview
- ✅ Interview completes normally
- ✅ Success page shows interview completion (no questions)
- ✅ Backend has interview transcript, no question responses

#### Test Data
- **Test Configuration:** interview_only: true, questions: []

---

### Scenario 20: Mixed Flow (Interview After Questions)

**Test ID:** TAL-E2E-020  
**Priority:** High  
**User Role:** Candidate

#### Test Steps
1. Log in with code for test with both questions and interview
2. Complete system check
3. Read instructions (should mention "assessment + interview")
4. Start assessment
5. Answer all questions
6. Submit assessment
7. Verify redirect to `/candidate/live-interview` (not success page)
8. Complete interview
9. End interview
10. Verify redirect to success page
11. Check backend for both question responses and interview transcript

#### Expected Results
- ✅ Questions completed first
- ✅ After question submission, redirect to interview (not success)
- ✅ Interview completes after questions
- ✅ Success page shows both completions
- ✅ Backend has complete data (questions + interview)

#### Test Data
- **Test Configuration:** questions: 5, interview_enabled: true, interview_after_questions: true

---

## Performance Benchmarks

### Talens-Specific Targets
- **System Check Modal Load:** < 1 second
- **System Check Execution:** < 15 seconds (all three checks)
- **Interview Page Load:** < 3 seconds
- **WebRTC Connection:** < 5 seconds (on stable network)
- **AI Response Latency:** < 2 seconds (depends on Azure OpenAI)
- **Audio Quality Update:** Every 3-5 seconds
- **Reconnection Attempt:** Every 5 seconds (max 5 attempts)

### Inherited from SmartMock
- **Page Load:** < 2 seconds
- **Assessment Load:** < 3 seconds
- **Monaco Editor Load:** < 2 seconds
- **Answer Submission:** < 1 second

---

## Test Metrics & Coverage

### Phase Integration Coverage
- **Phase 1:** ✅ Timer sync, auto-submission tracking, readiness checks
- **Phase 2:** ✅ System check modal (mic, internet, WebRTC)
- **Phase 3:** ✅ WebRTC client, audio quality, reconnection
- **Phase 4:** ✅ Live interview, AI conversation, transcript

### Coverage Targets
- **Critical Scenarios:** 100% pass rate
- **High Priority:** 95% pass rate
- **Medium Priority:** 90% pass rate

### Browser Support
- ✅ Chrome 90+ (primary - best WebRTC support)
- ✅ Edge 90+ (excellent WebRTC support)
- ✅ Firefox 88+ (good WebRTC support)
- ⚠️ Safari 14+ (limited WebRTC support, may have issues)

---

## Known Issues & Limitations

1. **Safari WebRTC:** Limited support, audio quality may be poor
2. **Mobile Devices:** Not supported for live interview (screen size, microphone quality)
3. **Slow Networks:** Interview quality degrades significantly on < 1 Mbps connections
4. **Microphone Echo:** May occur on some devices (use headphones)
5. **Azure OpenAI Latency:** Response times vary by region and API load

---

## Test Execution Log

| Test ID     | Scenario          | Status    | Date | Tester | Notes |
| ----------- | ----------------- | --------- | ---- | ------ | ----- |
| TAL-E2E-001 | Landing Page      | ⏳ Pending | -    | -      | -     |
| TAL-E2E-002 | Login             | ⏳ Pending | -    | -      | -     |
| TAL-E2E-003 | Readiness (Gen)   | ⏳ Pending | -    | -      | -     |
| TAL-E2E-004 | Readiness (Fail)  | ⏳ Pending | -    | -      | -     |
| TAL-E2E-005 | System Check      | ⏳ Pending | -    | -      | -     |
| TAL-E2E-006 | System Check Fail | ⏳ Pending | -    | -      | -     |
| TAL-E2E-007 | Instructions      | ⏳ Pending | -    | -      | -     |
| TAL-E2E-008 | Interview Launch  | ⏳ Pending | -    | -      | -     |
| TAL-E2E-009 | Audio Quality     | ⏳ Pending | -    | -      | -     |
| TAL-E2E-010 | Reconnection      | ⏳ Pending | -    | -      | -     |
| TAL-E2E-011 | AI Conversation   | ⏳ Pending | -    | -      | -     |
| TAL-E2E-012 | End Interview     | ⏳ Pending | -    | -      | -     |
| TAL-E2E-013 | Interview Plan    | ⏳ Pending | -    | -      | -     |
| TAL-E2E-014 | Assessment Qs     | ⏳ Pending | -    | -      | -     |
| TAL-E2E-015 | Timer Sync        | ⏳ Pending | -    | -      | -     |
| TAL-E2E-016 | Auto-Submit Track | ⏳ Pending | -    | -      | -     |
| TAL-E2E-017 | Proctoring        | ⏳ Pending | -    | -      | -     |
| TAL-E2E-018 | Happy Path        | ⏳ Pending | -    | -      | -     |
| TAL-E2E-019 | Interview Only    | ⏳ Pending | -    | -      | -     |
| TAL-E2E-020 | Mixed Flow        | ⏳ Pending | -    | -      | -     |

**Legend:**
- ✅ Pass
- ❌ Fail
- ⏳ Pending
- ⚠️ Partial Pass (with issues)

---

## Next Steps

1. Execute all Critical (Priority) test scenarios for Phases 1-4
2. Document failures with screenshots/logs
3. Create bug tickets for any issues
4. Re-test after fixes
5. Execute High and Medium priority scenarios
6. Perform exploratory testing for edge cases
7. Final regression before production deployment

---

**Document Version:** 1.0  
**Last Updated:** October 3, 2025  
**Next Review:** After Talens deployment with all phase integrations
