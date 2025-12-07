# Diagnostic Test Feature Integration Plan

## Overview
Integrating diagnostic test feature files provided by team member into the existing MindEase codebase.

## Files to Integrate

### 1. Diagnostic Test Pages
- **Source**: `FIles to be added/diagnostic-test/`
- **Destination**: `app/diagnostic-test/`
- **Files**:
  - `page.tsx` → `app/diagnostic-test/page.tsx` (main test selection page)
  - `[testType]/page.tsx` → `app/diagnostic-test/[testType]/page.tsx` (dynamic test page)

### 2. Test Data JSON Files
- **Source**: `FIles to be added/diagnosticTests/`
- **Destination**: `public/diagnosticTests/`
- **Files**:
  - `generic_screening.json`
  - `gad7.json` (anxiety test)
  - `phq9.json` (depression test)
  - `pss10.json` (stress test)
  - `mood_test.json` (general mood test)

### 3. Component Update
- **Source**: `FIles to be added/therapy-options.tsx`
- **Destination**: `components/therapy-options.tsx`
- **Action**: Merge with existing component (add `handleStartCheckin` function)

## Dependencies Check
✅ `framer-motion` - Already installed (v11.18.2)
✅ `Header` component - Exists at `components/header.tsx`
✅ `lucide-react` - Already installed
✅ Next.js routing - Already configured

## Integration Steps

### Step 1: Copy Diagnostic Test Pages
1. Create `app/diagnostic-test/` directory
2. Copy `page.tsx` to `app/diagnostic-test/page.tsx`
3. Create `app/diagnostic-test/[testType]/` directory
4. Copy `[testType]/page.tsx` to `app/diagnostic-test/[testType]/page.tsx`

### Step 2: Copy Test Data Files
1. Create `public/diagnosticTests/` directory
2. Copy all JSON files from `FIles to be added/diagnosticTests/` to `public/diagnosticTests/`

### Step 3: Update Therapy Options Component
1. Read existing `components/therapy-options.tsx`
2. Add `handleStartCheckin` function from new version
3. Update "Start Check-in" button to use `onClick={handleStartCheckin}`

### Step 4: Verify Imports and Paths
- ✅ Verify `@/components/header` import path
- ✅ Verify JSON file paths in `[testType]/page.tsx` match `/diagnosticTests/` location
- ✅ Verify all icon imports from `lucide-react`
- ✅ Verify `framer-motion` imports

### Step 5: Test Integration
- Test route `/diagnostic-test` loads correctly
- Test route `/diagnostic-test/generic-screening` loads correctly
- Test route `/diagnostic-test/depression` loads correctly
- Test route `/diagnostic-test/anxiety` loads correctly
- Test route `/diagnostic-test/stress` loads correctly
- Test route `/diagnostic-test/general-mood` loads correctly
- Test JSON files load from `/diagnosticTests/` path
- Test "Quick Check-in" button navigates correctly
- Test localStorage integration for primary condition

## Route Structure
```
/diagnostic-test                    → Test selection page
/diagnostic-test/generic-screening  → Generic screening test
/diagnostic-test/depression         → PHQ-9 test
/diagnostic-test/anxiety            → GAD-7 test
/diagnostic-test/stress             → PSS-10 test
/diagnostic-test/general-mood       → Mood test
```

## Key Features
1. **Generic Screening**: 8-question screening to identify primary concern
2. **Primary Condition Storage**: Uses localStorage to store `mindease_primary_condition`
3. **Conditional Routing**: Redirects users to their primary condition test if already screened
4. **Test Types**: 5 different diagnostic tests (generic screening + 4 specific tests)
5. **Progress Tracking**: Visual progress bar and question counter
6. **Responsive Design**: Mobile-friendly with animations

## Notes
- Backend integration is NOT included (as per user request)
- All test results are currently stored in localStorage only
- TODO comments in code indicate future backend integration points
- No database changes required at this stage


