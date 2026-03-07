# UFO Atlas Admin Interface

This is the admin interface for the UFO Atlas Automated Data Collection system.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file based on `.env.example`:
```bash
cp .env.example .env
```

3. Update the `VITE_API_BASE_URL` in `.env` to point to your backend API.

## Development

Run the development server:
```bash
npm run dev
```

The admin interface will be available at `http://localhost:5173/admin`

## Features

### Review Queue (Task 10 - Implemented)
- View all pending content items from the Review_Queue
- Display title, description, event_date, source_url, content_type, and raw_html
- Order by discovered_at descending
- Highlight potential duplicates with amber background
- Filter by content type (event, person, theory, news)
- Approve/reject content with confirmation dialogs
- Assign tags to content items using hierarchical tag structure

### Keyword Management (Task 11 - Placeholder)
- Add, activate, and deactivate keywords
- View last scan timestamp for each keyword

### Tag Management (Task 12 - Placeholder)
- Create and edit tags within tag groups
- Assign tags to tag groups
- Delete tags (with protection for tags in use)

### Manual Scan Trigger (Task 13 - Placeholder)
- Trigger manual scans with tag filtering
- Hierarchical tag group UI with checkboxes
- "All tags" logic when no checkboxes selected

### Saved Searches (Task 14 - Placeholder)
- Save search configurations with custom names
- Execute saved searches
- Refine saved searches (creates new version)
- View version history

### Search History & Error Logs (Task 15 - Placeholder)
- View search history with timestamps and results
- View error logs with filtering

## Architecture

### Components
- `AdminLayout.tsx` - Main layout with navigation and UFO Atlas logo
- `ContentItemCard.tsx` - Individual content item display with actions
- `TagAssignmentModal.tsx` - Modal for assigning tags to content

### Pages
- `ReviewQueue.tsx` - Review queue management
- `KeywordManagement.tsx` - Keyword configuration
- `TagManagement.tsx` - Tag and tag group management
- `ScanTrigger.tsx` - Manual scan trigger with tag filtering
- `SavedSearches.tsx` - Saved search management
- `SearchHistory.tsx` - Search history display
- `ErrorLogs.tsx` - Error log display
- `LandingPage.tsx` - Public landing page

### Services
- `api.ts` - API service layer for backend communication

### Types
- `types/index.ts` - TypeScript type definitions

## API Integration

The admin interface connects to the backend API (to be implemented in task 17). All API endpoints are defined in `src/services/api.ts`.

Expected API endpoints:
- `GET /api/review-queue` - Get pending content
- `POST /api/review-queue/:id/approve` - Approve content
- `POST /api/review-queue/:id/reject` - Reject content
- `POST /api/content/:id/tags` - Assign tags to content
- `GET /api/tag-groups` - Get all tag groups with tags
- And more...

## Notes

- The backend API is not yet implemented (task 17)
- Mock data or a development API server will be needed for testing
- The UFO Atlas logo is currently represented by a "UA" badge (can be replaced with actual logo)
