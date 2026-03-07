# Data Flow Diagrams
## Automated Data Collection System

This document provides detailed data flow diagrams for all major workflows in the system.

---

## 1. Content Discovery and Extraction Flow

### Overview
This flow shows how content is discovered, extracted, validated, and stored in the review queue.

### Participants
- Admin User
- Frontend UI (ScanTrigger.tsx)
- API Server
- ContentScanner
- ContentExtractor
- DataValidator
- DuplicateDetector
- StorageService
- Supabase Database

### Flow Diagram

```
Admin User
    │
    │ 1. Select tags and click "Scan"
    ↓
ScanTrigger UI (React)
    │
    │ 2. POST /api/scan/trigger
    │    Body: { tagIds: [1,2,3], savedSearchId: null }
    ↓
API Server (Express)
    │
    │ 3. contentScanner.executeScan(keywords, tagIds)
    ↓
ContentScanner
    │
    ├─→ 4a. storageService.getActiveKeywords()
    │   Returns: ["UFO", "alien", "Roswell"]
    │
    ├─→ 4b. getTagNames(tagIds)
    │   Returns: ["Jesse Marcel", "Area51"]
    │
    └─→ 4c. For each keyword:
        │
        └─→ searchInternet(keyword, tagNames)
            │ Query: "UFO Jesse Marcel Area51"
            │ Returns: [url1, url2, url3]
            │
            └─→ For each URL:
                │
                └─→ contentExtractor.extract(url)

ContentExtractor
    │
    ├─→ 5a. Fetch HTML from URL
    │   Returns: raw HTML content
    │
    ├─→ 5b. Parse and extract fields
    │   Extracts: title, description, date, contentType
    │
    ├─→ 5c. dataValidator.validate(content)
    │   Checks: required fields, formats, enums
    │   Returns: { isValid: true, errors: [] }
    │
    ├─→ 5d. duplicateDetector.checkDuplicate(content)
    │   Checks: URL exists, title similarity
    │   Returns: { isDuplicate: false, isPotentialDuplicate: false }
    │
    └─→ 5e. storageService.insertReviewQueue(content, isPotentialDuplicate)
        │
        ↓
StorageService
    │
    └─→ 6. INSERT INTO Review_Queue
        │  (title, description, event_date, source_url, 
        │   content_type, raw_html, status='pending')
        ↓
Supabase Database
    │
    └─→ 7. Content stored in Review_Queue table

ContentScanner (continued)
    │
    └─→ 8. storageService.recordSearchHistory(
           scanJobId, keywords, tagIds, itemsDiscovered)
        │
        ↓
StorageService
    │
    └─→ 9. INSERT INTO Search_History
        │  (scan_job_id, keywords_used, selected_tag_ids,
        │   items_discovered, search_timestamp)
        ↓
Supabase Database
    │
    └─→ 10. Search history recorded

API Server
    │
    └─→ 11. Return ScanResult to frontend
        │   { scanJobId, discoveredUrls, itemsDiscovered, errorCount }
        ↓
ScanTrigger UI
    │
    └─→ 12. Display scan results to admin
```

### Key Data Transformations

1. **Tag IDs → Tag Names**: Scanner converts tag IDs to names for search queries
2. **Search Query Construction**: Combines keywords with tag names
3. **HTML → Structured Data**: Extractor parses HTML into typed fields
4. **Validation**: Ensures data meets schema requirements
5. **Duplicate Detection**: Compares URLs and title similarity
6. **Database Storage**: Persists validated, non-duplicate content

---

## 2. Content Approval Workflow

### Overview
This flow shows how admins review and approve content from the review queue.

### Flow Diagram

```
Admin User
    │
    │ 1. View pending content in Review Queue
    ↓
ReviewQueue UI (React)
    │
    ├─→ 2a. GET /api/review-queue?contentType=event
    │   Returns: Array of ContentItem objects
    │
    └─→ 2b. Display content with approve/reject buttons
        │
        │ 3. Admin clicks "Approve" on content item
        ↓
ReviewQueue UI
    │
    └─→ 4. POST /api/review-queue/:id/approve
        ↓
API Server
    │
    └─→ 5. storageService.approveContent(contentId, adminUserId)
        ↓
StorageService
    │
    └─→ 6. BEGIN TRANSACTION
        │
        ├─→ 6a. SELECT * FROM Review_Queue WHERE content_id = :id
        │   Returns: content data
        │
        ├─→ 6b. INSERT INTO Timeline_Archive
        │   (title, description, event_date, source_url,
        │    content_type, approved_by, approved_at)
        │
        ├─→ 6c. SELECT tag_id FROM Content_Tags 
        │   WHERE content_id = :id AND table_name = 'Review_Queue'
        │   Returns: [tagId1, tagId2, tagId3]
        │
        ├─→ 6d. INSERT INTO Content_Tags
        │   (content_id, tag_id, table_name='Timeline_Archive')
        │   For each tag from step 6c
        │
        ├─→ 6e. UPDATE Review_Queue
        │   SET status = 'approved', 
        │       approved_at = NOW(),
        │       reviewed_by = :adminUserId
        │   WHERE content_id = :id
        │
        └─→ 6f. COMMIT TRANSACTION
            ↓
Supabase Database
    │
    ├─→ Timeline_Archive: New approved content
    ├─→ Content_Tags: Tags preserved with new table_name
    └─→ Review_Queue: Status updated to 'approved'

API Server
    │
    └─→ 7. Return success response
        ↓
ReviewQueue UI
    │
    └─→ 8. Remove approved item from pending list
        │   Show success notification
```

