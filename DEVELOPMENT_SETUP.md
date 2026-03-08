# Development Setup Guide

## Architecture Overview

UFO Atlas uses a dual-environment architecture:

- **Development**: Local Docker-based stack with PostgreSQL + PostgREST + nginx
- **Production**: Supabase cloud (PostgreSQL + REST API + Auth)

This approach allows developers to work locally without cloud dependencies while maintaining production compatibility.

### Why This Architecture?

**The Challenge:**
The application uses `@supabase/supabase-js` client library, which is designed for Supabase cloud. This client automatically appends `/rest/v1/` to all API URLs (e.g., `http://api/rest/v1/keyword_config`). However, PostgREST (the open-source REST API that Supabase is built on) serves endpoints directly at the root path (e.g., `http://api/keyword_config`).

**The Solution:**
We use an nginx reverse proxy that sits in front of PostgREST and rewrites URLs:
- Incoming: `http://postgrest-proxy:3000/rest/v1/keyword_config`
- Rewritten to: `http://postgrest:3000/keyword_config`
- PostgREST serves the data
- Response flows back through nginx to the client

This allows the same Supabase client code to work in both development (local PostgREST) and production (Supabase cloud) without any changes.

**Alternative Approaches (Not Used):**
1. Use `postgrest-js` directly instead of `@supabase/supabase-js` - requires code changes
2. Use plain `fetch` calls - requires rewriting all database access code
3. Custom fetch wrapper in Supabase client - complex and fragile

**Why nginx proxy is the standard pattern:**
- No code changes required
- Works with existing Supabase client
- Easy to understand and maintain
- Commonly used in production deployments
- Allows seamless transition between local and cloud environments

## Development Stack

The local development environment runs entirely in Docker with these services:

1. **PostgreSQL** (port 5432) - Database server
   - Image: `postgres:15-alpine`
   - Stores all application data
   - Auto-applies migrations from `supabase/migrations/` on first startup
   - Data persisted in Docker volume `postgres_data`

2. **PostgREST** (internal only) - REST API layer over PostgreSQL
   - Image: `postgrest/postgrest:latest`
   - Automatically generates REST endpoints from database schema
   - Serves at root path (e.g., `/keyword_config`)
   - Not exposed to host - only accessible via nginx proxy

3. **nginx Proxy** (port 3001) - Path rewriter for Supabase compatibility
   - Image: `nginx:alpine`
   - Rewrites `/rest/v1/*` to `/*` for PostgREST
   - This is the key component that makes Supabase client work with PostgREST
   - Configuration in `nginx.conf`

4. **Backend API** (port 3000) - Node.js Express server
   - Image: `node:20-alpine`
   - Connects to nginx proxy (not directly to PostgREST)
   - Uses `@supabase/supabase-js` client pointing to `http://postgrest-proxy:3000`
   - Code changes auto-reload (requires restart)
   - Dependencies cached in Docker volume `api_node_modules`

5. **Frontend** (port 5173) - Vite dev server with React
   - Image: `node:20-alpine`
   - Hot reload enabled for instant updates
   - Connects to backend API at `http://localhost:3000/api`
   - Dependencies cached in Docker volume `frontend_node_modules`

### Service Communication Flow

```
Browser (localhost:5173)
    ↓
Frontend Container (Vite)
    ↓ HTTP
Backend API Container (localhost:3000)
    ↓ HTTP (with /rest/v1/ prefix)
nginx Proxy Container (postgrest-proxy:3000)
    ↓ HTTP (strips /rest/v1/ prefix)
PostgREST Container (postgrest:3000)
    ↓ SQL
PostgreSQL Container (postgres:5432)
```

### Why Each Component?

- **PostgreSQL**: Standard relational database, same as production
- **PostgREST**: Open-source REST API generator, core of Supabase
- **nginx**: Bridges the gap between Supabase client expectations and PostgREST reality
- **Backend API**: Business logic, content scanning, scheduling
- **Frontend**: User interface for admin workflows

## Prerequisites

- Docker Desktop (or Docker Engine + Docker Compose)
- No Node.js installation required (runs in containers)
- No PostgreSQL installation required (runs in container)

## Quick Start

### 1. Start All Services

```bash
docker compose up
```

This will:
- Create a PostgreSQL database with all migrations applied
- Start PostgREST to provide REST API
- Install npm dependencies for backend and frontend
- Start the backend API server
- Start the Vite dev server

**Note**: First startup takes 5-10 minutes due to npm installs (especially puppeteer downloading Chromium).

### 2. Access the Application

Once all services are running:

- **Frontend UI**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **PostgREST API**: http://localhost:3001
- **PostgreSQL**: localhost:5432 (user: postgres, password: postgres)

### 3. Stop Services

```bash
docker compose down
```

To also remove the database volume (fresh start):

```bash
docker compose down -v
```

## Service Details

### PostgreSQL Database

- **Image**: postgres:15-alpine
- **Port**: 5432
- **Credentials**: 
  - User: `postgres`
  - Password: `postgres`
  - Database: `postgres`
