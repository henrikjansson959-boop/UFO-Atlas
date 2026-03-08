# Implementation Plan: Saved Search Scheduling

## Overview

This implementation plan extends the existing automated-data-collection system to enable administrators to schedule automated execution of saved searches using cron-based scheduling. The approach prioritizes database schema extensions first, followed by shared validation utilities, backend scheduler enhancements, API endpoints, and finally the frontend UI components.

The system will integrate with the existing ScanScheduler, ContentScanner, and Supabase infrastructure, using TypeScript for both backend and frontend, node-cron for cron parsing, and fast-check for property-based testing.

## Tasks

- [ ] 1. Database migrations for scheduling fields
  - [x] 1.1 Create migration for Saved_Searches scheduling fields
    - Write SQL migration file: supabase/migrations/002_add_saved_search_scheduling.sql
    - Add schedule_enabled (BOOLEAN DEFAULT FALSE), cron_expression (TEXT), next_run_at (TIMESTAMP), last_run_at (TIMESTAMP) columns to Saved_Searches table
    - Create index idx_saved_searches_next_run on next_run_at WHERE schedule_enabled = TRUE
    - Add check constraint chk_schedule_config ensuring cron_expression is set when schedule_enabled is true
    - Add column comments for documentation
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [x] 1.2 Create migration for Search_History execution type
    - Write SQL migration file: supabase/migrations/003_add_execution_type_to_search_history.sql
    - Add execution_type column (VARCHAR(20) DEFAULT 'manual') with CHECK constraint for 'manual' or 'scheduled' values
    - Create index idx_search_history_execution_type on execution_type
    - Add column comment for documentation
    - _Requirements: 7.5_
  
  - [ ]* 1.3 Write property test for database schema integrity
    - **Property 11: Database Schema Integrity** - All scheduling fields properly added with correct types and constraints
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

- [ ] 2. Implement cron validation utilities
  - [x] 2.1 Create CronValidator utility class
    - Create src/scheduler/cronValidator.ts with CronValidator class
    - Implement validateCronExpression method using node-cron library for syntax validation
    - Implement calculateMinimumInterval method to determine interval between executions
    - Implement meetsMinimumInterval method to check 15-minute minimum
    - Return CronValidationResult with isValid, error, nextRun, intervalMinutes fields
    - _Requirements: 3.1, 3.2, 10.1, 10.3_
  
  - [x] 2.2 Implement next run calculator
    - Add calculateNextRun method to CronValidator class
    - Parse cron expression and calculate next execution timestamp from given date
    - Handle timezone considerations using system timezone
    - Return Date object for next execution
    - _Requirements: 4.1, 5.3_
  
  - [ ]* 2.3 Write property test for cron validation
    - **Property 2: Invalid Cron Expression Rejection** - Invalid cron expressions return isValid=false with descriptive error
    - **Property 7: Minimum Interval Enforcement** - Cron expressions with <15 minute intervals are rejected
    - **Property 10: Next Execution Preview** - Valid cron expressions return correct nextRun timestamp
    - **Validates: Requirements 3.1, 3.2, 3.3, 4.1, 10.1**
  
  - [x] 2.4 Add cron validation error messages
    - Implement descriptive error messages for common cron mistakes
    - Add examples of valid cron expressions in error responses
    - Handle edge cases: every minute, every second, complex expressions
    - _Requirements: 10.1, 10.3, 10.4_

