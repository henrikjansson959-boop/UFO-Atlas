# Requirements Document: Automated Data Collection

## Introduction

The Automated Data Collection system discovers, extracts, and stores UFO-related content from internet sources. The system scans based on configurable keywords, structures the discovered content, stores it in Supabase, and provides an admin review workflow for quality control before publication.

## Glossary

- **Content_Scanner**: Component that searches internet sources for UFO-related content
- **Content_Extractor**: Component that extracts structured data from discovered sources
- **Review_Queue**: Database table containing auto-discovered content awaiting admin review
- **Timeline_Archive**: Database table containing approved UFO events, people, theories, and news
- **Admin_Interface**: UI component for reviewing and approving/rejecting content
- **Keyword_Config**: Database table storing search keywords and scanning parameters
- **Content_Item**: A discovered piece of UFO-related information (event, person, theory, or news)
- **Scan_Job**: A scheduled or triggered execution of the content scanning process
- **Tag**: A specific value within a Tag_Group that can be assigned to Content_Items (e.g., "Jesse Marcel" is a Tag in the "People" Tag_Group)
- **Tag_Group**: A hierarchical category containing related Tags (e.g., "People" contains "Jesse Marcel", "Ross Coulthart")
- **Search_History**: Database table recording which specific Tag values and keywords were used in each Scan_Job and when the search was performed
- **Saved_Search**: A reusable search configuration that can be named, versioned, and refined by admins to execute repeated searches with specific keywords and tag filters

## Requirements

### Requirement 1: Keyword-Based Content Discovery

**User Story:** As an admin, I want the system to automatically scan internet sources using keywords, so that UFO-related content is continuously discovered without manual searching.

#### Acceptance Criteria

1. THE Content_Scanner SHALL retrieve active keywords from Keyword_Config
2. WHEN a Scan_Job is triggered, THE Content_Scanner SHALL search internet sources using all active keywords
3. THE Content_Scanner SHALL record the scan timestamp and keyword used for each discovery
4. WHEN a Scan_Job executes, THE Content_Scanner SHALL record the search in Search_History with scan_job_id, search_timestamp, and keywords used
5. WHEN specific Tag values are selected to filter a scan, THE Content_Scanner SHALL record the selected tag_ids in Search_History
6. WHEN no Tag values are selected within a Tag_Group, THE Content_Scanner SHALL search using all Tag values in that Tag_Group
6. WHEN a scan completes, THE Content_Scanner SHALL log the number of Content_Items discovered
7. IF a scan fails, THEN THE Content_Scanner SHALL log the error and continue with remaining keywords

### Requirement 2: Content Extraction and Structuring

**User Story:** As an admin, I want discovered content to be automatically extracted and structured, so that I can review consistent, organized information.

#### Acceptance Criteria

1. WHEN a source is discovered, THE Content_Extractor SHALL extract title, description, date, source URL, and content type
2. THE Content_Extractor SHALL classify each Content_Item as event, person, theory, or news
3. WHEN date information is available, THE Content_Extractor SHALL parse it into ISO 8601 format
4. IF extraction fails for a source, THEN THE Content_Extractor SHALL log the failure and skip that source
5. THE Content_Extractor SHALL store raw source HTML alongside extracted data for admin reference

### Requirement 3: Supabase Storage

**User Story:** As a developer, I want all discovered content stored in Supabase, so that data is persisted and queryable.

#### Acceptance Criteria

1. WHEN content is extracted, THE Content_Extractor SHALL insert it into Review_Queue with status "pending"
2. THE Review_Queue SHALL store content_id, title, description, event_date, source_url, content_type, raw_html, discovered_at, and status
3. THE Timeline_Archive SHALL store content_id, title, description, event_date, source_url, content_type, approved_at, and approved_by
4. THE Keyword_Config SHALL store keyword_id, keyword_text, is_active, and last_scan_at
5. THE Tag_Groups table SHALL store tag_group_id, group_name, and created_at
6. THE Tags table SHALL store tag_id, tag_name, tag_group_id, and created_at
7. THE Content_Tags table SHALL store content_id, tag_id, and assigned_at for many-to-many relationships
8. THE Search_History table SHALL store search_id, scan_job_id, search_timestamp, keywords_used, selected_tag_ids (array of specific Tag values selected), saved_search_id (nullable), and saved_search_version (nullable)
9. THE Saved_Searches table SHALL store saved_search_id, search_name, version, keywords_used, selected_tag_ids, created_at, created_by, and parent_search_id (nullable, for tracking refinements)
10. WHEN a Scan_Job executes with Tag filtering, THE system SHALL create a Search_History record with the specific tag_ids that were selected via checkboxes
11. WHEN no Tag values are selected in a Tag_Group, THE Search_History SHALL record all tag_ids from that Tag_Group
12. WHEN a saved search is executed, THE Search_History SHALL record the saved_search_id and saved_search_version
13. WHEN a database write fails, THE system SHALL retry up to 3 times with exponential backoff