- **Migrations**: Auto-applied on first startup from `supabase/migrations/`
- **Data**: Persisted in Docker volume `ufo-atlas_postgres_data`

### PostgREST

PostgREST provides a RESTful API directly from the PostgreSQL schema, mimicking Supabase's API layer.

- **Image**: postgrest/postgrest:latest
- **Port**: 3001 (maps to internal 3000)
- **Purpose**: Provides REST API that `@supabase/supabase-js` client expects
- **Schema**: Exposes `public` schema
- **Auth**: Uses JWT token (configured in docker-compose.yml)
- **Database Role**: Uses `anon` role for API requests (created by migration 004)

**Why PostgREST?**
The application uses `@supabase/supabase-js` which requires an HTTP REST API endpoint, not a direct PostgreSQL connection. PostgREST provides this API layer locally.

**Authentication Flow:**
1. Supabase client sends JWT token with `"role":"anon"` in requests
2. PostgREST validates the JWT and switches to the `anon` PostgreSQL role
3. Database queries execute with `anon` role permissions
4. Migration `004_create_anon_role.sql` creates this role with appropriate permissions

### Backend API

- **Image**: node:20-alpine
- **Port**: 3000
- **Working Directory**: `/app` (mounted from project root)
- **Command**: `npm install && npm run api`
- **Environment Variables**:
  - `SUPABASE_URL=http://postgrest:3000` (points to PostgREST)
  - `SUPABASE_KEY=<jwt-token>` (for PostgREST auth)
  - `DATABASE_URL=postgresql://postgres:postgres@postgres:5432/postgres`

### Frontend

- **Image**: node:20-alpine
- **Port**: 5173
- **Working Directory**: `/app` (mounted from `website/`)
- **Command**: `npm install && npm run dev -- --host 0.0.0.0`
- **Environment Variables**:
  - `VITE_API_BASE_URL=http://localhost:3000/api`

## Environment Configuration

### Backend (.env)

```env
NODE_ENV=development
API_PORT=3000
CORS_ORIGIN=http://localhost:5173
ADMIN_USER_ID=admin
SUPABASE_URL=http://postgrest:3000
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/postgres
```

### Frontend (website/.env)

```env
VITE_API_BASE_URL=http://localhost:3000/api
```

## Database Management

### Viewing Data

Connect to PostgreSQL using any client:

```bash
# Using psql in the container
docker exec -it ufo-atlas-db psql -U postgres

# Or use a GUI client like pgAdmin, DBeaver, etc.
# Host: localhost
# Port: 5432
# User: postgres
# Password: postgres
# Database: postgres
```

### Adding Seed Data

```bash
# Run seed script
docker exec -it ufo-atlas-api npm run seed
```

Or manually insert data:

```sql
-- Connect to database
docker exec -it ufo-atlas-db psql -U postgres

-- Insert keywords
INSERT INTO keywords (keyword, user_id) VALUES ('UFO', 'admin');
INSERT INTO keywords (keyword, user_id) VALUES ('UAP', 'admin');

-- Insert tags
INSERT INTO tags (name, color, user_id) VALUES ('Verified', '#10b981', 'admin');
INSERT INTO tags (name, color, user_id) VALUES ('Pending', '#f59e0b', 'admin');
```

### Applying New Migrations

Migrations are auto-applied on first startup. For new migrations:

1. Add migration file to `supabase/migrations/`
2. Restart with fresh database:

```bash
docker compose down -v
docker compose up
```

Or apply manually:

```bash
docker exec -i ufo-atlas-db psql -U postgres < supabase/migrations/004_new_migration.sql
```

## Development Workflow

### Making Code Changes

Code changes are automatically reflected:

- **Backend**: Changes require restart (Ctrl+C and `docker compose up` again)
- **Frontend**: Hot reload enabled (changes appear immediately)

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f frontend
docker compose logs -f postgres
docker compose logs -f postgrest
```

### Rebuilding Services

If you change dependencies or Dockerfile:

```bash
docker compose up --build
```

### Accessing Container Shell

```bash
# Backend container
docker exec -it ufo-atlas-api sh

# Frontend container
docker exec -it ufo-atlas-frontend sh

# Database container
docker exec -it ufo-atlas-db sh
```

## Troubleshooting

### Services Won't Start

```bash
# Check container status
docker compose ps

# View logs
docker compose logs

