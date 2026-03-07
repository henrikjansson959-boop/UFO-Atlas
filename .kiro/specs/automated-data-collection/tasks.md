# Implementation Plan: Automated Data Collection

## Overview

This implementation plan breaks down the Automated Data Collection system into discrete coding tasks. The approach prioritizes data infrastructure first (database schema and storage layer), followed by core scanning and extraction logic, then the admin interface, and finally integration and testing.

The system will be built using TypeScript for both backend and frontend, with Supabase as the database, Puppeteer/Cheerio for web scraping, and fast-check for property-based testing.

## Tasks

- [x] 1. Set up project structure and database schema
  - [x] 1.1 Initialize TypeScript project with Node.js backend
    - Create package.json with dependencies: typescript, @supabase/supabase-js, puppeteer, cheerio, axios, node-cron, fast-levenshtein, fast-check
    - Configure tsconfig.json for strict type checking
    - Set up project directory structure: src/scanner, src/extractor, src/storage, src/admin, src/types
    - _Requirements: All (foundation)_
  
  - [x] 1.2 Create Supabase database schema
    - Write SQL migration file to create all 9 tables: Tag_Groups, Tags, Review_Queue, Timeline_Archive, Keyword_Config, Content_Tags, Search_History, Saved_Searches, Error_Logs
    - Add all indexes for performance optimization
    - Add foreign key constraints and check constraints
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 11.6_
  
  - [x] 1.3 Define TypeScript interfaces and types
    - Create types file with all interfaces from design: ContentScanner, ContentExtractor, DataValidator, DuplicateDetector, StorageService, AdminAPI
    - Define data model types: ExtractedContent, ContentItem, Keyword, Tag, TagGroup, SavedSearch, ScanResult, ValidationResult, DuplicateCheckResult
    - _Requirements: All (type safety foundation)_
  
  - [x] 1.4 Seed initial tag groups and tags
    - Write seed script to populate Tag_Groups: "People", "UFO", "Aliens", "Theories"
    - Populate Tags for each group: "Jesse Marcel", "Ross Coulthart" in People; "UFO", "Area51", "Roswell", "Aztec", "Crash", "Observation" in UFO
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [x] 2. Implement Supabase storage layer
  - [x] 2.1 Create StorageService class with connection management
    - Implement Supabase client initialization with connection pooling
    - Add retry logic with exponential backoff for all database operations
    - Implement transaction support for multi-step operations
    - _Requirements: 3.13_
  
  - [x] 2.2 Implement keyword management methods
    - Write addKeyword, activateKeyword, deactivateKeyword, getActiveKeywords methods
    - Enforce keyword uniqueness constraint
    - _Requirements: 6.1, 6.2, 6.4, 6.5_
  
  - [ ]* 2.3 Write property test for keyword management
    - **Property 25: Keyword Addition** - Adding a keyword creates a record in Keyword_Config
    - **Property 26: Keyword Activation Toggle** - Toggling activation updates is_active field
    - **Property 28: Keyword Uniqueness** - Only one record per keyword_text
    - **Validates: Requirements 6.1, 6.2, 6.5**
  
  - [x] 2.4 Implement tag management methods
    - Write createTag, updateTag, deleteTag, getTagsByGroup, assignTagsToContent methods
    - Prevent deletion of tags in use
    - _Requirements: 11.7, 11.8, 11.14_
  
  - [ ]* 2.5 Write property test for tag management
    - **Property 44: Tag Creation and Assignment** - Creating tag inserts record with tag_name and tag_group_id
    - **Property 45: Content Tag Assignment** - Assigning tags creates Content_Tags records
    - **Property 48: Tag Deletion Protection** - Cannot delete tags with Content_Tags references
    - **Validates: Requirements 11.7, 11.8, 11.14**
  
  - [x] 2.6 Implement review queue methods
    - Write insertReviewQueue, getPendingContent methods with filtering support
    - Implement content type and tag filtering
    - _Requirements: 3.1, 4.2, 4.6, 11.10_
  
  - [ ]* 2.7 Write property test for review queue
    - **Property 12: Pending Status on Insertion** - Inserted content has status 'pending'
    - **Property 15: Pending Content Display** - getPendingContent returns all pending items
    - **Property 19: Content Type Filtering** - Filtering by content_type returns only matching items
    - **Validates: Requirements 3.1, 4.2, 4.6**
  
  - [x] 2.8 Implement approval workflow methods
    - Write approveContent and rejectContent methods
    - Copy approved content from Review_Queue to Timeline_Archive with tags
    - Update status and timestamps, record admin user_id
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 11.11_
  
  - [ ]* 2.9 Write property test for approval workflow
    - **Property 21: Approval Data Transfer** - Approved content copied to Timeline_Archive with same fields
    - **Property 22: Rejection Status Update** - Rejected content has status 'rejected' and rejected_at
    - **Property 23: Admin Action Attribution** - reviewed_by field contains admin user_id
    - **Property 47: Tag Preservation on Approval** - Content_Tags preserved with Timeline_Archive content_id
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.4, 11.11**
  
  - [x] 2.10 Implement search history methods
    - Write recordSearchHistory method to log scan executions with keywords, tag_ids, saved_search references
    - Implement getSearchHistory method for admin UI
    - _Requirements: 1.4, 1.5, 3.8, 3.10, 3.11, 3.12_
  
  - [ ]* 2.11 Write property test for search history
    - **Property 3: Scan Metadata Recording** - Search_History contains scan_job_id, timestamp, keywords, tag_ids
    - **Property 13: Saved Search History Linkage** - Saved search executions record saved_search_id and version
    - **Validates: Requirements 1.4, 1.5, 3.8, 3.10, 3.12**
  
  - [x] 2.12 Implement saved search methods
    - Write createSavedSearch, getSavedSearches, getSavedSearchVersions, deleteSavedSearch methods
    - Handle versioning logic: increment version for refinements, set parent_search_id
    - _Requirements: 12.1, 12.2, 12.8, 12.9, 12.13, 12.14_
  
  - [ ]* 2.13 Write property test for saved searches
    - **Property 49: Initial Saved Search Versioning** - New saved search has version = 1
    - **Property 53: Saved Search Refinement Versioning** - Refined search increments version and sets parent_search_id
    - **Property 56: Saved Search Deletion with History Preservation** - Deleted saved search preserves Search_History records
    - **Validates: Requirements 12.2, 12.8, 12.14**

