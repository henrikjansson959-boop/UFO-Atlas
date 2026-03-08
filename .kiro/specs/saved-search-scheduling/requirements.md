# Requirements Document

## Introduction

This feature enables administrators to schedule automated execution of saved searches using cron-based scheduling. Scheduled searches execute automatically at specified intervals and record their execution history, allowing administrators to automate recurring search operations without manual intervention.

## Glossary

- **Admin**: A user with administrative privileges who can manage saved search schedules
- **Saved_Search**: A previously saved search configuration that can be executed
- **Schedule**: A cron-based configuration that defines when a saved search should execute automatically
- **Cron_Expression**: A time-based scheduling expression following standard cron syntax
- **Search_History**: A database table that records all search executions
- **ScanScheduler**: The backend service responsible for managing and executing scheduled tasks
- **Schedule_Editor**: The UI component that allows admins to configure search schedules
- **Execution_Type**: A classification indicating whether a search was executed manually or automatically

## Requirements

### Requirement 1: Schedule Management

**User Story:** As an admin, I want to create and modify schedules for saved searches, so that I can automate recurring search operations.

#### Acceptance Criteria

1. THE Schedule_Editor SHALL provide a form to configure cron expressions for any Saved_Search
2. WHEN an admin submits a valid schedule configuration, THE System SHALL store the schedule_enabled, cron_expression, and next_run_at values in the Saved_Searches table
3. WHEN an admin submits an invalid cron expression, THE System SHALL display a descriptive validation error
4. THE Schedule_Editor SHALL allow admins to modify existing schedule configurations
5. WHEN a schedule configuration is modified, THE System SHALL recalculate and update the next_run_at timestamp

### Requirement 2: Schedule Activation Control

**User Story:** As an admin, I want to enable or disable scheduling for each saved search, so that I can control which searches run automatically without deleting the schedule configuration.

#### Acceptance Criteria

1. THE Schedule_Editor SHALL provide a toggle control to enable or disable scheduling
2. WHEN an admin enables scheduling, THE System SHALL set schedule_enabled to true and calculate next_run_at
3. WHEN an admin disables scheduling, THE System SHALL set schedule_enabled to false and preserve the cron_expression
4. WHILE schedule_enabled is false, THE ScanScheduler SHALL NOT execute the Saved_Search

### Requirement 3: Minimum Interval Enforcement

**User Story:** As a system administrator, I want to enforce a minimum 15-minute interval between scheduled executions, so that I can prevent system overload from excessive automation.

#### Acceptance Criteria

1. WHEN an admin submits a cron expression, THE System SHALL validate that the minimum interval between executions is 15 minutes
2. IF a cron expression would result in executions more frequent than 15 minutes, THEN THE System SHALL reject the configuration and display an error message
3. THE Schedule_Editor SHALL validate cron expressions client-side before submission
4. THE API SHALL validate cron expressions server-side and return a 400 error for invalid intervals

### Requirement 4: Next Execution Preview

**User Story:** As an admin, I want to see when a scheduled search will next execute, so that I can verify my schedule configuration is correct.

#### Acceptance Criteria

1. WHEN an admin enters a valid cron expression, THE Schedule_Editor SHALL display the calculated next execution time
2. THE Schedule_Editor SHALL update the preview in real-time as the cron expression is modified
3. WHEN a schedule is saved, THE System SHALL display the next_run_at timestamp on the saved search card
4. THE Saved_Search card SHALL display "Scheduling disabled" WHILE schedule_enabled is false

### Requirement 5: Automated Execution

**User Story:** As an admin, I want scheduled searches to execute automatically at the specified times, so that I don't need to manually trigger recurring searches.

#### Acceptance Criteria

1. WHEN the current time matches or exceeds next_run_at for a Saved_Search, THE ScanScheduler SHALL execute the search using the same logic as manual execution
2. WHEN a scheduled execution completes, THE ScanScheduler SHALL update last_run_at to the execution timestamp
3. WHEN a scheduled execution completes, THE ScanScheduler SHALL calculate and update next_run_at based on the cron_expression
4. THE ScanScheduler SHALL check for due scheduled searches at least once per minute

### Requirement 6: Execution History Tracking

**User Story:** As an admin, I want to distinguish between manual and automated search executions in the history, so that I can audit and analyze search patterns.

#### Acceptance Criteria

1. WHEN a search is executed manually, THE System SHALL record an entry in Search_History with execution_type set to 'manual'
2. WHEN a search is executed by the ScanScheduler, THE System SHALL record an entry in Search_History with execution_type set to 'scheduled'
3. THE Search_History table SHALL include an execution_type column to store this classification
4. THE Search_History UI SHALL display the execution_type for each recorded search

### Requirement 7: Database Schema Extensions

**User Story:** As a developer, I want the database schema to support scheduling metadata, so that the system can persist and manage schedule configurations.

#### Acceptance Criteria

1. THE Saved_Searches table SHALL include a schedule_enabled column of type boolean with default value false
2. THE Saved_Searches table SHALL include a cron_expression column of type text that allows null values
3. THE Saved_Searches table SHALL include a next_run_at column of type timestamp that allows null values
4. THE Saved_Searches table SHALL include a last_run_at column of type timestamp that allows null values
5. THE Search_History table SHALL include an execution_type column of type text with allowed values 'manual' or 'scheduled'

### Requirement 8: Schedule API Operations

**User Story:** As a frontend developer, I want API endpoints to manage schedules, so that I can build the scheduling UI.

#### Acceptance Criteria

1. THE API SHALL provide an endpoint to create a schedule for a Saved_Search
2. THE API SHALL provide an endpoint to update an existing schedule configuration
3. THE API SHALL provide an endpoint to retrieve schedule configuration for a Saved_Search
4. THE API SHALL provide an endpoint to delete a schedule configuration
5. WHEN any schedule modification endpoint is called, THE API SHALL validate the cron_expression and enforce the 15-minute minimum interval

### Requirement 9: Schedule Status Visibility

**User Story:** As an admin, I want to see scheduling status on saved search cards, so that I can quickly identify which searches are automated.

#### Acceptance Criteria

1. THE Saved_Search card SHALL display a visual indicator WHEN schedule_enabled is true
2. WHILE schedule_enabled is true, THE Saved_Search card SHALL display the next_run_at timestamp
3. WHILE schedule_enabled is false, THE Saved_Search card SHALL display "Scheduling disabled"
4. THE Saved_Search card SHALL display the last_run_at timestamp WHEN a scheduled execution has occurred

### Requirement 10: Cron Expression Validation

**User Story:** As an admin, I want clear feedback on invalid cron expressions, so that I can correct my schedule configuration.

#### Acceptance Criteria

1. WHEN an admin enters an invalid cron expression, THE Schedule_Editor SHALL display a descriptive error message
2. THE Schedule_Editor SHALL validate cron syntax before allowing form submission
3. THE API SHALL validate cron expressions and return specific error messages for common mistakes
4. THE System SHALL provide examples of valid cron expressions in the Schedule_Editor interface