- [ ] 3. Enhance StorageService with schedule methods
  - [x] 3.1 Add schedule configuration methods to StorageService
    - Add updateSavedSearchSchedule method in src/storage/storageService.ts
    - Implement method to update schedule_enabled, cron_expression, next_run_at for a saved search
    - Add getSavedSearchWithSchedule method to retrieve saved search with schedule fields
    - Use existing transaction support and retry logic
    - _Requirements: 1.2, 1.4, 8.1, 8.2_
  
  - [x] 3.2 Add scheduled search query methods
    - Add getDueScheduledSearches method to query searches where schedule_enabled=true AND next_run_at <= NOW()
    - Return ScheduledSearchConfig array with savedSearchId, searchName, cronExpression, nextRunAt, lastRunAt, keywordsUsed, selectedTagIds
    - Use existing index for efficient querying
    - _Requirements: 5.1_
  
  - [x] 3.3 Add schedule execution tracking methods
    - Add updateScheduledSearchExecution method to update last_run_at and next_run_at after execution
    - Modify recordSearchHistory method to accept executionType parameter ('manual' or 'scheduled')
    - Update method signature: recordSearchHistoryWithType(scanJobId, keywordsUsed, selectedTagIds, itemsDiscovered, executionType, savedSearchId?, savedSearchVersion?)
    - _Requirements: 5.2, 5.3, 6.1, 6.2_
  
  - [ ]* 3.4 Write property test for schedule storage
    - **Property 1: Valid Schedule Storage** - Valid schedule configuration is stored with all fields
    - **Property 3: Schedule Modification Updates** - Modifying schedule updates stored values and recalculates next_run_at
    - **Property 5: Schedule Disablement Preservation** - Disabling schedule sets schedule_enabled=false while preserving cron_expression
    - **Validates: Requirements 1.2, 1.4, 1.5, 2.3**

- [ ] 4. Checkpoint - Verify database and storage layer
  - Ensure all migrations applied successfully and storage methods work correctly, ask the user if questions arise.

- [ ] 5. Enhance ScanScheduler with saved search support
  - [x] 5.1 Add scheduled search monitoring to ScanScheduler
    - Modify src/scheduler/scanScheduler.ts to add startScheduledSearchMonitoring method
    - Implement monitoring loop that checks for due scheduled searches every minute
    - Add stopScheduledSearchMonitoring method to stop monitoring
    - Store monitoring interval reference for cleanup
    - _Requirements: 5.1, 5.4_
  
  - [x] 5.2 Implement scheduled search execution
    - Add executeScheduledSearch private method to ScanScheduler class
    - Load saved search configuration (keywords, tag filters) from ScheduledSearchConfig
    - Execute scan using existing ContentScanner.executeScan method
    - Pass execution_type='scheduled' to search history recording
    - Handle execution errors with logging
    - _Requirements: 5.1, 6.2_
  
  - [x] 5.3 Implement post-execution updates
    - Add updateScheduledSearchAfterExecution private method
    - Update last_run_at to execution timestamp
    - Calculate next_run_at using CronValidator.calculateNextRun
    - Call StorageService.updateScheduledSearchExecution with new timestamps
    - Update next_run_at even on execution failure to prevent retry loops
    - _Requirements: 5.2, 5.3_
  
  - [x] 5.4 Integrate scheduled search monitoring with existing scheduler
    - Call startScheduledSearchMonitoring in ScanScheduler initialization
    - Ensure scheduled search monitoring runs alongside existing keyword scheduling
    - Add cleanup in stopScheduler method to stop scheduled search monitoring
    - _Requirements: 5.1, 5.4_
  
  - [ ]* 5.5 Write property test for scheduled execution
    - **Property 12: Due Search Execution** - Searches with schedule_enabled=true and next_run_at <= now are executed
    - **Property 6: Disabled Schedule Non-Execution** - Searches with schedule_enabled=false are never executed
    - **Property 13: Post-Execution Timestamp Update** - last_run_at is updated to execution timestamp after completion
    - **Property 14: Next Run Recalculation** - next_run_at is recalculated based on cron_expression after execution
    - **Validates: Requirements 2.4, 5.1, 5.2, 5.3**