### Transaction Guarantees

- **Atomicity**: All steps succeed or all fail (rollback)
- **Tag Preservation**: Tags copied from Review_Queue to Timeline_Archive
- **Audit Trail**: Admin user ID and timestamp recorded
- **Status Update**: Review_Queue marked as approved

---

## 3. Tag Assignment Flow

### Overview
Shows how admins assign tags to content items.

### Flow Diagram

```
Admin User
    │
    │ 1. Click "Assign Tags" on content item
    ↓
ReviewQueue UI
    │
    └─→ 2. Open TagAssignmentModal
        │
        ├─→ 3a. GET /api/tag-groups
        │   Returns: [
        │     { tagGroupId: 1, groupName: "People", 
        │       tags: [{ tagId: 1, tagName: "Jesse Marcel" }, ...] },
        │     { tagGroupId: 2, groupName: "UFO", 
        │       tags: [{ tagId: 5, tagName: "Roswell" }, ...] }
        │   ]
        │
        └─→ 3b. Display hierarchical tag structure
            │   [x] People
            │       [ ] Jesse Marcel
            │       [x] Ross Coulthart
            │   [x] UFO
            │       [x] Roswell
            │       [ ] Area51
            │
            │ 4. Admin selects tags and clicks "Save"
            ↓
TagAssignmentModal
    │
    └─→ 5. POST /api/content/:id/tags
        │  Body: { tagIds: [2, 5] }
        ↓
API Server
    │
    └─→ 6. storageService.assignTagsToContent(contentId, tagIds)
        ↓
StorageService
    │
    ├─→ 7a. DELETE FROM Content_Tags
    │   WHERE content_id = :id AND table_name = 'Review_Queue'
    │
    └─→ 7b. INSERT INTO Content_Tags
        │  (content_id, tag_id, table_name, assigned_at)
        │  VALUES (:id, 2, 'Review_Queue', NOW()),
        │         (:id, 5, 'Review_Queue', NOW())
        ↓
Supabase Database
    │
    └─→ Content_Tags table updated

API Server
    │
    └─→ 8. Return success response
        ↓
ReviewQueue UI
    │
    └─→ 9. Update displayed tags for content item
```

---

## 4. Saved Search Execution Flow

### Overview
Shows how saved searches are executed and tracked.

### Flow Diagram

```
Admin User
    │
    │ 1. Navigate to Saved Searches page
    ↓
SavedSearches UI
    │
    └─→ 2. GET /api/saved-searches
        │  Returns: [
        │    { savedSearchId: 1, searchName: "UFO Crashes",
        │      version: 2, keywordsUsed: ["UFO", "crash"],
        │      selectedTagIds: [5, 6] },
        │    ...
        │  ]
        │
        │ 3. Display saved searches list
        │ 4. Admin clicks "Execute" on a saved search
        ↓
SavedSearches UI
    │
    └─→ 5. POST /api/saved-searches/:id/execute
        ↓
API Server
    │
    ├─→ 6a. Load saved search configuration
    │   savedSearch = { keywordsUsed: ["UFO", "crash"],
    │                    selectedTagIds: [5, 6],
    │                    savedSearchId: 1, version: 2 }
    │
    └─→ 6b. contentScanner.executeScan(
            keywordsUsed, selectedTagIds, savedSearchId, version)
        ↓
ContentScanner
    │
    ├─→ 7. Execute scan (see Flow #1)
    │   Discovers and processes content
    │
    └─→ 8. storageService.recordSearchHistory(
           scanJobId, keywordsUsed, selectedTagIds,
           itemsDiscovered, savedSearchId, version)
        ↓
StorageService
    │
    └─→ 9. INSERT INTO Search_History
        │  (scan_job_id, keywords_used, selected_tag_ids,
        │   items_discovered, saved_search_id, saved_search_version)
        ↓
Supabase Database
    │
    └─→ Search_History record links to Saved_Searches

API Server
    │
    └─→ 10. Return ScanResult
        ↓
SavedSearches UI
    │
    └─→ 11. Display scan results
```

### Saved Search Refinement

