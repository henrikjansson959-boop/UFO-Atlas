# Task 17 Quick Start Guide

## What Was Implemented

Task 17 has been completed! The AdminAPI backend endpoints are now available via an Express.js server.

## Files Created

1. **src/admin/api-server.ts** - Main Express.js API server (600+ lines)
2. **src/admin/API_SERVER_README.md** - Complete API documentation
3. **src/admin/api-server.test.ts** - Test structure
4. **src/admin/TASK_17_COMPLETION.md** - Detailed completion summary
5. **src/admin/start-api.sh** - Startup script

## Files Modified

1. **package.json** - Added Express, CORS, dotenv dependencies
2. **src/admin/index.ts** - Exported API server
3. **.env.example** - Added API configuration variables

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

This will install:
- express (^4.18.2)
- cors (^2.8.5)
- dotenv (^16.3.1)
- @types/express (^4.17.21)
- @types/cors (^2.8.17)

### 2. Configure Environment

Create a `.env` file in the root directory:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# API Server Configuration
API_PORT=3000
CORS_ORIGIN=http://localhost:5173
ADMIN_USER_ID=admin
```

### 3. Start the API Server

```bash
npm run api
```

Or use the startup script:

```bash
chmod +x src/admin/start-api.sh
./src/admin/start-api.sh
```

The server will start on port 3000 (or the port specified in API_PORT).

### 4. Test the API

```bash
# Get all keywords
curl http://localhost:3000/api/keywords

# Get review queue
curl http://localhost:3000/api/review-queue

# Get tag groups
curl http://localhost:3000/api/tag-groups
```

## API Endpoints Summary

### Review Queue
- `GET /api/review-queue` - Get pending content
- `POST /api/review-queue/:id/approve` - Approve content
- `POST /api/review-queue/:id/reject` - Reject content

### Keywords
- `GET /api/keywords` - Get all keywords
- `POST /api/keywords` - Add keyword
- `PATCH /api/keywords/:id/toggle` - Toggle keyword

### Tags
- `GET /api/tag-groups` - Get tag groups
- `POST /api/tags` - Create tag
- `PATCH /api/tags/:id` - Update tag
- `DELETE /api/tags/:id` - Delete tag
- `POST /api/content/:id/tags` - Assign tags

### Scans
- `POST /api/scan/trigger` - Trigger manual scan

### Saved Searches
- `GET /api/saved-searches` - Get saved searches
- `POST /api/saved-searches` - Create saved search
- `POST /api/saved-searches/:id/execute` - Execute search
- `POST /api/saved-searches/:id/refine` - Refine search
- `DELETE /api/saved-searches/:id` - Delete search
- `GET /api/saved-searches/:name/versions` - Get versions

### Logs
- `GET /api/error-logs` - Get error logs
- `GET /api/search-history` - Get search history

## Frontend Integration

The frontend (`website/src/services/api.ts`) is already configured to use these endpoints. Just ensure:

1. API server is running on port 3000
2. Frontend `VITE_API_BASE_URL` is set to `http://localhost:3000/api`
3. CORS is configured correctly

## Documentation

For complete documentation, see:
- **src/admin/API_SERVER_README.md** - Full API documentation
- **src/admin/TASK_17_COMPLETION.md** - Implementation details

## Requirements Validated

All Task 17 requirements have been implemented:

✅ 17.1 - Express.js API server with TypeScript  
✅ 17.2 - Review queue endpoints  
✅ 17.3 - Keyword management endpoints  
✅ 17.4 - Tag management endpoints  
✅ 17.5 - Scan trigger endpoint  
✅ 17.6 - Saved search endpoints  
✅ 17.7 - Error logs and search history endpoints  

## Next Steps

1. Install dependencies: `npm install`
2. Configure `.env` file with Supabase credentials
3. Start API server: `npm run api`
4. Test endpoints with curl or Postman
5. Start frontend application and test full integration
6. Implement authentication for production use

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, change `API_PORT` in `.env`:

```env
API_PORT=3001
```

### CORS Errors

If you get CORS errors, ensure `CORS_ORIGIN` in `.env` matches your frontend URL:

```env
CORS_ORIGIN=http://localhost:5173
```

### Supabase Connection Errors

Verify your Supabase credentials in `.env`:
- `SUPABASE_URL` should be your project URL
- `SUPABASE_KEY` should be your anon/public key

## Support

For detailed information about each endpoint, request/response formats, and examples, see:
- **src/admin/API_SERVER_README.md**

For implementation details and architecture, see:
- **src/admin/TASK_17_COMPLETION.md**