- [ ] 6. Implement Schedule API endpoints
  - [x] 6.1 Create schedule API routes
    - Create src/admin/scheduleRoutes.ts with Express router
    - Define routes: POST /api/saved-searches/:id/schedule, GET /api/saved-searches/:id/schedule, DELETE /api/saved-searches/:id/schedule, PATCH /api/saved-searches/:id/schedule/toggle
    - Add authentication middleware for admin actions
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [x] 6.2 Implement updateSchedule endpoint
    - Implement POST /api/saved-searches/:id/schedule handler
    - Accept scheduleEnabled and cronExpression in request body
    - Validate cron expression using CronValidator server-side
    - Enforce 15-minute minimum interval
    - Calculate next_run_at if scheduleEnabled is true
    - Call StorageService.updateSavedSearchSchedule
    - Return updated SavedSearchWithSchedule or 400 error with specific message
    - _Requirements: 1.2, 1.3, 3.4, 8.5_
  
  - [x] 6.3 Implement getSchedule endpoint
    - Implement GET /api/saved-searches/:id/schedule handler
    - Call StorageService.getSavedSearchWithSchedule
    - Return ScheduleConfig with scheduleEnabled, cronExpression, nextRunAt, lastRunAt
    - Return 404 if saved search not found
    - _Requirements: 8.3_
  
  - [x] 6.4 Implement deleteSchedule endpoint
    - Implement DELETE /api/saved-searches/:id/schedule handler
    - Set schedule_enabled=false and clear cron_expression, next_run_at, last_run_at
    - Return success status
    - _Requirements: 8.4_
  
  - [x] 6.5 Implement toggleSchedule endpoint
    - Implement PATCH /api/saved-searches/:id/schedule/toggle handler
    - Accept enabled boolean in request body
    - Update schedule_enabled field
    - Recalculate next_run_at if enabling, clear if disabling
    - Return updated ScheduleConfig
    - _Requirements: 2.2, 2.3_
  
  - [ ]* 6.6 Write property test for schedule API
    - **Property 9: Server-Side Validation** - API returns 400 error for invalid cron expressions or intervals <15 minutes
    - **Property 4: Schedule Enablement Behavior** - Enabling schedule sets schedule_enabled=true and calculates next_run_at
    - **Validates: Requirements 2.2, 3.4, 8.5, 10.3**
  
  - [x] 6.7 Integrate schedule routes with main API server
    - Import scheduleRoutes in src/admin/adminAPI.ts
    - Mount schedule routes: app.use('/api/saved-searches', scheduleRoutes)
    - Ensure CORS and body parsing configured
    - _Requirements: 8.1_

- [ ] 7. Checkpoint - Verify backend scheduling functionality
  - Ensure all backend scheduling components work together correctly, ask the user if questions arise.

- [ ] 8. Implement Schedule Editor UI component
  - [x] 8.1 Create ScheduleEditor component structure
    - Create website/src/components/ScheduleEditor.tsx with React component
    - Define ScheduleEditorProps interface: savedSearch, onSave, onCancel
    - Define ScheduleEditorState interface: scheduleEnabled, cronExpression, validationError, nextRunPreview, isSaving
    - Use React hooks (useState) for state management
    - _Requirements: 1.1_
  
  - [x] 8.2 Implement cron expression input and validation
    - Add text input field for cron expression
    - Implement client-side validation using CronValidator on input change
    - Display validation error messages below input field
    - Show examples of valid cron expressions as placeholder or help text
    - Disable save button while validation error exists
    - _Requirements: 1.1, 1.3, 3.3, 10.1, 10.2, 10.4_
  
  - [x] 8.3 Implement next execution preview
    - Add validateAndPreview method that calls CronValidator.calculateNextRun
    - Display calculated next execution time in real-time as user types
    - Format timestamp in user-friendly format
    - Update preview whenever cron expression changes
    - _Requirements: 4.1, 4.2_
  
  - [x] 8.4 Implement enable/disable toggle
    - Add toggle switch or checkbox for schedule_enabled
    - Implement handleToggle method to update state
    - Show/hide cron input based on toggle state
    - Preserve cron expression when toggling off
    - _Requirements: 2.1, 2.2, 2.3_
  
  - [x] 8.5 Implement form submission
    - Add handleSubmit method that calls onSave prop with ScheduleConfig
    - Call POST /api/saved-searches/:id/schedule endpoint
    - Handle API validation errors and display to user
    - Show loading state during save operation
    - Close editor on successful save
    - _Requirements: 1.2, 1.4_
  
  - [ ]* 8.6 Write integration test for Schedule Editor
    - **Property 8: Client-Side Validation** - Invalid cron expressions prevent form submission
    - **Property 10: Next Execution Preview** - Valid cron expressions display calculated next execution time
    - **Validates: Requirements 3.3, 4.1, 10.2**

