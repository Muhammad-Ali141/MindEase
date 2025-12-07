# Diagnostic Test Backend Integration - Detailed Implementation Plan

## Overview
Integrate diagnostic tests with backend to:
1. Show generic screening test on first login in "Mental Health Assessments" section
2. Store test results in database
3. Identify primary condition from generic screening
4. Show relevant daily tests based on primary condition
5. Track test history and results

## Requirements Analysis

### User Flow
1. **First Login**: User sees generic screening test in "Mental Health Assessments" section
2. **Complete Generic Screening**: System calculates primary condition (depression/anxiety/stress/mood)
3. **Store Primary Condition**: Save to User table
4. **Daily Tests**: Each new day, show relevant test based on primary condition
5. **Test History**: Display all past test results

### Database Changes Needed

#### 1. User Table Updates
Add fields to track diagnostic test status:
- `primary_condition` (VARCHAR) - Stores identified condition: 'depression', 'anxiety', 'stress', 'general-mood', or NULL
- `generic_screening_completed` (BOOLEAN) - Flag if user completed initial screening
- `last_test_date` (DATE) - Last date user took a test (for daily test logic)

#### 2. TestResult Table Updates
Current schema needs enhancement:
- `user_responses` (VARCHAR(50)) - Too small, needs to be TEXT/JSON to store full responses
- Add `test_type` (VARCHAR) - Store test type: 'generic-screening', 'phq9', 'gad7', 'pss10', 'mood_test'
- Add `domain_scores` (JSON) - For generic screening, store scores per domain
- `taken_at` already exists (good for tracking)

#### 3. DiagnosticTest Table
May need to populate with test definitions, or keep using JSON files (current approach is fine)

## Implementation Steps

### Phase 1: Database Schema Updates

#### Step 1.1: Create Migration for User Table
- Add `primary_condition` field (CharField, max_length=20, null=True, blank=True)
- Add `generic_screening_completed` field (BooleanField, default=False)
- Add `last_test_date` field (DateField, null=True, blank=True)

#### Step 1.2: Create Migration for TestResult Table
- Change `user_responses` from CharField(50) to TextField or JSONField
- Add `test_type` field (CharField, max_length=50)
- Add `domain_scores` field (JSONField, null=True, blank=True) - For generic screening domain breakdown
- Ensure `test` ForeignKey is optional or handle generic screening case

### Phase 2: Backend API Endpoints

#### Step 2.1: Get User Test Status Endpoint
**Endpoint**: `GET /api/diagnostic-tests/status/`
**Purpose**: Check if user needs generic screening, get primary condition, check if daily test available
**Response**:
```json
{
  "generic_screening_completed": false,
  "primary_condition": null,
  "daily_test_available": false,
  "last_test_date": null,
  "available_test": null
}
```

#### Step 2.2: Get Available Tests Endpoint
**Endpoint**: `GET /api/diagnostic-tests/available/`
**Purpose**: Get list of tests user can take (generic screening or daily test)
**Response**:
```json
{
  "tests": [
    {
      "test_type": "generic-screening",
      "test_name": "Generic Screening Test",
      "description": "...",
      "questions_count": 8,
      "available": true
    }
  ]
}
```

#### Step 2.3: Submit Test Results Endpoint
**Endpoint**: `POST /api/diagnostic-tests/submit/`
**Purpose**: Submit test answers and calculate results
**Request**:
```json
{
  "test_type": "generic-screening",
  "answers": {
    "0": 2,
    "1": 3,
    ...
  }
}
```
**Response**:
```json
{
  "result_id": 123,
  "score": 15,
  "severity_level": "moderate",
  "primary_condition": "anxiety",  // Only for generic-screening
  "domain_scores": {  // Only for generic-screening
    "depression": 5,
    "anxiety": 8,
    "stress": 2,
    "mood": 0
  }
}
```

#### Step 2.4: Get Test History Endpoint
**Endpoint**: `GET /api/diagnostic-tests/history/`
**Purpose**: Get user's test history
**Response**:
```json
{
  "results": [
    {
      "result_id": 123,
      "test_type": "generic-screening",
      "test_name": "Generic Screening Test",
      "score": 15,
      "severity_level": "moderate",
      "taken_at": "2025-01-15T10:30:00Z"
    },
    ...
  ]
}
```

### Phase 3: Backend Business Logic

#### Step 3.1: Test Result Calculation Service
Create `backend/api/services/diagnostic_test_service.py`:
- Calculate scores for each test type
- Determine severity levels based on scores
- For generic screening: Calculate domain scores and identify primary condition
- Store results in database

#### Step 3.2: Daily Test Logic
- Check if `last_test_date` is different from today
- If yes, mark daily test as available
- Return appropriate test based on `primary_condition`

#### Step 3.3: Primary Condition Calculation
For generic screening:
- Sum scores per domain (depression, anxiety, stress, mood)
- Identify domain with highest score
- Map to test type: depression→phq9, anxiety→gad7, stress→pss10, mood→mood_test

### Phase 4: Frontend Updates

