# Steering Document: Automated Data Collection

## Project Overview

UFO Timeline Archive is a reference platform for UFO-related events, people, theories, and news. The system enables users to search historical UFO data and contribute new content, while administrators maintain quality through approval workflows.

## Team

- 2 developers
- Admin reviewers (content approval)

## Technology Stack

- Database: Supabase
- Focus: Backend data collection and storage infrastructure

## Frontend Governance

### Canonical Application Structure

For the current phase, the canonical frontend is the routed TypeScript admin application in `website/src`.

Approved application root:
- `website/src/main.tsx`
- `website/src/App.tsx`

This application root is the only valid entrypoint for production work during Phase 1.

### UI Scope For Phase 1

Frontend work in this phase must support the automated data collection workflow:
- scan trigger
- review queue
- approve/reject actions
- keyword management
- tag management
- saved searches
- search history
- error logs

### Prohibited Frontend Pattern

Do not create or maintain a second top-level UI application in parallel with the canonical app root.

Examples of prohibited patterns:
- a second `App.jsx` or `App.tsx` used as an alternate product shell
- a second `main.jsx` or `main.tsx` that bypasses the routed admin app
- design work that replaces data-connected admin flows with static prototype pages

### Prototype Rule

If visual exploration is needed, it must be clearly separated from the production app:
- place it under a prototype-specific path or route
- do not make it the active root entrypoint
- do not bypass implemented admin workflows

### Merge Rule For UI Work

Visual improvements must be merged into the canonical TypeScript admin app instead of developed as a separate standalone UI.

Acceptable examples:
- improving `LandingPage.tsx`
- improving `AdminLayout.tsx`
- improving shared styling in `index.css`
- improving individual admin pages while preserving data-connected flows

### Coordination Rule

Before starting frontend work, contributors must confirm:
1. which route or page is being changed
2. whether the change is production UI or prototype UI
3. that the change is being made inside the canonical app root

If those conditions are not clear, work should stop until alignment is established.

## Project Phases

### Phase 1: Automated Data Collection (Current Focus)
Priority: Data fetching and storing in database

Core capabilities:
- Keyword-based internet scanning for UFO content
- Automated content discovery and extraction
- Database schema for UFO timeline data
- Admin review queue for auto-discovered content
- Content approval workflow

### Phase 2: User Contributions (Future)
- User submission forms
- Admin approval workflow for user content
- Contribution management

### Phase 3: Search and Reference (Future)
- Search functionality across timeline data
- Public-facing reference interface
- Timeline visualization

## Current Phase Scope

This spec focuses exclusively on Phase 1: automated data collection infrastructure. The system must:

1. Scan internet sources based on configurable keywords
2. Extract and structure UFO-related content
3. Store discovered content in Supabase
4. Provide admin interface for reviewing auto-discovered content
5. Support approval/rejection workflow

## Success Criteria

- System can automatically discover UFO-related content from internet sources
- All discovered content is stored in Supabase with proper structure
- Admins can review and approve/reject discovered content
- Approved content is available for future search functionality

## Out of Scope (This Phase)

- User contribution forms
- Public search interface
- Timeline visualization
- User authentication (beyond admin)
- Alternate standalone frontend applications