- [ ] 9. Enhance Saved Search Card component
  - [x] 9.1 Add schedule status indicator to SavedSearchCard
    - Modify website/src/components/SavedSearchCard.tsx to display scheduling status
    - Add visual indicator (icon or badge) when schedule_enabled is true
    - Use distinct color or icon to show active scheduling
    - _Requirements: 9.1_
  
  - [x] 9.2 Display next run and last run timestamps
    - Show next_run_at timestamp when schedule_enabled is true
    - Show "Scheduling disabled" message when schedule_enabled is false
    - Show last_run_at timestamp when it exists
    - Format timestamps in user-friendly format (e.g., "Next run: Tomorrow at 3:00 PM")
    - _Requirements: 4.3, 4.4, 9.2, 9.3, 9.4_
  
  - [x] 9.3 Add schedule editor access
    - Add "Edit Schedule" button or link to open ScheduleEditor component
    - Pass saved search data to ScheduleEditor
    - Handle onSave callback to refresh saved search data
    - _Requirements: 1.1, 1.4_
  
  - [ ]* 9.4 Write integration test for SavedSearchCard schedule display
    - **Property 11: Schedule Status Display** - Card displays next_run_at when enabled or "Scheduling disabled" when disabled
    - **Property 18: Schedule Status Indicator** - Visual indicator shown when schedule_enabled is true
    - **Property 19: Last Run Display** - last_run_at timestamp displayed when not null
    - **Validates: Requirements 4.3, 4.4, 9.1, 9.2, 9.3, 9.4**

- [ ] 10. Update Search History UI for execution type
  - [x] 10.1 Add execution type display to Search History component
    - Modify website/src/components/SearchHistory.tsx to display execution_type field
    - Show "Manual" or "Scheduled" badge for each search history entry
    - Use distinct colors or icons for manual vs scheduled executions
    - _Requirements: 6.4_
  
  - [ ]* 10.2 Write integration test for execution type display
    - **Property 15: Manual Execution Classification** - Manual searches recorded with execution_type='manual'
    - **Property 16: Scheduled Execution Classification** - Scheduled searches recorded with execution_type='scheduled'
    - **Property 17: Execution Type Display** - UI displays execution_type value for each entry
    - **Validates: Requirements 6.1, 6.2, 6.4**

- [ ] 11. Integration and end-to-end testing
  - [x] 11.1 Wire all scheduling components together
    - Connect ScheduleEditor to Schedule API endpoints
    - Connect SavedSearchCard to Schedule API for fetching schedule data
    - Ensure ScanScheduler monitoring starts on server initialization
    - Verify error logging integrated for all scheduling operations
    - _Requirements: All (integration)_
  
  - [ ]* 11.2 Write end-to-end integration tests
    - Test complete schedule configuration flow: create schedule → save → verify storage
    - Test scheduled execution flow: due search → execute → update timestamps → record history
    - Test schedule modification flow: modify cron → recalculate next_run_at → verify update
    - Test enable/disable flow: toggle → verify execution behavior
    - _Requirements: All (end-to-end validation)_
  
  - [ ]* 11.3 Write property-based tests for edge cases
    - **Property 7: Minimum Interval Enforcement** - All cron expressions with <15 minute intervals rejected at both client and server
    - **Property 14: Next Run Recalculation** - next_run_at correctly recalculated across various cron expressions and timezones
    - **Validates: Requirements 3.1, 3.2, 5.3**

- [x] 12. Final checkpoint and documentation
  - Ensure all tests pass, verify scheduling works end-to-end, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties using fast-check
- The implementation integrates with existing ScanScheduler, ContentScanner, and StorageService
- All 19 correctness properties from the design document are covered in property test tasks
- Cron validation happens at both client-side (Schedule Editor) and server-side (API) for defense in depth
- Scheduled searches use the same ContentScanner execution logic as manual searches for consistency