### Requirement 4: Admin Review Interface

**User Story:** As an admin, I want to review auto-discovered content before publication, so that only accurate and relevant information appears in the timeline.

#### Acceptance Criteria

1. THE Admin_Interface SHALL display the UFO Atlas logo prominently in the header or navigation area
2. THE Admin_Interface SHALL display all Content_Items with status "pending" from Review_Queue
3. THE Admin_Interface SHALL show title, description, event_date, source_url, content_type, and raw_html for each Content_Item
4. THE Admin_Interface SHALL provide "Approve" and "Reject" actions for each Content_Item
5. THE Admin_Interface SHALL display Content_Items ordered by discovered_at descending
6. THE Admin_Interface SHALL allow filtering by content_type
7. THE Admin_Interface SHALL display the hierarchical tag filtering UI with expandable Tag_Groups and checkboxes for specific Tag values
8. THE Admin_Interface SHALL show which specific Tag values were used in previous scans by retrieving them from Search_History
8. THE Admin_Interface SHALL display a list of Saved_Searches with search_name and version for quick access

### Requirement 5: Content Approval Workflow

**User Story:** As an admin, I want to approve or reject discovered content, so that only quality information is published to the timeline.

#### Acceptance Criteria

1. WHEN an admin approves a Content_Item, THE system SHALL copy it from Review_Queue to Timeline_Archive
2. WHEN an admin approves a Content_Item, THE system SHALL update Review_Queue status to "approved" and record approved_at timestamp
3. WHEN an admin rejects a Content_Item, THE system SHALL update Review_Queue status to "rejected" and record rejected_at timestamp
4. THE system SHALL record the admin user_id for all approve and reject actions
5. WHEN a Content_Item is approved, THE system SHALL make it available for future search queries

### Requirement 6: Keyword Management

**User Story:** As an admin, I want to configure scanning keywords, so that I can control what content the system discovers.

#### Acceptance Criteria

1. THE Admin_Interface SHALL allow admins to add new keywords to Keyword_Config
2. THE Admin_Interface SHALL allow admins to activate or deactivate existing keywords
3. THE Admin_Interface SHALL display last_scan_at timestamp for each keyword
4. WHEN a keyword is deactivated, THE Content_Scanner SHALL exclude it from future scans
5. THE system SHALL prevent duplicate keywords in Keyword_Config

### Requirement 7: Duplicate Detection

**User Story:** As an admin, I want the system to detect duplicate content, so that the same UFO event is not added multiple times.

#### Acceptance Criteria

1. WHEN storing a Content_Item, THE system SHALL check if source_url already exists in Review_Queue or Timeline_Archive
2. IF source_url exists, THEN THE system SHALL skip storing the duplicate and log the occurrence
3. THE system SHALL check for title similarity above 90% when source_url differs
4. IF a similar title exists, THEN THE system SHALL flag the Content_Item as "potential_duplicate" in Review_Queue
5. THE Admin_Interface SHALL highlight Content_Items flagged as "potential_duplicate"

### Requirement 8: Scan Scheduling, Manual Triggering, and Tag Filtering UI

**User Story:** As an admin, I want to manually trigger scans via a button in the admin UI with hierarchical tag filtering options and have scans run automatically on a schedule, so that I can discover specific content on-demand or continuously without manual intervention.

#### Acceptance Criteria

1. THE Admin_Interface SHALL provide a "Scan" button that allows admins to manually trigger Scan_Jobs
2. THE Admin_Interface SHALL display Tag_Groups as expandable sections (e.g., "People", "UFO", "Aliens", "Theories")
3. WHEN an admin expands a Tag_Group, THE Admin_Interface SHALL display all Tags within that group with checkboxes (e.g., "People" shows "Jesse Marcel", "Ross Coulthart")
4. WHEN no checkboxes are selected within a Tag_Group, THE system SHALL interpret this as "search all values" in that Tag_Group
5. WHEN specific Tag checkboxes are selected, THE system SHALL search only for those specific Tag values
6. WHEN an admin clicks the "Scan" button, THE system SHALL immediately execute a Scan_Job using all active keywords and the selected Tag values
7. THE Admin_Interface SHALL provide a "Save Search" option that allows admins to save the current search configuration with a custom name
8. THE system SHALL execute Scan_Jobs at configurable intervals for automatic discovery
9. THE system SHALL prevent overlapping Scan_Jobs for the same keyword
10. WHEN a Scan_Job starts, THE system SHALL update last_scan_at in Keyword_Config
11. IF a Scan_Job exceeds 30 minutes, THEN THE system SHALL terminate it and log a timeout error
12. THE Admin_Interface SHALL persist the selected Tag values so admins can see what was previously searched

