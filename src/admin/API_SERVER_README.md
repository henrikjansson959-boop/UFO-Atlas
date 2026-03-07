# AdminAPI Backend Server

This document describes the Express.js API server implementation for the Automated Data Collection system.

## Overview

The API server (`api-server.ts`) provides RESTful endpoints for the admin interface to interact with the backend services. It integrates with:

- **StorageService**: Database operations
- **ContentScanner**: Content discovery and scanning
- **ContentExtractor**: Content extraction from URLs
- **ErrorLogger**: Error logging and monitoring

## Configuration

### Environment Variables

Required environment variables (see `.env.example`):

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# API Server Configuration
API_PORT=3000
CORS_ORIGIN=http://localhost:5173
ADMIN_USER_ID=admin
```

### Starting the Server

```bash
# Install dependencies
npm install

# Start the API server
npm run api

# Or with ts-node directly
ts-node src/admin/api-server.ts
```

The server will start on port 3000 (or the port specified in `API_PORT` environment variable).

## API Endpoints

### Review Queue Endpoints

#### GET /api/review-queue
Get pending content with optional filters.

**Query Parameters:**
- `contentType` (optional): Filter by content type (event, person, theory, news)
- `tagIds` (optional): Comma-separated tag IDs to filter by

**Response:** Array of `ContentItem` objects

**Example:**
```bash
curl http://localhost:3000/api/review-queue?contentType=event
```

#### POST /api/review-queue/:id/approve
Approve content and move to timeline archive.

**Parameters:**
- `id`: Content ID to approve

**Response:**
```json
{
  "success": true,
  "message": "Content approved successfully"
}
```

#### POST /api/review-queue/:id/reject
Reject content.

**Parameters:**
- `id`: Content ID to reject

**Response:**
```json
{
  "success": true,
  "message": "Content rejected successfully"
}
```

### Keyword Management Endpoints

#### GET /api/keywords
Get all keywords.

**Response:** Array of `Keyword` objects

#### POST /api/keywords
Add a new keyword.

**Request Body:**
```json
{
  "keyword": "UFO sighting"
}
```

**Response:**
```json
{
  "success": true,
  "keywordId": 123,
  "message": "Keyword added successfully"
}
```

#### PATCH /api/keywords/:id/toggle
Activate or deactivate a keyword.

**Parameters:**
- `id`: Keyword ID

**Request Body:**
```json
{
  "isActive": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Keyword activated successfully"
}
```

### Tag Management Endpoints

#### GET /api/tag-groups
Get all tag groups with their tags.

**Response:** Array of `TagGroup` objects

#### POST /api/tags
Create a new tag.

**Request Body:**
```json
{
  "tagName": "Bob Lazar",
  "tagGroupId": 1
}
```

**Response:**
```json
{
  "success": true,
  "tagId": 456,
  "message": "Tag created successfully"
}
```

#### PATCH /api/tags/:id
Update a tag.

**Parameters:**
- `id`: Tag ID

**Request Body:**
```json
{
  "tagName": "Updated Tag Name"
}
```

#### DELETE /api/tags/:id
Delete a tag (only if not assigned to any content).

**Parameters:**
- `id`: Tag ID

#### POST /api/content/:id/tags
Assign tags to content.

**Parameters:**
- `id`: Content ID

**Request Body:**
```json
{
  "tagIds": [1, 2, 3]
}
```

### Scan Trigger Endpoint

#### POST /api/scan/trigger
Trigger a manual scan with tag filters.

**Request Body:**
```json
{
  "tagIds": [1, 2, 3],
  "savedSearchId": 5
}
```

**Response:** `ScanResult` object with discovered URLs and metadata

### Saved Search Endpoints

#### GET /api/saved-searches
Get all saved searches.

**Response:** Array of `SavedSearch` objects

#### POST /api/saved-searches
Create a new saved search.

**Request Body:**
```json
{
  "searchName": "My UFO Search",
  "keywordsUsed": ["UFO", "alien"],
  "selectedTagIds": [1, 2, 3]
}
```

**Response:** `SavedSearch` object

#### POST /api/saved-searches/:id/execute
Execute a saved search.

**Parameters:**
- `id`: Saved search ID

**Response:** `ScanResult` object

#### POST /api/saved-searches/:id/refine
Refine a saved search (creates a new version).

**Parameters:**
- `id`: Parent search ID

**Request Body:**
```json
{
  "searchName": "My UFO Search",
  "keywordsUsed": ["UFO", "alien", "crash"],
  "selectedTagIds": [1, 2, 3, 4]
}
```

**Response:** `SavedSearch` object with incremented version

#### DELETE /api/saved-searches/:id
Delete a saved search.

**Parameters:**
- `id`: Saved search ID

#### GET /api/saved-searches/:name/versions
Get version history for a saved search.

**Parameters:**
- `name`: Search name (URL encoded)

**Response:** Array of `SavedSearch` objects ordered by version

### Error Logs and Search History Endpoints

#### GET /api/error-logs
Get recent error logs.

**Query Parameters:**
- `limit` (optional): Number of logs to return (default: 100)

**Response:** Array of error log objects

#### GET /api/search-history
Get search history.

**Query Parameters:**
- `limit` (optional): Number of history entries to return (default: 100)

**Response:** Array of `SearchHistoryEntry` objects

## Error Handling

The API server includes comprehensive error handling:

1. **Validation Errors (400)**: Invalid request parameters or body
2. **Not Found (404)**: Resource not found
3. **Conflict (409)**: Duplicate resources or constraint violations
4. **Internal Server Error (500)**: Unexpected errors

All errors are logged to the database via the ErrorLogger service.

## CORS Configuration

CORS is enabled for the origin specified in the `CORS_ORIGIN` environment variable (default: `http://localhost:5173`).

## Authentication

Currently, the API uses a simple admin user ID from environment variables. In production, you should implement proper authentication middleware using:

- JWT tokens
- OAuth 2.0
- Session-based authentication
- API keys

## Testing

To test the API endpoints:

1. Start the API server: `npm run api`
2. Use curl, Postman, or the frontend application to make requests
3. Check the console logs for request/response information

Example test:
```bash
# Get all keywords
curl http://localhost:3000/api/keywords

# Add a new keyword
curl -X POST http://localhost:3000/api/keywords \
  -H "Content-Type: application/json" \
  -d '{"keyword":"Area 51"}'

# Get review queue
curl http://localhost:3000/api/review-queue
```

## Integration with Frontend

The frontend application (`website/src/services/api.ts`) is already configured to use these endpoints. Ensure:

1. The API server is running on the correct port
2. The `VITE_API_BASE_URL` environment variable in the frontend matches the API server URL
3. CORS is properly configured

## Requirements Validation

This implementation validates the following requirements:

- **4.2, 5.1, 5.3**: Review queue endpoints
- **6.1, 6.2**: Keyword management endpoints
- **11.7, 11.8, 11.13**: Tag management endpoints
- **8.6**: Scan trigger endpoint
- **12.1, 12.3, 12.5, 12.7, 12.8, 12.13**: Saved search endpoints
- **9.5, 4.8**: Error logs and search history endpoints

## Next Steps

1. Install dependencies: `npm install`
2. Configure environment variables in `.env`
3. Start the API server: `npm run api`
4. Test endpoints using curl or Postman
5. Connect the frontend application
6. Implement authentication middleware for production use
