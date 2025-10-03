# End-to-End Testing Scenarios - Admin App

**App:** Admin (Administrative Dashboard & Management)  
**Location:** `frontend/apps/admin/`  
**Purpose:** Comprehensive admin interface for assessment management, question creation, candidate monitoring, and analytics  
**Date:** October 3, 2025

---

## App Overview

**Admin App** is the administrative control center featuring:

### Core Features
- ✅ Admin authentication (email/password)
- ✅ Dashboard with KPI metrics and charts
- ✅ Question management (add, edit, delete)
- ✅ Test initiation workflow (create assessments for candidates)
- ✅ Candidate submission reports (view answers, proctoring events, scores)
- ✅ Smart screen (resume screening, candidate filtering)
- ✅ Analytics page (detailed charts and performance metrics)

### Key Capabilities
- **Dashboard:** Total tests, completed, pending, success rate, status distribution charts
- **Question Library:** Create MCQ, Descriptive, and Coding questions with difficulty levels
- **Test Creation:** Generate assessment codes, configure duration, select questions
- **Candidate Reports:** View full submissions, proctoring violations, AI scores
- **Analytics:** Time-series data, question performance, candidate trends
- **Smart Screen:** AI-powered resume analysis and candidate ranking

---

## Test Environment Setup

### Prerequisites
```powershell
# Terminal 1: Backend
cd backend
uv run uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Admin Frontend
cd frontend/apps/admin
pnpm dev
```

**URLs:**
- Admin App: http://localhost:3002 (or configured port)
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

### Test Data Required
- **Admin Credentials:** admin@example.com / admin123
- **Sample Questions:** At least 10 questions across all types (MCQ, Descriptive, Coding)
- **Test Submissions:** 3-5 completed candidate submissions for reports testing
- **Sample Resumes:** 2-3 PDF resumes for smart screen testing

---

## E2E Test Scenarios

### Scenario 1: Landing Page & Navigation

**Test ID:** ADM-E2E-001  
**Priority:** Medium  
**User Role:** Any