### Requirement 9: Error Handling and Logging

**User Story:** As a developer, I want comprehensive error logging, so that I can troubleshoot scanning and storage issues.

#### Acceptance Criteria

1. WHEN any component encounters an error, THE system SHALL log error message, timestamp, component name, and stack trace
2. THE system SHALL log all Scan_Job executions with start time, end time, and items discovered
3. THE system SHALL log all database operations with query type and execution time
4. IF network requests fail, THEN THE system SHALL log the URL, status code, and error message
5. THE Admin_Interface SHALL display recent error logs for admin review

### Requirement 10: Data Validation

**User Story:** As an admin, I want discovered content to be validated before storage, so that incomplete or malformed data is filtered out.

#### Acceptance Criteria

1. THE Content_Extractor SHALL require title and source_url for all Content_Items
2. WHEN title is missing, THE Content_Extractor SHALL skip the Content_Item and log a validation error
3. WHEN source_url is invalid, THE Content_Extractor SHALL skip the Content_Item and log a validation error
4. THE Content_Extractor SHALL validate that content_type is one of: event, person, theory, news
5. WHEN event_date is present, THE Content_Extractor SHALL validate it is a valid date format

### Requirement 11: Tag Management and Hierarchical Organization

**User Story:** As an admin, I want to organize content using predefined tags within hierarchical tag groups, so that I can categorize and filter UFO-related information effectively with specific values.

#### Acceptance Criteria

1. THE system SHALL provide predefined Tag_Groups: "People", "UFO", "Aliens", and "Theories"
2. THE "People" Tag_Group SHALL contain Tags including "Jesse Marcel" and "Ross Coulthart"
3. THE "UFO" Tag_Group SHALL contain Tags including "UFO", "Area51", "Roswell", "Aztec", "Crash", and "Observation"
4. THE "Aliens" Tag_Group SHALL contain Tags for alien-related terms
5. THE "Theories" Tag_Group SHALL contain Tags for specific theory names
6. THE Tags table SHALL store tag_id, tag_name, tag_group_id, and created_at to represent specific values within Tag_Groups
7. THE Admin_Interface SHALL allow admins to create new Tags and assign them to Tag_Groups
8. THE Admin_Interface SHALL allow admins to assign multiple Tags to Content_Items in Review_Queue and Timeline_Archive
9. THE Admin_Interface SHALL display all Tags grouped hierarchically by Tag_Group for selection
10. THE Admin_Interface SHALL allow filtering Content_Items by one or more specific Tag values
11. WHEN a Content_Item is approved, THE system SHALL preserve all assigned Tags in Timeline_Archive
12. THE Admin_Interface SHALL display assigned Tags for each Content_Item in the review list
13. THE system SHALL allow admins to edit Tag names and Tag_Group assignments
14. THE system SHALL prevent deletion of Tags that are assigned to Content_Items

### Requirement 12: Saved Search Management and Versioning

**User Story:** As an admin, I want to save search configurations for reuse and create refined versions of saved searches, so that I can quickly execute common searches and track how my search strategies evolve over time.

#### Acceptance Criteria

1. WHEN an admin configures a search with keywords and tag filters, THE Admin_Interface SHALL provide an option to save the search configuration with a custom name
2. WHEN an admin saves a search for the first time, THE system SHALL create a Saved_Search record with version 1
3. THE Admin_Interface SHALL display a list of all Saved_Searches showing search_name and current version
4. WHEN an admin selects a Saved_Search from the list, THE Admin_Interface SHALL load the keywords and tag filters from that saved search
5. THE Admin_Interface SHALL provide an "Execute" action for each Saved_Search that runs a Scan_Job with the saved configuration
6. WHEN a Saved_Search is executed, THE system SHALL record the saved_search_id and saved_search_version in Search_History
7. THE Admin_Interface SHALL provide a "Refine" action that allows admins to modify a Saved_Search's keywords or tag filters
8. WHEN an admin refines a Saved_Search and saves it, THE system SHALL create a new Saved_Search record with incremented version and set parent_search_id to the original saved_search_id
9. THE system SHALL preserve all previous versions of a Saved_Search for audit purposes
10. THE Admin_Interface SHALL display the version history for each Saved_Search showing version number, created_at, and created_by
11. WHEN an admin executes a "fire and forget" search, THE system SHALL execute the Scan_Job without creating a Saved_Search record
12. THE Admin_Interface SHALL clearly distinguish between "Execute Once" (fire and forget) and "Save and Execute" options
13. THE system SHALL allow admins to delete Saved_Searches that are no longer needed
14. WHEN a Saved_Search is deleted, THE system SHALL preserve Search_History records that reference it for audit purposes