```
Admin User
    │
    │ 1. Click "Refine" on existing saved search
    ↓
SavedSearches UI
    │
    ├─→ 2. Load existing configuration
    │   Pre-fill: keywords, selected tags
    │
    │ 3. Admin modifies configuration
    │    Add keyword: "Roswell"
    │    Add tag: "Jesse Marcel"
    │
    └─→ 4. POST /api/saved-searches/:id/refine
        │  Body: { searchName: "UFO Crashes",
        │          keywordsUsed: ["UFO", "crash", "Roswell"],
        │          selectedTagIds: [5, 6, 1] }
        ↓
API Server
    │
    └─→ 5. storageService.createSavedSearch(
           searchName, keywordsUsed, selectedTagIds,
           adminUserId, parentSearchId)
        ↓
StorageService
    │
    ├─→ 6a. SELECT MAX(version) FROM Saved_Searches
    │   WHERE search_name = "UFO Crashes"
    │   Returns: 2
    │
    └─→ 6b. INSERT INTO Saved_Searches
        │  (search_name, version, keywords_used, selected_tag_ids,
        │   created_by, parent_search_id)
        │  VALUES ("UFO Crashes", 3, ["UFO","crash","Roswell"],
        │          [5,6,1], "admin", 1)
        ↓
Supabase Database
    │
    └─→ New version created with parent_search_id linkage

API Server
    │
    └─→ 7. Return new SavedSearch object (version 3)
        ↓
SavedSearches UI
    │
    └─→ 8. Update saved searches list
        │   Show version history
```

---

## 5. Error Logging Flow

### Overview
Shows how errors are captured and logged across all components.

### Flow Diagram

```
Any Component (Scanner, Extractor, Storage, API)
    │
    │ 1. try { ... operation ... }
    │    catch (error) {
    ↓
Component Error Handler
    │
    └─→ 2. errorLogger.logError(componentName, error, scanJobId)
        ↓
ErrorLogger
    │
    ├─→ 3a. Extract error details
    │   message = error.message
    │   stackTrace = error.stack
    │   timestamp = new Date()
    │
    └─→ 3b. storageService.insertErrorLog(
            componentName, message, stackTrace, scanJobId)
        ↓
StorageService
    │
    └─→ 4. INSERT INTO Error_Logs
        │  (component, message, stack_trace, 
        │   scan_job_id, timestamp)
        ↓
Supabase Database
    │
    └─→ Error persisted

Admin User
    │
    │ 5. Navigate to Error Logs page
    ↓
ErrorLogs UI
    │
    └─→ 6. GET /api/error-logs?limit=100
        ↓
API Server
    │
    └─→ 7. errorLogger.getRecentLogs(100)
        ↓
ErrorLogger
    │
    └─→ 8. storageService.getErrorLogs(100)
        ↓
StorageService
    │
    └─→ 9. SELECT * FROM Error_Logs
        │  ORDER BY timestamp DESC
        │  LIMIT 100
        ↓
Supabase Database
    │
    └─→ Returns error log records

API Server
    │
    └─→ 10. Return error logs array
        ↓
ErrorLogs UI
    │
    └─→ 11. Display errors in table
        │   Columns: Timestamp, Component, Message
        │   Expandable: Stack trace details
```

---

## 6. Complete System Data Flow

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     ADMIN INTERFACE                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Scan     │ │ Review   │ │ Keywords │ │ Tags     │      │
│  │ Trigger  │ │ Queue    │ │ Mgmt     │ │ Mgmt     │      │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘      │
└───────┼────────────┼────────────┼────────────┼─────────────┘
        │            │            │            │
        │ HTTP/REST  │            │            │
        ↓            ↓            ↓            ↓
┌─────────────────────────────────────────────────────────────┐
│                      API SERVER                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Express.js Routes + Error Handling                    │  │
│  └──────────────────────────────────────────────────────┘  │
└───────┬────────────┬────────────┬────────────┬─────────────┘
        │            │            │            │
        ↓            ↓            ↓            ↓
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND SERVICES                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │ Content  │→│ Content  │→│ Data     │→│ Duplicate│      │
│  │ Scanner  │ │ Extractor│ │ Validator│ │ Detector │      │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘      │
│       │            │            │            │              │
│       └────────────┴────────────┴────────────┘              │
│                          ↓                                   │
│                  ┌──────────────┐                           │
│                  │   Storage    │                           │
│                  │   Service    │                           │
│                  └──────┬───────┘                           │
└─────────────────────────┼───────────────────────────────────┘
                          │
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   SUPABASE DATABASE                          │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ Review_Queue │ │ Timeline_    │ │ Keyword_     │       │
│  │              │ │ Archive      │ │ Config       │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ Tag_Groups   │ │ Tags         │ │ Content_Tags │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │
│  │ Search_      │ │ Saved_       │ │ Error_Logs   │       │
│  │ History      │ │ Searches     │ │              │       │
│  └──────────────┘ └──────────────┘ └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

---

## Summary

These data flow diagrams illustrate:

1. **Content Discovery**: From scan trigger through extraction to storage
2. **Approval Workflow**: Transactional movement from review to archive
3. **Tag Management**: Hierarchical tag assignment and preservation
4. **Saved Searches**: Configuration storage and execution tracking
5. **Error Logging**: Comprehensive error capture and display
6. **System Integration**: Complete data flow across all layers

All flows are fully implemented and operational in the current system.