#### Test Steps
1. Navigate to Admin app homepage (http://localhost:3002)
2. Verify landing page loads successfully
3. Check hero section displays "Talens" title
4. Verify tagline: "Intelligent Technical Assessment Platform"
5. Verify three feature cards:
   - Multi-Agentic Scoring (with SVG image)
   - Question Enhancer (with SVG image)
   - AI Resume Screening (with SVG image)
6. Check "Moderate" button is visible and clickable
7. Click "Moderate" button
8. Verify redirect to `/login`

#### Expected Results
- ✅ Landing page loads without errors
- ✅ Feature cards display with images and descriptions
- ✅ "Moderate" button redirects to login page
- ✅ Animations execute smoothly (fadeInUp, staggered)
- ✅ Typography follows warm-brown design system

#### Test Data
- N/A

---

### Scenario 2: Admin Login - Successful Authentication

**Test ID:** ADM-E2E-002  
**Priority:** Critical  
**User Role:** Admin

#### Test Steps
1. From landing page or direct navigation, go to `/login`
2. Verify login page displays:
   - Admin icon (gear/settings icon)
   - "Authenticate" heading
   - Email input field
   - Password input field
   - "Sign In" button
   - Demo credentials hint (admin@example.com / admin123)
3. Enter valid credentials:
   - Email: admin@example.com
   - Password: admin123
4. Click "Sign In" button
5. Verify loading state: "Signing in..."
6. Verify successful authentication
7. Verify localStorage stores:
   - adminToken
   - adminUser (JSON with admin details)
8. Verify redirect to `/dashboard`

#### Expected Results
- ✅ Login form renders correctly
- ✅ Input fields are functional
- ✅ Valid credentials authenticate successfully
- ✅ Token and user data stored in localStorage
- ✅ Smooth redirect to dashboard
- ✅ No console errors

#### Test Data
- **Email:** admin@example.com
- **Password:** admin123

#### Screenshots/Evidence
- [ ] Login page screenshot
- [ ] Loading state during sign-in
- [ ] Dashboard redirect

---

### Scenario 3: Admin Login - Invalid Credentials

**Test ID:** ADM-E2E-003  
**Priority:** High  
**User Role:** Admin (Invalid)

#### Test Steps
1. Navigate to `/login`
2. Enter invalid credentials:
   - Email: admin@example.com
   - Password: wrongpassword
3. Click "Sign In"
4. Verify error message displays:
   - Red background notification
   - "Invalid credentials" message
5. Try empty email
6. Verify "Sign In" button is disabled
7. Try empty password
8. Verify "Sign In" button is disabled

#### Expected Results
- ✅ Invalid credentials show error message
- ✅ Error message is user-friendly
- ✅ Empty fields disable submit button
- ✅ No redirect on failed login
- ✅ Form remains functional for retry

#### Test Data
- **Invalid Email:** admin@example.com
- **Invalid Password:** wrongpassword

---

### Scenario 4: Dashboard - KPI Metrics Display

**Test ID:** ADM-E2E-004  
**Priority:** Critical  
**User Role:** Admin (Authenticated)

#### Test Steps
1. Log in as admin
2. Verify redirect to `/dashboard`
3. Check dashboard header:
   - "Dashboard" heading (4xl-5xl font)
   - Subtitle: "Comprehensive assessment analytics and management"
4. Verify four KPI cards display:
   - **Total Tests:** Shows count (e.g., 42)
   - **Completed:** Shows count (e.g., 28)
   - **Pending:** Shows count (e.g., 14)
   - **Success Rate:** Shows percentage (e.g., 67%)
5. Verify each KPI card has:
   - Clean white background with border
   - Icon in circular background (T, C, P, %)
   - Hover effect (bg changes to white/80)
6. Verify data is fetched from backend (GET /api/admin/dashboard)

#### Expected Results
- ✅ Dashboard loads within 3 seconds
- ✅ All KPI cards display correctly
- ✅ Numbers are accurate (match backend data)
- ✅ Cards are responsive (grid: 1 → 2 → 4 columns)
- ✅ Hover effects work smoothly
- ✅ No loading errors

#### Test Data
- **Backend Response:** Valid DashboardStats object

#### Screenshots/Evidence
- [ ] Dashboard with KPI cards
- [ ] Network request for /api/admin/dashboard

---

### Scenario 5: Dashboard - Status Distribution Chart

**Test ID:** ADM-E2E-005  
**Priority:** Medium  
**User Role:** Admin (Authenticated)

#### Test Steps
1. On dashboard page, scroll to charts section
2. Verify doughnut chart displays:
   - Title: "Test Status Distribution" (or similar)
   - Three segments:
     - Completed (warm-brown/80)
     - Pending (warm-brown/50)
     - In Progress (warm-brown/30)
3. Hover over chart segments
4. Verify tooltips show exact counts
5. Verify legend displays below/beside chart
6. Verify chart is responsive (shrinks on smaller screens)

#### Expected Results
- ✅ Chart.js doughnut chart renders correctly
- ✅ Data segments match KPI card values
- ✅ Colors follow warm-brown design system
- ✅ Tooltips are functional
- ✅ Legend is clear and readable
- ✅ Chart is responsive

#### Test Data
- **Chart Data:** Completed: 28, Pending: 14, In Progress: 0

---

### Scenario 6: Dashboard - Recent Tests List

**Test ID:** ADM-E2E-006  
**Priority:** High  
**User Role:** Admin (Authenticated)

#### Test Steps
1. On dashboard, locate "Recent Tests" section
2. Verify search bar at top:
   - Placeholder: "Search by candidate email..."
   - Search icon
3. Verify test list displays (table or cards):
   - Candidate email
   - Test title
   - Status badge (completed/pending/in_progress/expired)
   - Submission date/time
   - "View Report" button (if completed)
4. Enter search term in search bar: "john@example.com"
5. Verify list filters to show only matching tests
6. Clear search
7. Verify full list returns
8. Click "View Report" on a completed test
9. Verify redirect to `/report?submissionId=...`

#### Expected Results
- ✅ Recent tests list displays all tests
- ✅ Search functionality works (real-time filtering)
- ✅ Status badges display correct colors
- ✅ "View Report" buttons only on completed tests
- ✅ Click redirects to report page with correct submission ID
- ✅ List is paginated or scrollable (if many tests)

#### Test Data
- **Tests:** 5-10 test submissions with various statuses

#### Screenshots/Evidence
- [ ] Recent tests list (full)
- [ ] Search filter in action
- [ ] Status badges (all types)

---

### Scenario 7: Navigation - Main Menu

**Test ID:** ADM-E2E-007  
**Priority:** Critical  
**User Role:** Admin (Authenticated)

#### Test Steps
1. On any admin page (e.g., dashboard)
2. Locate main navigation menu (likely top or side)
3. Verify menu items are visible:
   - Dashboard
   - Add Questions
   - Initiate Test
   - Reports
   - Smart Screen
   - Analytics
   - Logout (or user profile dropdown)
4. Click "Add Questions"
5. Verify redirect to `/add-questions`
6. Click "Initiate Test"
7. Verify redirect to `/initiate-test`
8. Click "Reports"
9. Verify redirect to `/report` or reports list
10. Click "Smart Screen"
11. Verify redirect to `/smart-screen`
12. Click "Analytics"
13. Verify redirect to `/analytics`
14. Click "Logout"
15. Verify logout action and redirect to `/login`

#### Expected Results
- ✅ All navigation links work correctly
- ✅ Active page is highlighted in menu
- ✅ Navigation is consistent across all pages
- ✅ Logout clears localStorage and redirects
- ✅ Mobile menu works (hamburger icon on small screens)

#### Test Data
- N/A

---

### Scenario 8: Add Questions - Create MCQ Question

**Test ID:** ADM-E2E-008  
**Priority:** Critical  
**User Role:** Admin (Authenticated)

#### Test Steps
1. Navigate to `/add-questions`
2. Verify page displays question creation form:
   - Question type dropdown (MCQ, Descriptive, Coding)
   - Question text textarea
   - Difficulty level selector (Easy, Medium, Hard)
   - Skills/tags input
3. Select question type: **MCQ**
4. Verify additional fields appear:
   - Option A input
   - Option B input
   - Option C input
   - Option D input
   - Correct answer selector (A, B, C, or D)
5. Fill in MCQ question:
   - Text: "What is the time complexity of binary search?"
   - Options:
     - A: O(n)
     - B: O(log n)
     - C: O(n^2)
     - D: O(1)
   - Correct: B
   - Difficulty: Medium
   - Skills: "algorithms, data structures"
6. Click "Save Question" or "Add Question"
7. Verify success notification: "Question added successfully"
8. Verify form resets for new question
9. Navigate to question list (if available)
10. Verify new question appears in list

#### Expected Results
- ✅ Question form renders correctly
- ✅ MCQ type shows option fields
- ✅ All fields are functional
- ✅ Question saves to backend (POST /api/admin/questions)
- ✅ Success notification appears
- ✅ Form resets after save
- ✅ Question appears in database

#### Test Data
- **Question Type:** MCQ
- **Text:** "What is the time complexity of binary search?"
- **Options:** O(n), O(log n), O(n^2), O(1)
- **Correct:** B (O(log n))
- **Difficulty:** Medium

#### Screenshots/Evidence
- [ ] Add question form (MCQ)
- [ ] Success notification
- [ ] Backend question record

---

### Scenario 9: Add Questions - Create Descriptive Question

**Test ID:** ADM-E2E-009  
**Priority:** High  
**User Role:** Admin (Authenticated)

#### Test Steps
1. Navigate to `/add-questions`
2. Select question type: **Descriptive**
3. Verify fields shown:
   - Question text textarea
   - Expected answer textarea (optional, for admin reference)
   - Difficulty level
   - Skills/tags
4. Fill in descriptive question:
   - Text: "Explain the SOLID principles in object-oriented programming with examples."
   - Expected answer: "SOLID is an acronym for: S - Single Responsibility..."
   - Difficulty: Hard
   - Skills: "OOP, design patterns, software architecture"
5. Click "Save Question"
6. Verify success notification
7. Verify question saved to backend

#### Expected Results
- ✅ Descriptive question form works correctly
- ✅ Expected answer field is optional
- ✅ Question saves successfully
- ✅ All fields are validated (required vs optional)

#### Test Data
- **Question Type:** Descriptive
- **Text:** "Explain the SOLID principles..."
- **Difficulty:** Hard

---

### Scenario 10: Add Questions - Create Coding Question

**Test ID:** ADM-E2E-010  
**Priority:** Critical  
**User Role:** Admin (Authenticated)

#### Test Steps
1. Navigate to `/add-questions`
2. Select question type: **Coding**
3. Verify additional fields appear:
   - Question text textarea
   - Language selector (Python, JavaScript, Java, etc.)
   - Starter code textarea (optional)
   - Test cases section:
     - Input field
     - Expected output field
     - "Add Test Case" button
   - Difficulty level
   - Skills/tags
4. Fill in coding question:
   - Text: "Write a function to reverse a linked list in-place."
   - Language: Python
   - Starter code:
     ```python
     class ListNode:
         def __init__(self, val=0, next=None):
             self.val = val
             self.next = next
     
     def reverseList(head):
         # Your code here
         pass
     ```
   - Test Case 1:
     - Input: "[1,2,3,4,5]"
     - Output: "[5,4,3,2,1]"
   - Test Case 2:
     - Input: "[]"
     - Output: "[]"
   - Difficulty: Medium
   - Skills: "linked lists, data structures, algorithms"
5. Click "Add Test Case" to add second test case
6. Click "Save Question"
7. Verify success notification
8. Verify question with test cases saved to backend

#### Expected Results
- ✅ Coding question form renders correctly
- ✅ Language selector works
- ✅ Starter code textarea accepts multi-line input
- ✅ Multiple test cases can be added
- ✅ Test cases are saved with question
- ✅ Question saves successfully to backend

#### Test Data
- **Question Type:** Coding
- **Language:** Python
- **Test Cases:** 2 test cases with input/output

#### Screenshots/Evidence
- [ ] Add coding question form
- [ ] Test cases section
- [ ] Backend question record with test cases

---

### Scenario 11: Initiate Test - Create Assessment Code

**Test ID:** ADM-E2E-011  
**Priority:** Critical  
**User Role:** Admin (Authenticated)

#### Test Steps
1. Navigate to `/initiate-test`
2. Verify test creation form displays:
   - Test title input
   - Candidate email input
   - Duration (minutes) input
   - Question selection (checkboxes or multi-select)
   - "Generate Code" or "Create Test" button
3. Fill in test details:
   - Title: "Senior Full-Stack Developer Assessment"
   - Candidate email: candidate@example.com
   - Duration: 60 minutes
4. Select questions from question bank:
   - Check 3 MCQ questions
   - Check 1 Descriptive question
   - Check 1 Coding question
5. Verify selected count: "5 questions selected"
6. Click "Generate Code"
7. Verify success notification with assessment code:
   - "Test created successfully!"
   - "Assessment Code: TEST-ABC-12345"
   - "Copy Code" button
8. Click "Copy Code"
9. Verify code copied to clipboard
10. Verify backend has test record (GET /api/admin/tests)

#### Expected Results
- ✅ Test creation form works correctly
- ✅ Question selection displays all available questions
- ✅ Selected count updates in real-time
- ✅ Assessment code is generated (unique, 10-15 chars)
- ✅ Code is copyable
- ✅ Test is saved to backend with:
   - Test ID
   - Title
   - Candidate email
   - Duration
   - Selected question IDs
   - Assessment code
   - Status: pending
- ✅ Email notification sent to candidate (if configured)

#### Test Data
- **Title:** "Senior Full-Stack Developer Assessment"
- **Candidate:** candidate@example.com
- **Duration:** 60 minutes
- **Questions:** 5 selected

#### Screenshots/Evidence
- [ ] Initiate test form
- [ ] Question selection UI
- [ ] Success modal with assessment code
- [ ] Backend test record

---

### Scenario 12: Initiate Test - Enable Live Interview

**Test ID:** ADM-E2E-012  
**Priority:** High  
**User Role:** Admin (Authenticated)

#### Test Steps
1. Navigate to `/initiate-test`
2. Fill in basic test details (title, candidate, duration)
3. Locate "Enable Live Interview" checkbox or toggle
4. Enable live interview
5. Verify additional fields appear:
   - Interview duration (minutes)
   - Interview role (e.g., "Senior Developer")
   - Interview topics/sections (multi-select or textarea)
6. Fill in interview details:
   - Duration: 30 minutes
   - Role: "Senior Full-Stack Developer"
   - Topics: "React, Node.js, System Design"
7. Select questions (optional, if mixed assessment)
8. Click "Generate Code"
9. Verify success notification includes interview flag
10. Verify backend test record has:
   - live_interview: true
   - interview_duration: 30
   - interview_role: "Senior Full-Stack Developer"
   - interview_plan: JSON with topics

#### Expected Results
- ✅ Live interview toggle works
- ✅ Interview configuration fields appear when enabled
- ✅ Interview details are validated
- ✅ Test creation succeeds with interview enabled
- ✅ Backend stores interview configuration
- ✅ Candidate will see interview in test flow

#### Test Data
- **Interview Enabled:** true
- **Interview Duration:** 30 minutes
- **Role:** "Senior Full-Stack Developer"

---

### Scenario 13: View Candidate Report - Complete Submission

**Test ID:** ADM-E2E-013  
**Priority:** Critical  
**User Role:** Admin (Authenticated)

#### Test Steps
1. Navigate to `/dashboard`
2. Locate a completed test in recent tests list
3. Click "View Report" button
4. Verify redirect to `/report?submissionId=<id>`
5. Check report page displays:
   - **Candidate Details:**
     - Name (if available)
     - Email
     - Test title
     - Submission timestamp
   - **Timing Information:**
     - Duration: 60 minutes
     - Time taken: 45 minutes
     - Started at: [timestamp]
     - Submitted at: [timestamp]
   - **Questions and Answers:**
     - Q1 (MCQ): Question text, selected option (highlighted), correct answer (if graded)
     - Q2 (Descriptive): Question text, candidate's answer (full text)
     - Q3 (Coding): Question text, candidate's code (syntax highlighted)
   - **Proctoring Events:**
     - Tab switch events with timestamps
     - Copy/paste attempts
     - Fullscreen exits
     - Total violations count
   - **Scoring (if available):**
     - Overall score: 85/100
     - Question-wise scores
     - AI evaluation comments
6. Scroll through all sections
7. Verify "Export PDF" or "Download Report" button (if available)

#### Expected Results
- ✅ Report page loads successfully
- ✅ All candidate details display correctly
- ✅ All answers are shown (MCQ, Descriptive, Coding)
- ✅ Coding answers have syntax highlighting
- ✅ Proctoring events are listed with timestamps
- ✅ Violations are highlighted (red badges)
- ✅ Scores and evaluations display (if grading is done)
- ✅ Report is printable or exportable

#### Test Data
- **Submission ID:** Valid completed submission

#### Screenshots/Evidence
- [ ] Report page (full view)
- [ ] Candidate answers section
- [ ] Proctoring events section
- [ ] Scoring section

---

### Scenario 14: View Candidate Report - Interview Transcript

**Test ID:** ADM-E2E-014  
**Priority:** High  
**User Role:** Admin (Authenticated)

#### Test Steps
1. Navigate to report for submission with live interview
2. Verify report includes **Interview Transcript** section
3. Check transcript displays:
   - Interview duration: 15 minutes
   - Role: "Senior Full-Stack Developer"
   - Conversation turns:
     - AI: "Hello, let's begin with..."
     - Candidate: "Yes, I'm ready..."
     - AI: "Can you explain dependency injection?"
     - Candidate: "Dependency injection is..."
     - [... 5-10 more turns]
4. Verify each turn shows:
   - Speaker (AI or Candidate)
   - Timestamp
   - Full text of conversation
5. Verify finalized turns are marked
6. Check if AI evaluation of interview is shown:
   - Communication score
   - Technical depth
   - Problem-solving approach
   - Overall interview rating

#### Expected Results
- ✅ Interview transcript section displays
- ✅ All conversation turns are shown in order
- ✅ Timestamps are accurate
- ✅ Transcript is readable and formatted well
- ✅ AI evaluation (if available) is displayed
- ✅ Transcript is exportable or copyable

#### Test Data
- **Submission:** With live interview completed

---

### Scenario 15: Analytics Page - Charts and Metrics

**Test ID:** ADM-E2E-015  
**Priority:** Medium  
**User Role:** Admin (Authenticated)

#### Test Steps
1. Navigate to `/analytics`
2. Verify analytics page displays:
   - **Time Series Chart:** Tests over time (line or bar chart)
   - **Question Performance:** Average scores per question
   - **Candidate Distribution:** Score distribution histogram
   - **Skill Analysis:** Top skills assessed
   - **Filter Controls:**
     - Date range picker
     - Status filter (All, Completed, Pending)
     - Skill filter
3. Select date range: "Last 30 days"
4. Verify charts update with filtered data
5. Select status filter: "Completed only"
6. Verify charts update again
7. Hover over chart elements
8. Verify tooltips display detailed data

#### Expected Results
- ✅ Analytics page loads all charts
- ✅ Charts are rendered with Chart.js
- ✅ Filters work correctly (date range, status, skills)
- ✅ Charts update dynamically on filter changes
- ✅ Tooltips are functional and informative
- ✅ Charts are responsive (work on mobile)
- ✅ Data is accurate (matches backend)

#### Test Data
- **Backend:** Valid analytics data for last 30 days

#### Screenshots/Evidence
- [ ] Analytics page (full view)
- [ ] Time series chart
- [ ] Question performance chart
- [ ] Filter controls in action

---

### Scenario 16: Smart Screen - Resume Upload and Analysis

**Test ID:** ADM-E2E-016  
**Priority:** Medium  
**User Role:** Admin (Authenticated)

#### Test Steps
1. Navigate to `/smart-screen`
2. Verify smart screen page displays:
   - "Upload Resume" button or drag-drop area
   - Job role input (e.g., "Senior Developer")
   - Required skills input (e.g., "React, Node.js, AWS")
3. Click "Upload Resume" or drag PDF file
4. Select resume file (PDF): "john_doe_resume.pdf"
5. Fill in job details:
   - Role: "Senior Full-Stack Developer"
   - Required skills: "React, TypeScript, Node.js, MongoDB"
6. Click "Analyze Resume"
7. Verify loading state: "Analyzing resume with AI..."
8. Wait for AI analysis (10-30 seconds)
9. Verify results display:
   - **Candidate Name:** John Doe
   - **Email:** john.doe@example.com (if found)
   - **Skill Match Score:** 85/100
   - **Matched Skills:** React (Expert), TypeScript (Advanced), Node.js (Intermediate), MongoDB (Beginner)
   - **Missing Skills:** None or list of missing skills
   - **Experience:** 5 years
   - **Recommendation:** "Strong match" or "Proceed to interview"
10. Verify "Initiate Test" button appears for qualified candidates
11. Click "Initiate Test"
12. Verify redirect to `/initiate-test` with candidate email pre-filled

#### Expected Results
- ✅ Resume upload works (PDF files)
- ✅ AI analysis completes within 30 seconds
- ✅ Analysis results are accurate and detailed
- ✅ Skill matching is displayed clearly
- ✅ Recommendations are actionable
- ✅ "Initiate Test" button redirects correctly
- ✅ Candidate email is pre-filled in test creation

#### Test Data
- **Resume:** PDF file with candidate details
- **Role:** "Senior Full-Stack Developer"
- **Skills:** "React, TypeScript, Node.js, MongoDB"

#### Screenshots/Evidence
- [ ] Smart screen upload UI
- [ ] AI analysis loading state
- [ ] Analysis results (skill match, recommendations)

---

### Scenario 17: Logout and Session Management

**Test ID:** ADM-E2E-017  
**Priority:** Critical  
**User Role:** Admin (Authenticated)

#### Test Steps
1. Log in as admin
2. Navigate to dashboard
3. Locate "Logout" button (likely in header or user menu)
4. Click "Logout"
5. Verify logout confirmation modal (if any)
6. Confirm logout
7. Verify:
   - localStorage cleared (adminToken, adminUser removed)
   - Redirect to `/login`
   - Cannot access protected routes without re-login
8. Try to navigate to `/dashboard` directly
9. Verify redirect to `/login`
10. Verify login page shows (not dashboard)

#### Expected Results
- ✅ Logout button is easily accessible
- ✅ Logout clears all admin session data
- ✅ Redirect to login page immediately
- ✅ Protected routes require re-authentication
- ✅ No stale data remains in browser

#### Test Data
- N/A

---

### Scenario 18: Protected Routes - Unauthorized Access

**Test ID:** ADM-E2E-018  
**Priority:** Critical  
**User Role:** Unauthenticated User

#### Test Steps
1. Open browser in incognito mode (no stored token)
2. Try to access `/dashboard` directly
3. Verify redirect to `/login`
4. Try to access `/add-questions`
5. Verify redirect to `/login`
6. Try to access `/initiate-test`
7. Verify redirect to `/login`
8. Try to access `/report?submissionId=123`
9. Verify redirect to `/login`
10. Verify no admin data is exposed

#### Expected Results
- ✅ All protected routes redirect to login
- ✅ No unauthorized access to admin features
- ✅ No backend data exposed without authentication
- ✅ Login page shows for all protected routes

#### Test Data
- N/A

---

### Scenario 19: Edit/Delete Questions (if feature exists)

**Test ID:** ADM-E2E-019  
**Priority:** Medium  
**User Role:** Admin (Authenticated)

#### Test Steps
1. Navigate to question management page (likely `/add-questions` or `/questions`)
2. Locate question list or search for existing question
3. Find a question to edit
4. Click "Edit" button
5. Verify question form pre-fills with existing data
6. Modify question text: "Updated: What is the time complexity..."
7. Click "Save Changes"
8. Verify success notification
9. Verify question is updated in database
10. Navigate to question list
11. Locate question to delete
12. Click "Delete" button
13. Verify confirmation modal: "Are you sure you want to delete this question?"
14. Click "Confirm Delete"
15. Verify success notification: "Question deleted"
16. Verify question removed from list

#### Expected Results
- ✅ Edit functionality pre-fills form correctly
- ✅ Changes are saved to backend
- ✅ Delete requires confirmation
- ✅ Delete removes question from database
- ✅ Questions used in active tests cannot be deleted (validation)

#### Test Data
- **Question ID:** Existing question from database

---

### Scenario 20: Complete Admin Workflow (Happy Path)

**Test ID:** ADM-E2E-020  
**Priority:** Critical  
**User Role:** Admin (Complete Flow)

#### Test Steps - Full Admin Journey
1. **Landing & Login:**
   - Navigate to Admin app → Click "Moderate"
   - Enter credentials → Log in → Dashboard loads
2. **Dashboard Review:**
   - View KPI metrics (Total: 10, Completed: 6, Pending: 4, Success: 60%)
   - View status chart
   - Review recent tests list
3. **Create Questions:**
   - Navigate to "Add Questions"
   - Create 1 MCQ question → Save
   - Create 1 Descriptive question → Save
   - Create 1 Coding question with 2 test cases → Save
4. **Initiate Test:**
   - Navigate to "Initiate Test"
   - Fill in: Title, Candidate email, Duration: 60 min
   - Enable live interview: Duration 30 min, Role: "Senior Dev"
   - Select 5 questions (including newly created)
   - Generate code → Copy code: "TEST-XYZ-789"
5. **Monitor Submission:**
   - (Candidate takes test - simulated or actual)
   - Refresh dashboard → See new test in "In Progress"
   - Wait for candidate to complete
   - Dashboard updates → Test shows "Completed"
6. **View Report:**
   - Click "View Report" on completed test
   - Review all answers (MCQ, Descriptive, Coding)
   - Review proctoring events
   - Review interview transcript
   - Check AI scores and evaluations
7. **Analytics:**
   - Navigate to "Analytics"
   - View charts with updated data
   - Filter by date range → Charts update
8. **Logout:**
   - Click "Logout" → Confirm → Redirect to login

#### Expected Results
- ✅ Complete admin workflow works end-to-end
- ✅ All CRUD operations succeed (Create, Read, Update, Delete)
- ✅ Dashboard updates in real-time (or on refresh)
- ✅ Test creation and monitoring work seamlessly
- ✅ Reports display all data accurately
- ✅ Analytics reflect current state
- ✅ No errors throughout entire flow
- ✅ Total time: 10-15 minutes

#### Screenshots/Evidence
- [ ] Video recording of complete flow
- [ ] Screenshot at each major step
- [ ] Backend data verification

---

## Performance Benchmarks

### Admin App Targets
- **Dashboard Load:** < 3 seconds (includes data fetch)
- **Question Creation:** < 2 seconds (save to backend)
- **Test Initiation:** < 3 seconds (code generation)
- **Report Load:** < 4 seconds (includes submission data, proctoring events)
- **Analytics Load:** < 5 seconds (includes chart rendering)
- **Smart Screen Analysis:** < 30 seconds (AI resume analysis)

---

## Test Metrics & Coverage

### Coverage Targets
- **Critical Scenarios:** 100% pass rate
- **High Priority:** 95% pass rate
- **Medium Priority:** 90% pass rate

### Browser Support
- ✅ Chrome 90+ (primary)
- ✅ Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+

### Device Support
- ✅ Desktop (1920x1080, 1366x768)
- ✅ Laptop (1440x900)
- ✅ Tablet (landscape mode, 1024x768)
- ⚠️ Mobile (limited - some admin features may be cramped)

---

## Known Issues & Limitations

1. **Large Question Banks:** Loading 1000+ questions may be slow (implement pagination)
2. **PDF Export:** Report export may timeout on very large submissions
3. **Real-time Updates:** Dashboard requires manual refresh (no WebSocket)
4. **Mobile UI:** Some tables and charts may overflow on small screens

---

## Test Execution Log

| Test ID     | Scenario             | Status    | Date | Tester | Notes |
| ----------- | -------------------- | --------- | ---- | ------ | ----- |
| ADM-E2E-001 | Landing Page         | ⏳ Pending | -    | -      | -     |
| ADM-E2E-002 | Login Success        | ⏳ Pending | -    | -      | -     |
| ADM-E2E-003 | Login Fail           | ⏳ Pending | -    | -      | -     |
| ADM-E2E-004 | Dashboard KPIs       | ⏳ Pending | -    | -      | -     |
| ADM-E2E-005 | Status Chart         | ⏳ Pending | -    | -      | -     |
| ADM-E2E-006 | Recent Tests         | ⏳ Pending | -    | -      | -     |
| ADM-E2E-007 | Navigation           | ⏳ Pending | -    | -      | -     |
| ADM-E2E-008 | Add MCQ              | ⏳ Pending | -    | -      | -     |
| ADM-E2E-009 | Add Descriptive      | ⏳ Pending | -    | -      | -     |
| ADM-E2E-010 | Add Coding           | ⏳ Pending | -    | -      | -     |
| ADM-E2E-011 | Initiate Test        | ⏳ Pending | -    | -      | -     |
| ADM-E2E-012 | Enable Interview     | ⏳ Pending | -    | -      | -     |
| ADM-E2E-013 | View Report          | ⏳ Pending | -    | -      | -     |
| ADM-E2E-014 | Interview Transcript | ⏳ Pending | -    | -      | -     |
| ADM-E2E-015 | Analytics            | ⏳ Pending | -    | -      | -     |
| ADM-E2E-016 | Smart Screen         | ⏳ Pending | -    | -      | -     |
| ADM-E2E-017 | Logout               | ⏳ Pending | -    | -      | -     |
| ADM-E2E-018 | Unauthorized Access  | ⏳ Pending | -    | -      | -     |
| ADM-E2E-019 | Edit/Delete Q        | ⏳ Pending | -    | -      | -     |
| ADM-E2E-020 | Happy Path           | ⏳ Pending | -    | -      | -     |

**Legend:**
- ✅ Pass
- ❌ Fail
- ⏳ Pending
- ⚠️ Partial Pass

---

## Next Steps

1. Execute all Critical scenarios first
2. Document failures with screenshots/logs
3. Create bug tickets for any issues
4. Re-test after fixes
5. Execute High and Medium priority scenarios
6. Perform exploratory testing
7. Final regression before production

---

**Document Version:** 1.0  
**Last Updated:** October 3, 2025  
**Next Review:** After Admin app deployment