# Remove everything and start fresh
docker compose down -v
docker compose up
```

### Database Connection Errors

If you see "role postgres does not exist":

```bash
# Remove corrupted volume
docker compose down -v
docker compose up
```

### Port Already in Use

If ports 3000, 3001, 5173, or 5432 are in use:

1. Stop the conflicting service
2. Or modify ports in `docker-compose.yml`

### npm Install Taking Too Long

First startup takes 5-10 minutes because:
- Backend installs ~500 packages including puppeteer (downloads Chromium)
- Frontend installs ~270 packages

Subsequent startups are faster (uses cached node_modules in Docker volumes).

### PostgREST Connection Issues

If PostgREST can't connect to PostgreSQL:

1. Check PostgreSQL is healthy: `docker compose ps`
2. Verify connection string in docker-compose.yml
3. Check logs: `docker compose logs postgrest`

### Frontend File Watcher Issues (macOS)

If you see "EMFILE: too many open files" error:

The docker-compose.yml already includes `CHOKIDAR_USEPOLLING=true` to fix this. If issues persist, restart the frontend container:

```bash
docker compose restart frontend
```

### Frontend Module Not Found Errors

If you see module resolution errors (e.g., tinyglobby):

```bash
# Remove frontend node_modules volume and reinstall
docker compose down
docker volume rm ufo-atlas_frontend_node_modules
rm -f website/package-lock.json
docker compose up
```

### API Server Hangs During Startup

**Symptoms:**
- `docker logs ufo-atlas-api` shows `ts-node src/admin/api-server.ts` but no "AdminAPI server running" message
- Browser shows `ERR_EMPTY_RESPONSE` when trying to access API
- `docker exec ufo-atlas-api ps aux` shows ts-node process running

**Possible Causes:**
1. **Async initialization hanging** - StorageService or other services failing to initialize
2. **TypeScript compilation issue** - Type errors preventing compilation
3. **Module circular dependency** - Import cycle causing hang
4. **Network issue** - API can't reach postgrest-proxy during initialization

**Debugging Steps:**

```bash
# 1. Check if API can reach the proxy
docker exec ufo-atlas-api wget -qO- http://postgrest-proxy:3000/rest/v1/keyword_config

# 2. Try running with transpile-only (skips type checking)
docker exec -it ufo-atlas-api sh
cd /app
npx ts-node --transpile-only src/admin/api-server.ts

# 3. Check for TypeScript errors
docker exec ufo-atlas-api npx tsc --noEmit

# 4. Add debug logging to api-server.ts
# Add console.log statements at the top of the file and before app.listen()

# 5. Check if there's a compilation error in logs
docker logs ufo-atlas-api 2>&1 | grep -i error
```

**Common Fixes:**

```bash
# Restart with clean state
docker compose down
docker compose up -d

# If still hanging, check the StorageService initialization
# The Supabase client might be trying to connect during construction
# Solution: Make sure SUPABASE_URL points to postgrest-proxy:3000
docker exec ufo-atlas-api printenv | grep SUPABASE
```

### Browser Shows Spinning/Loading Forever

**Symptoms:**
- Frontend loads but shows loading spinner
- Browser console shows `ERR_EMPTY_RESPONSE` or `net::ERR_CONNECTION_REFUSED`

**Cause:** API server hasn't started yet or is crashing

**Solution:**

```bash
# Check API status
docker logs ufo-atlas-api | grep "AdminAPI server running"

# If not running, follow "API Server Hangs During Startup" steps above

# Verify all services are healthy
docker compose ps

# Check if API is listening
curl http://localhost:3000/api/keywords
```

## Production Deployment

For production, the application connects to Supabase cloud instead of local PostgreSQL:

1. Create Supabase project at https://supabase.com
2. Update environment variables:
   - `SUPABASE_URL=https://your-project.supabase.co`
   - `SUPABASE_KEY=your-anon-key`
3. Run migrations in Supabase dashboard or via CLI
4. Deploy backend and frontend to your hosting platform

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Development (Docker)                  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────┐      ┌──────────┐      ┌──────────────┐  │
│  │ Frontend │─────▶│ Backend  │─────▶│  PostgREST   │  │
│  │  :5173   │      │  :3000   │      │    :3001     │  │
│  └──────────┘      └──────────┘      └──────┬───────┘  │
│                                               │          │
│                                               ▼          │
│                                        ┌──────────────┐  │
│                                        │  PostgreSQL  │  │
│                                        │    :5432     │  │
│                                        └──────────────┘  │
│                                                           │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    Production (Cloud)                    │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────┐      ┌──────────┐      ┌──────────────┐  │
│  │ Frontend │─────▶│ Backend  │─────▶│   Supabase   │  │
│  │ (Vercel) │      │ (Railway)│      │    Cloud     │  │
│  └──────────┘      └──────────┘      └──────────────┘  │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

## Key Differences: Development vs Production

| Aspect | Development | Production |
|--------|-------------|------------|
| Database | Local PostgreSQL | Supabase PostgreSQL |
| REST API | PostgREST (local) | Supabase REST API |
| Auth | Mock/disabled | Supabase Auth |
| Storage | Local filesystem | Supabase Storage |
| Environment | Docker containers | Cloud hosting |
| Data | Seed data | Real data |

## Cross-Platform Compatibility

This Docker-based setup works identically on:

- **macOS** (Intel and Apple Silicon)
- **Linux** (any distribution)
- **Windows** (with WSL2 or Docker Desktop)

No platform-specific configuration needed!

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [PostgREST Documentation](https://postgrest.org/)
- [Supabase Documentation](https://supabase.com/docs)
- [Vite Documentation](https://vitejs.dev/)