- [x] 3  n.      . Checkpoint - Verify storage layer
  - Ensure all storage layer tests pass, ask the user if questions arise.

- [x] 4. Implement data validation and duplicate detection
  - [x] 4.1 Create DataValidator class
    - Implement validate method checking required fields (title, source_url)
    - Validate content_type enum values
    - Validate date format (ISO 8601)
    - Return ValidationResult with errors array
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [ ]* 4.2 Write property test for data validation
    - **Property 42: Required Field Validation** - Missing title or source_url fails validation
    - **Property 43: Date Format Validation** - event_date must be valid date format
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.5**
  
  - [x] 4.3 Create DuplicateDetector class
    - Implement checkDuplicate method checking source_url existence in Review_Queue and Timeline_Archive
    - Calculate title similarity using fast-levenshtein library
    - Flag potential duplicates with >90% similarity
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [ ]* 4.4 Write property test for duplicate detection
    - **Property 29: Source URL Duplicate Detection** - Existing source_url skips storage and logs
    - **Property 30: Title Similarity Detection** - >90% title similarity flags is_potential_duplicate
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4**

- [x] 5. Implement content extraction
  - [x] 5.1 Create ContentExtractor class with Puppeteer/Cheerio
    - Implement extract method to fetch HTML from URL
    - Extract title, description, date, content type from HTML structure
    - Classify content as event, person, theory, or news
    - Store raw HTML for admin reference
    - Handle extraction errors with logging
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [ ]* 5.2 Write property test for content extraction
    - **Property 7: Content Extraction Completeness** - ExtractedContent contains all required fields
    - **Property 8: Content Type Classification** - contentType is one of: event, person, theory, news
    - **Property 9: Date Format Standardization** - eventDate in ISO 8601 format
    - **Property 10: Extraction Error Handling** - Failed extraction logs error and skips content
    - **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
  
  - [x] 5.3 Integrate extractor with validator and duplicate detector
    - Wire ContentExtractor to call DataValidator before storage
    - Wire ContentExtractor to call DuplicateDetector before storage
    - Only insert valid, non-duplicate content into Review_Queue
    - _Requirements: 3.1, 7.1, 7.2, 10.1_