#### Step 4.1: Update DiagnosticTests Component
**File**: `components/diagnostic-tests.tsx`
**Changes**:
- Fetch test status on mount
- Show generic screening card if not completed
- Show daily test card if available
- Display test history
- Add "Take Test" buttons that navigate to test pages

#### Step 4.2: Update Test Submission Flow
**File**: `app/diagnostic-test/[testType]/page.tsx`
**Changes**:
- Replace localStorage with API calls
- Submit results to backend on completion
- Handle primary condition update
- Redirect appropriately after submission

#### Step 4.3: Update API Client
**File**: `lib/api.ts`
**Changes**:
- Add `apiGetTestStatus()` function
- Add `apiGetAvailableTests()` function
- Add `apiSubmitTestResults()` function
- Add `apiGetTestHistory()` function

### Phase 5: Integration & Testing

#### Step 5.1: First Login Flow
- User logs in for first time
- Dashboard loads, DiagnosticTests component fetches status
- Shows generic screening test card
- User clicks "Take Test", completes test
- Results submitted, primary condition saved
- Component refreshes, shows daily test for next day

#### Step 5.2: Daily Test Flow
- User logs in on new day
- System checks if test available for today
- Shows relevant test card based on primary condition
- User completes test, results saved
- Test marked as completed for today

#### Step 5.3: Test History Display
- Show all past test results in DiagnosticTests component
- Display date, test name, score, severity
- Allow viewing details

## Database Schema Details

### User Table Additions
```sql
ALTER TABLE user 
ADD COLUMN primary_condition VARCHAR(20) NULL,
ADD COLUMN generic_screening_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN last_test_date DATE NULL;
```

### TestResult Table Updates
```sql
ALTER TABLE testresult
MODIFY COLUMN user_responses TEXT,
ADD COLUMN test_type VARCHAR(50) NOT NULL,
ADD COLUMN domain_scores JSON NULL;
```

Note: For generic screening, `test` FK might be NULL, so we may need to make it nullable or create a special "generic-screening" test record.

## API Endpoint Details

### 1. GET /api/diagnostic-tests/status/
**Authentication**: Required (user_id from token)
**Logic**:
- Check if `generic_screening_completed` is False → return available test as generic-screening
- If completed, check `last_test_date` vs today
- If different date, return daily test based on `primary_condition`
- Return test status and availability

### 2. POST /api/diagnostic-tests/submit/
**Authentication**: Required
**Validation**:
- Validate test_type
- Validate answers format
- Ensure all questions answered
**Processing**:
- Calculate score based on test type
- Determine severity level
- If generic-screening: calculate domain scores, identify primary condition
- Save to TestResult table
- Update User table: primary_condition, generic_screening_completed, last_test_date
- Return result with calculated values

### 3. GET /api/diagnostic-tests/history/
**Authentication**: Required
**Logic**:
- Fetch all TestResult records for user
- Order by taken_at descending
- Return formatted list

## Severity Level Calculation

### Generic Screening
- Total score: Sum of all answers (0-32 for 8 questions)
- Severity based on total score:
  - 0-8: Minimal
  - 9-16: Mild
  - 17-24: Moderate
  - 25-32: Severe

### PHQ-9 (Depression)
- Total score: 0-36
- 0-4: Minimal
- 5-9: Mild
- 10-14: Moderate
- 15-19: Moderately Severe
- 20-27: Severe

### GAD-7 (Anxiety)
- Total score: 0-28
- 0-4: Minimal
- 5-9: Mild
- 10-14: Moderate
- 15-21: Severe

### PSS-10 (Stress)
- Total score: 0-40
- 0-13: Low
- 14-26: Moderate
- 27-40: High

### Mood Test
- Total score: 0-32
- Reverse scoring for positive questions
- Higher score = better mood

## File Structure

```
backend/
  api/
    migrations/
      0012_user_diagnostic_fields.py
      0013_testresult_enhancements.py
    services/
      diagnostic_test_service.py  # New
    views.py  # Add diagnostic test endpoints
    urls.py   # Add diagnostic test routes

frontend/
  components/
    diagnostic-tests.tsx  # Update
  app/
    diagnostic-test/
      [testType]/
        page.tsx  # Update submission logic
  lib/
    api.ts  # Add diagnostic test API functions
```

## Testing Checklist

- [ ] First login shows generic screening test
- [ ] Generic screening completion saves primary condition
- [ ] Daily test appears on new day
- [ ] Daily test matches primary condition
- [ ] Test results saved correctly
- [ ] Test history displays correctly
- [ ] Score calculations are accurate
- [ ] Severity levels calculated correctly
- [ ] Primary condition identification works
- [ ] Multiple test submissions work
- [ ] Edge cases handled (no primary condition, etc.)

## Notes

- Keep JSON test definitions in `public/diagnosticTests/` for frontend
- Backend can also reference these or store in DiagnosticTest table
- Consider timezone handling for "new day" logic
- Add proper error handling and validation
- Consider rate limiting for test submissions
- Add logging for test completions

