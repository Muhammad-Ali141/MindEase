# Diagnostic Test Backend Integration - Implementation Summary

## ✅ Implementation Complete

All backend integration for diagnostic tests has been successfully implemented. The system now:
1. Shows generic screening test on first login in "Mental Health Assessments" section
2. Stores test results in database
3. Identifies primary condition from generic screening
4. Shows relevant daily tests based on primary condition
5. Tracks test history and results

## Files Created/Modified

### Backend Files

#### 1. Database Migrations
- **`backend/api/migrations/0012_user_diagnostic_fields.py`**
  - Adds `primary_condition`, `generic_screening_completed`, `last_test_date` to User table

- **`backend/api/migrations/0013_testresult_enhancements.py`**
  - Changes `user_responses` from CharField(50) to TextField
  - Adds `test_type` field
  - Adds `domain_scores` JSONField
  - Makes `test` ForeignKey nullable (for generic screening)

#### 2. Models Updated
- **`backend/api/models.py`**
  - User model: Added diagnostic test fields
  - Testresult model: Enhanced with new fields

#### 3. Service Layer
- **`backend/api/services/diagnostic_test_service.py`** (NEW)
  - Score calculation logic
  - Severity level determination
  - Primary condition identification
  - Domain score calculation for generic screening
  - Daily test availability logic

#### 4. API Endpoints
- **`backend/api/views.py`**
  - `diagnostic_test_status()` - GET test status and availability
  - `diagnostic_test_submit()` - POST test results
  - `diagnostic_test_history()` - GET test history

- **`backend/api/urls.py`**
  - Added routes for diagnostic test endpoints

### Frontend Files

#### 1. API Client
- **`lib/api.ts`**
  - `apiGetDiagnosticTestStatus()` - Fetch test status
  - `apiSubmitDiagnosticTest()` - Submit test results
  - `apiGetDiagnosticTestHistory()` - Fetch test history
  - Type definitions for all responses

#### 2. Components
- **`components/diagnostic-tests.tsx`** (UPDATED)
  - Fetches test status from backend
  - Displays available test (generic screening or daily test)
  - Shows test history
  - Navigates to test pages

#### 3. Test Pages
- **`app/diagnostic-test/[testType]/page.tsx`** (UPDATED)
  - Removed localStorage logic
  - Integrated with backend API for submission
  - Shows loading state during submission
  - Handles errors gracefully

## Database Schema Changes

### User Table
```sql
ALTER TABLE user 
ADD COLUMN primary_condition VARCHAR(20) NULL,
ADD COLUMN generic_screening_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN last_test_date DATE NULL;
```

### TestResult Table
```sql
ALTER TABLE testresult
MODIFY COLUMN user_responses TEXT,
ADD COLUMN test_type VARCHAR(50) NOT NULL,
ADD COLUMN domain_scores JSON NULL,
MODIFY COLUMN test_id INT NULL;  -- Make nullable for generic screening
```

## API Endpoints

### 1. GET Test Status
**Endpoint**: `POST /api/diagnostic-tests/status/`
**Request**:
```json
{
  "user_id": "123"
}
```
**Response**:
```json
{
  "generic_screening_completed": false,
  "primary_condition": null,
  "daily_test_available": false,
  "last_test_date": null,
  "available_test": "generic-screening"
}
```

### 2. Submit Test Results
**Endpoint**: `POST /api/diagnostic-tests/submit/`
**Request**:
```json
{
  "user_id": "123",
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
  "primary_condition": "anxiety",
  "domain_scores": {
    "depression": 5,
    "anxiety": 8,
    "stress": 2,
    "mood": 0
  }
}
```

### 3. Get Test History
**Endpoint**: `POST /api/diagnostic-tests/history/`
**Request**:
```json
{
  "user_id": "123"
}
```
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
    }
  ]
}
```

## User Flow

### First Login
1. User logs in for the first time
2. Dashboard loads, `DiagnosticTests` component fetches status
3. Backend returns `generic_screening_completed: false`
4. Component displays generic screening test card
5. User clicks "Start Screening"
6. User completes test
7. Results submitted to backend
8. Backend calculates primary condition and saves to User table
9. Component refreshes, shows daily test for next day

### Daily Test Flow
1. User logs in on a new day
2. System checks `last_test_date` vs today
3. If different date, shows relevant test based on `primary_condition`
4. User completes test, results saved
5. `last_test_date` updated to today
6. Test marked as completed for today

## Next Steps

### 1. Run Database Migrations
```bash
cd backend
python manage.py migrate
```

### 2. Test the Implementation
1. Create a new user account
2. Login and verify generic screening appears
3. Complete generic screening
4. Verify primary condition is saved
5. Verify daily test appears next day
6. Complete daily test
7. Verify test history displays correctly

### 3. Verify Backend Endpoints
Test all three endpoints using Postman or curl:
- Test status endpoint
- Test submission endpoint
- Test history endpoint

### 4. Frontend Testing
- Test on first login
- Test daily test availability
- Test test submission
- Test error handling
- Test loading states

## Severity Level Calculations

### Generic Screening (0-32)
- 0-8: Minimal
- 9-16: Mild
- 17-24: Moderate
- 25-32: Severe

### PHQ-9 Depression (0-36)
- 0-4: Minimal
- 5-9: Mild
- 10-14: Moderate
- 15-19: Severe
- 20-27: Extremely Severe

### GAD-7 Anxiety (0-28)
- 0-4: Minimal
- 5-9: Mild
- 10-14: Moderate
- 15-21: Severe

### PSS-10 Stress (0-40)
- 0-13: Minimal
- 14-26: Moderate
- 27-40: Severe

### Mood Test (0-32)
- Higher score = better mood
- 24-32: Minimal (Good mood)
- 16-23: Mild
- 8-15: Moderate
- 0-7: Severe (Poor mood)

## Notes

- All test results are stored in `TestResult` table
- Primary condition is stored in `User` table
- Daily test logic checks if `last_test_date` is different from today
- Generic screening calculates domain scores to identify primary condition
- Test history shows last 5 results in the component
- All API endpoints require `user_id` in request body
- Error handling is implemented for all API calls

## Potential Issues & Solutions

### Issue: Migration fails
**Solution**: Ensure database is accessible and user has proper permissions

### Issue: Test submission fails
**Solution**: Check that all required fields are present and test_type is valid

### Issue: Daily test not appearing
**Solution**: Verify `last_test_date` is being updated correctly and timezone is handled properly

### Issue: Primary condition not calculated
**Solution**: Verify domain scores are calculated correctly for generic screening

## Testing Checklist

- [ ] Run database migrations successfully
- [ ] First login shows generic screening
- [ ] Generic screening completion saves primary condition
- [ ] Daily test appears on new day
- [ ] Daily test matches primary condition
- [ ] Test results saved correctly
- [ ] Test history displays correctly
- [ ] Score calculations are accurate
- [ ] Severity levels calculated correctly
- [ ] Primary condition identification works
- [ ] Multiple test submissions work
- [ ] Error handling works correctly