- [x] 6. Implement content scanner
  - [x] 6.1 Create ContentScanner class
    - Implement getActiveKeywords method to retrieve from Keyword_Config
    - Implement executeScan method with keyword and tag filter parameters
    - Search internet sources using keywords (implement basic web search or API integration)
    - Pass discovered URLs to ContentExtractor
    - Handle network errors with retry logic
    - _Requirements: 1.1, 1.2, 1.6, 1.8_
  
  - [ ]* 6.2 Write property test for content scanner
    - **Property 1: Active Keyword Retrieval** - getActiveKeywords returns only is_active = true
    - **Property 2: Complete Keyword Coverage** - executeScan uses all active keywords
    - **Property 4: Default Tag Group Expansion** - No selected tags searches all tag_ids in group
    - **Property 6: Scan Error Resilience** - Failed keyword continues with remaining keywords
    - **Validates: Requirements 1.1, 1.2, 1.6, 1.8**
  
  - [x] 6.3 Implement scan history recording
    - Call StorageService.recordSearchHistory after each scan
    - Record scan_job_id, keywords_used, selected_tag_ids, saved_search references
    - Log items_discovered count
    - _Requirements: 1.3, 1.4, 1.5, 1.7, 3.10, 3.11_
  
  - [ ]* 6.4 Write property test for scan history recording
    - **Property 3: Scan Metadata Recording** - Search_History populated with all metadata
    - **Property 5: Scan Completion Logging** - items_discovered count recorded
    - **Validates: Requirements 1.3, 1.4, 1.5, 1.7, 3.10**

- [x] 7. Implement scan scheduler
  - [x] 7.1 Create ScanScheduler class with node-cron
    - Implement scheduled scan execution at configurable intervals
    - Prevent overlapping scans for same keyword
    - Update last_scan_at timestamps in Keyword_Config
    - Enforce 30-minute timeout per scan
    - _Requirements: 8.8, 8.9, 8.10, 8.11_
  
  - [ ]* 7.2 Write property test for scan scheduler
    - **Property 35: Scan Scheduling** - Scans execute at configured intervals
    - **Property 36: Scan Concurrency Control** - At most one active scan per keyword
    - **Property 37: Scan Timestamp Update** - last_scan_at updated on scan start
    - **Property 38: Scan Timeout Enforcement** - Scans terminated after 30 minutes
    - **Validates: Requirements 8.8, 8.9, 8.10, 8.11**

- [x] 8. Checkpoint - Verify backend core functionality
  - Ensure all backend tests pass, ask the user if questions arise.

- [x] 9. Implement error logging
  - [x] 9.1 Create ErrorLogger class
    - Implement log method to insert into Error_Logs table
    - Log timestamp, component, message, stack trace, scan_job_id
    - Integrate with all components (Scanner, Extractor, Storage)
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  
  - [ ]* 9.2 Write property test for error logging
    - **Property 39: Error Logging Completeness** - Error_Logs contains all error metadata
    - **Property 40: Scan Execution Logging** - Scan executions logged with metrics
    - **Property 41: Network Error Logging** - Failed requests logged with URL and status
    - **Validates: Requirements 9.1, 9.2, 9.4**

- [~] 10. Implement admin interface - Review Queue UI
  - [~] 10.1 Create React app structure with TypeScript
    - Initialize React project with TypeScript and Tailwind CSS or Material-UI
    - Set up routing for review queue, keyword management, tag management, saved searches
    - Add UFO Atlas logo to header/navigation
    - _Requirements: 4.1_
  
  - [~] 10.2 Build review queue component
    - Display pending content from Review_Queue with all fields
    - Show title, description, event_date, source_url, content_type, raw_html
    - Order by discovered_at descending
    - Highlight potential duplicates
    - _Requirements: 4.2, 4.3, 4.5, 7.5_
  
  - [~] 10.3 Add approve/reject action buttons
    - Implement approve button calling AdminAPI.approveContent
    - Implement reject button calling AdminAPI.rejectContent
    - Show confirmation dialogs
    - Update UI after action completes
    - _Requirements: 4.4, 5.1, 5.3_
  
  - [~] 10.4 Add content type filtering
    - Add dropdown or tabs for filtering by content_type
    - Filter displayed content based on selection
    - _Requirements: 4.6_
  
  - [~] 10.5 Add tag assignment UI
    - Display hierarchical tag structure with Tag_Groups and Tags
    - Allow admins to assign multiple tags to content items
    - Show assigned tags for each content item
    - _Requirements: 11.8, 11.9, 11.12_
  
  - [ ]* 10.6 Write integration test for review queue UI
    - **Property 16: Content Field Display Completeness** - UI shows all content fields
    - **Property 17: Action Button Availability** - Approve and Reject buttons present
    - **Property 18: Chronological Ordering** - Content ordered by discovered_at descending
    - **Property 31: Duplicate Highlighting** - Potential duplicates visually highlighted
    - **Validates: Requirements 4.3, 4.4, 4.5, 7.5**

