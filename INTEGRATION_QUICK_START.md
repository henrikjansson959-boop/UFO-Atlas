# Integration Quick Start Guide
## Automated Data Collection System

This guide helps you quickly start and verify the integrated system.

---

## Prerequisites

- Node.js 16+ installed
- Supabase account with project created
- Git repository cloned

---

## Step 1: Database Setup

### 1.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and anon key

### 1.2 Run Database Migrations

```bash
# Navigate to project root
cd automated-data-collection

# Run the database migration script
# This creates all 9 tables with indexes and constraints
psql -h your-project.supabase.co -U postgres -d postgres -f migrations/001_initial_schema.sql
```

### 1.3 Seed Initial Data

```bash
# Run the seed script to populate tag groups and tags
npm run seed
```

This creates:
- Tag Groups: People, UFO, Aliens, Theories
- Tags: Jesse Marcel, Ross Coulthart, UFO, Area51, Roswell, Aztec, Crash, Observation

---

## Step 2: Backend Configuration

### 2.1 Create Environment File

Create `.env` in the project root:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-supabase-anon-key

# API Server Configuration
API_PORT=3000
CORS_ORIGIN=http://localhost:5173
ADMIN_USER_ID=admin

# Optional: Search API Configuration
# SEARCH_API_KEY=your-search-api-key
```

### 2.2 Install Dependencies

```bash
# Install backend dependencies
npm install
```

### 2.3 Start API Server

```bash
# Start the Express API server
npm run api

# Or with ts-node directly
ts-node src/admin/api-server.ts
```

Expected output:
```
AdminAPI server running on port 3000
CORS enabled for: http://localhost:5173
```

---

## Step 3: Frontend Configuration

### 3.1 Navigate to Frontend Directory

```bash
cd website
```

### 3.2 Create Environment File

Create `.env` in the `website/` directory:

```env
# API Base URL
VITE_API_BASE_URL=http://localhost:3000/api
```

### 3.3 Install Dependencies

```bash
# Install frontend dependencies
npm install
```

### 3.4 Start Development Server

```bash
# Start the React development server
npm run dev
```

Expected output:
```
VITE v4.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
➜  Network: use --host to expose
```

---

## Step 4: Verify Integration

### 4.1 Access Admin Interface

Open your browser and navigate to:
```
http://localhost:5173
```

You should see the UFO Atlas landing page.

### 4.2 Test Keyword Management

1. Click "Keyword Management" in the navigation
2. Add a test keyword: "UFO sighting"
3. Verify it appears in the list
4. Toggle the keyword active/inactive

**Expected Result:** Keyword is added to database and displayed in UI

### 4.3 Test Tag Management

1. Click "Tag Management" in the navigation
2. Expand "People" tag group
3. Add a new tag: "Bob Lazar"
4. Verify it appears under People

**Expected Result:** Tag is added to database and displayed hierarchically

### 4.4 Test Scan Trigger

1. Click "Scan Trigger" in the navigation
2. Expand tag groups and select some tags
3. Click "Trigger Scan" button
4. Observe scan results

**Expected Result:** Scan executes and returns results (may be empty due to mock search implementation)

### 4.5 Test Review Queue

1. Click "Review Queue" in the navigation
2. View pending content (if any)
3. Test approve/reject buttons
4. Test tag assignment

**Expected Result:** Content can be approved/rejected and tags assigned

### 4.6 Test Saved Searches

1. Click "Saved Searches" in the navigation
2. Create a new saved search
3. Execute the saved search
4. Refine the saved search

**Expected Result:** Saved searches are created, executed, and versioned

### 4.7 Test Error Logs

1. Click "Error Logs" in the navigation
2. View recent error logs

**Expected Result:** Error logs are displayed (may be empty if no errors occurred)

### 4.8 Test Search History

1. Click "Search History" in the navigation
2. View recent search executions

**Expected Result:** Search history is displayed with scan metadata

---

## Step 5: Verify Backend Integration

### 5.1 Check API Endpoints

Test API endpoints using curl:

```bash
# Get all keywords
curl http://localhost:3000/api/keywords

# Get tag groups
curl http://localhost:3000/api/tag-groups

# Get review queue
curl http://localhost:3000/api/review-queue

# Get saved searches
curl http://localhost:3000/api/saved-searches

# Get error logs
curl http://localhost:3000/api/error-logs

# Get search history
curl http://localhost:3000/api/search-history
```

**Expected Result:** Each endpoint returns JSON data

### 5.2 Test Scan Trigger API

```bash
# Trigger a scan with tag IDs
curl -X POST http://localhost:3000/api/scan/trigger \
  -H "Content-Type: application/json" \
  -d '{"tagIds": [1, 2, 3]}'