- [~] 11. Implement admin interface - Keyword Management UI
  - [~] 11.1 Build keyword management component
    - Display all keywords with is_active status and last_scan_at
    - Add form to add new keywords
    - Add toggle buttons to activate/deactivate keywords
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ]* 11.2 Write integration test for keyword management UI
    - **Property 25: Keyword Addition** - Adding keyword via UI creates Keyword_Config record
    - **Property 26: Keyword Activation Toggle** - Toggle updates is_active field
    - **Property 27: Deactivated Keyword Exclusion** - Inactive keywords excluded from scans
    - **Validates: Requirements 6.1, 6.2, 6.4**

- [~] 12. Implement admin interface - Tag Management UI
  - [~] 12.1 Build tag management component
    - Display Tag_Groups as expandable sections
    - Show Tags within each group
    - Add forms to create new tags and assign to groups
    - Add edit and delete actions with protection for tags in use
    - _Requirements: 11.7, 11.9, 11.13, 11.14_
  
  - [ ]* 12.2 Write integration test for tag management UI
    - **Property 20: Hierarchical Tag UI Structure** - Tag_Groups expandable with Tags and checkboxes
    - **Property 44: Tag Creation and Assignment** - Creating tag via UI inserts Tags record
    - **Property 48: Tag Deletion Protection** - Cannot delete tags assigned to content
    - **Validates: Requirements 11.7, 11.9, 11.14**

- [~] 13. Implement admin interface - Manual Scan Trigger with Tag Filtering
  - [~] 13.1 Build scan trigger component with hierarchical tag filtering
    - Add "Scan" button to trigger manual scans
    - Display Tag_Groups as expandable sections
    - Show checkboxes for each Tag within groups
    - Implement "all tags" logic when no checkboxes selected
    - Pass selected tag_ids to AdminAPI.triggerScan
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_
  
  - [ ]* 13.2 Write integration test for scan trigger UI
    - **Property 20: Hierarchical Tag UI Structure** - Tag_Groups expandable with checkboxes
    - **Property 32: Tag Filter Application** - Selected tag_ids used in scan
    - **Property 33: Manual Scan Execution** - Scan button triggers immediate scan
    - **Property 4: Default Tag Group Expansion** - No selection searches all tags in group
    - **Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5, 8.6**

- [~] 14. Implement admin interface - Saved Search Management UI
  - [~] 14.1 Build saved search component
    - Display list of saved searches with search_name and version
    - Add "Save Search" button to save current configuration
    - Add "Execute" button for each saved search
    - Add "Refine" button to create new version
    - Show version history for each saved search
    - Distinguish "Execute Once" vs "Save and Execute"
    - _Requirements: 12.1, 12.3, 12.4, 12.5, 12.7, 12.10, 12.12_
  
  - [~] 14.2 Implement saved search execution and refinement
    - Load keywords and tag filters when saved search selected
    - Execute saved search and record in Search_History
    - Create new version with parent_search_id on refinement
    - Allow deletion with history preservation
    - _Requirements: 12.4, 12.5, 12.6, 12.8, 12.13, 12.14_
  
  - [ ]* 14.3 Write integration test for saved search UI
    - **Property 34: Search Configuration Persistence** - Saved search creates Saved_Searches record
    - **Property 50: Saved Search Display** - UI displays saved searches with name and version
    - **Property 51: Saved Search Configuration Loading** - Selecting saved search loads configuration
    - **Property 52: Saved Search Execution** - Executing triggers scan with saved configuration
    - **Property 53: Saved Search Refinement Versioning** - Refinement creates new version with parent_search_id
    - **Property 55: Fire and Forget Execution** - Execute once doesn't create Saved_Search record
    - **Validates: Requirements 12.1, 12.3, 12.4, 12.5, 12.6, 12.8, 12.11**

- [~] 15. Implement admin interface - Error Logs and Search History UI
  - [~] 15.1 Build error logs component
    - Display recent error logs with timestamp, component, message
    - Add filtering by component and date range
    - _Requirements: 9.5_
  
  - [~] 15.2 Build search history component
    - Display search history with timestamp, keywords, tag_ids, items_discovered
    - Show saved_search_id and version when applicable
    - Link to saved search details
    - _Requirements: 4.8, 8.12_

- [~] 16. Checkpoint - Verify admin interface
  - Ensure all admin UI components render correctly and interact with backend, ask the user if questions arise.

- [~] 17. Implement AdminAPI backend endpoints
  - [~] 17.1 Create Express.js API server with TypeScript
    - Set up Express server with CORS and body parsing
    - Define routes for all AdminAPI methods
    - Add authentication middleware for admin actions
    - _Requirements: All (API foundation)_
  
  - [~] 17.2 Implement review queue endpoints
    - GET /api/review-queue - Get pending content with filters
    - POST /api/review-queue/:id/approve - Approve content
    - POST /api/review-queue/:id/reject - Reject content
    - _Requirements: 4.2, 5.1, 5.3_
  
  - [~] 17.3 Implement keyword management endpoints
    - GET /api/keywords - Get all keywords
    - POST /api/keywords - Add new keyword
    - PATCH /api/keywords/:id/toggle - Activate/deactivate keyword
    - _Requirements: 6.1, 6.2_
  
  - [~] 17.4 Implement tag management endpoints
    - GET /api/tag-groups - Get all tag groups with tags
    - POST /api/tags - Create new tag
    - PATCH /api/tags/:id - Update tag
    - DELETE /api/tags/:id - Delete tag
    - POST /api/content/:id/tags - Assign tags to content
    - _Requirements: 11.7, 11.8, 11.13_
  
  - [~] 17.5 Implement scan trigger endpoint
    - POST /api/scan/trigger - Trigger manual scan with tag filters
    - _Requirements: 8.6_
  
  - [~] 17.6 Implement saved search endpoints
    - GET /api/saved-searches - Get all saved searches
    - POST /api/saved-searches - Create new saved search
    - POST /api/saved-searches/:id/execute - Execute saved search
    - POST /api/saved-searches/:id/refine - Refine saved search
    - DELETE /api/saved-searches/:id - Delete saved search
    - GET /api/saved-searches/:name/versions - Get version history
    - _Requirements: 12.1, 12.3, 12.5, 12.7, 12.8, 12.13_
  
  - [~] 17.7 Implement error logs and search history endpoints
    - GET /api/error-logs - Get recent error logs
    - GET /api/search-history - Get search history
    - _Requirements: 9.5, 4.8_

- [~] 18. Integration and end-to-end testing
  - [~] 18.1 Wire all components together
    - Connect AdminAPI to StorageService, ContentScanner, ScanScheduler
    - Connect ContentScanner to ContentExtractor, DataValidator, DuplicateDetector
    - Connect React UI to AdminAPI endpoints
    - Ensure all error logging integrated
    - _Requirements: All (integration)_
  
  - [ ]* 18.2 Write end-to-end integration tests
    - Test complete scan flow: trigger → discover → extract → validate → store
    - Test approval workflow: review → approve → Timeline_Archive
    - Test saved search flow: create → execute → refine → version history
    - Test tag filtering: select tags → scan → verify Search_History
    - _Requirements: All (end-to-end validation)_
  
  - [ ]* 18.3 Write property-based tests for database schema integrity
    - **Property 11: Database Schema Integrity** - All required fields populated for all tables
    - **Property 14: Database Retry Logic** - Failed operations retry 3 times with backoff
    - **Validates: Requirements 3.2-3.9, 3.13, 11.6**

- [~] 19. Final checkpoint and deployment preparation
  - Ensure all tests pass, review code quality, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties using fast-check
- Unit tests validate specific examples and edge cases
- The implementation prioritizes data infrastructure first, then core logic, then UI
- All 56 correctness properties from the design document are covered in property test tasks