```

**Expected Result:** Returns scan result with scanJobId and metadata

### 5.3 Check Database Tables

Connect to your Supabase database and verify tables:

```sql
-- Check Review_Queue
SELECT COUNT(*) FROM Review_Queue;

-- Check Keywords
SELECT * FROM Keyword_Config;

-- Check Tags
SELECT * FROM Tags;

-- Check Search_History
SELECT * FROM Search_History ORDER BY search_timestamp DESC LIMIT 10;

-- Check Error_Logs
SELECT * FROM Error_Logs ORDER BY timestamp DESC LIMIT 10;
```

**Expected Result:** Tables exist and contain data

---

## Step 6: Integration Test Scenarios

### Scenario 1: Complete Scan-to-Approval Flow

1. **Add Keywords**
   - Navigate to Keyword Management
   - Add keywords: "UFO", "alien", "Roswell"
   - Activate all keywords

2. **Trigger Scan**
   - Navigate to Scan Trigger
   - Select tags: "Jesse Marcel", "Roswell"
   - Click "Trigger Scan"
   - Note the scan job ID

3. **Check Search History**
   - Navigate to Search History
   - Verify scan appears with correct keywords and tags

4. **Review Content** (if any discovered)
   - Navigate to Review Queue
   - View pending content
   - Assign tags to content
   - Approve content

5. **Verify Approval**
   - Check Timeline_Archive table in database
   - Verify content was copied with tags

**Expected Result:** Complete flow from scan to approval works

### Scenario 2: Saved Search Workflow

1. **Create Saved Search**
   - Navigate to Saved Searches
   - Click "Create New Search"
   - Name: "UFO Crashes"
   - Keywords: ["UFO", "crash"]
   - Tags: ["Roswell", "Aztec"]
   - Save

2. **Execute Saved Search**
   - Click "Execute" on the saved search
   - Verify scan executes

3. **Check Search History**
   - Navigate to Search History
   - Verify execution is linked to saved search

4. **Refine Saved Search**
   - Click "Refine" on the saved search
   - Add keyword: "debris"
   - Add tag: "Jesse Marcel"
   - Save refinement

5. **Verify Versioning**
   - Check version history
   - Verify version 2 was created with parent_search_id

**Expected Result:** Saved search workflow with versioning works

### Scenario 3: Error Logging

1. **Trigger an Error**
   - Try to add a duplicate keyword
   - Try to delete a tag that's in use

2. **Check Error Logs**
   - Navigate to Error Logs
   - Verify errors are logged with details

**Expected Result:** Errors are captured and displayed

---

## Troubleshooting

### Backend Issues

**Problem:** API server won't start
- Check `.env` file exists with correct values
- Verify Supabase URL and key are correct
- Check port 3000 is not in use: `lsof -i :3000`

**Problem:** Database connection fails
- Verify Supabase project is running
- Check network connectivity
- Verify credentials in `.env`

**Problem:** CORS errors
- Verify `CORS_ORIGIN` in backend `.env` matches frontend URL
- Check frontend is running on http://localhost:5173

### Frontend Issues

**Problem:** Frontend won't start
- Check `website/.env` file exists
- Verify `VITE_API_BASE_URL` is correct
- Run `npm install` in website directory

**Problem:** API calls fail
- Verify backend is running on port 3000
- Check browser console for errors
- Verify API base URL in frontend `.env`

**Problem:** UI doesn't display data
- Check browser console for errors
- Verify API endpoints return data
- Check network tab in browser dev tools

### Database Issues

**Problem:** Tables don't exist
- Run database migration script
- Check Supabase dashboard for tables

**Problem:** Seed data missing
- Run seed script: `npm run seed`
- Check Tags and Tag_Groups tables

---

## Next Steps

After verifying integration:

1. **Run Tests**
   ```bash
   # Run unit tests
   npm test
   
   # Run integration tests
   npm run test:integration
   ```

2. **Implement Real Search**
   - Integrate with Google Custom Search API
   - Or implement web scraping with Puppeteer
   - Update `ContentScanner.searchInternet()` method

3. **Add Authentication**
   - Implement JWT authentication
   - Add login/logout functionality
   - Protect API endpoints

4. **Deploy to Production**
   - Set up production environment variables
   - Deploy backend to cloud service
   - Deploy frontend to hosting service
   - Configure production database

---

## Support

For issues or questions:
- Check the integration documentation
- Review component wiring verification
- Examine data flow diagrams
- Check error logs in the admin UI

---

## Summary

You should now have:
- ✅ Backend API server running on port 3000
- ✅ Frontend UI running on port 5173
- ✅ Database tables created and seeded
- ✅ All components wired together
- ✅ Integration verified through testing

The system is ready for end-to-end testing and further development!
