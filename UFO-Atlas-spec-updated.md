# UFO Atlas – Design & Development Specification

> **Goal:** Build the “IMDb for anomalous phenomena” – a stable, fast, trustworthy system where users can explore, compare and discuss timelines, theories and evidence around UFOs, exotic tech and related topics.

---

## 1. Purpose & Vision

### 1.1 Purpose

UFO Atlas is a web application and backend platform for:

- Curating **timelines** of events around cases (e.g. Roswell, Phoenix Lights).
- Expressing **theories** that connect and interpret events.
- Capturing **evidence strength** separately from **popularity** and **user ratings**.
- Providing **maps, atlas-style navigation, and time-based exploration** of events.
- Surfacing **global density patterns** so users can quickly see which countries or regions have the highest concentration of UFO-related reports, sightings, disclosures, and linked cases.
- Building a **reputation system** for users (trust, evidence quality, popularity).

The core idea: make UFO Atlas the *default reference* for anyone interested in these topics, in the same way IMDb is for movies/TV — but with a strong geospatial layer that reveals where activity clusters across the world.

### 1.2 Vision

- Be **neutral infrastructure**, not a single-narrative site.
- Clearly separate:
  - What happened (events).
  - How it’s interpreted (theories).
  - How people feel about it (ratings, popularity).
- Provide **high signal / low noise** discovery: strong filters, clear evidence indicators, good search.
- Minimize 3rd party dependencies and keep the system **simple, stable, and maintainable**.

---

## 2. Scope & Non-Goals

### 2.1 In-Scope (MVP)

- User accounts, profiles, and verification status.
- Timelines and events:
  - Past events, sightings, predictions, announcements.
  - Time uncertainty and rough dating.
  - Geolocation, tags, references.
- Theories:
  - Link to multiple timelines/events.
  - Separate scores for evidence, popularity, rating.
- Basic evidence model:
  - Event-level evidence score.
  - Theory-level evidence aggregated from events.
- Ratings:
  - Ratings for theories and timelines.
  - User-level trust votes.
- Basic search & filtering:
  - Tags, time range, location, basic full-text.
- Map & globe view:
  - Events plotted on a world map with a time range filter.
  - 3D globe mode with country-level density overlays, cluster hotspots, and regional exploration.
- Minimal notifications / follows:
  - Follow users, timelines, theories (optional for MVP but desirable).
- Admin features:
  - Approve tags.
  - Verify users.
  - Moderate/delete timelines/theories for policy violations.

### 2.2 Out of Scope (for MVP, maybe later)

- External search engine (Elasticsearch/Meilisearch).
- Redis or other external caching systems.
- Advanced job scheduling framework (use simple cron/DB jobs at first).
- Public REST API for third-party integration (documented, but can be phase 2).
- Very complex graph analytics (graph DB, etc.).
- Formal “expert panels” and advanced moderation workflows.

---

## 3. Core Concepts & Domain Model

### 3.1 Users

Users can:

- Create timelines, events, theories (subject to admin rules).
- Rate content and vote on user trust.
- Follow other users, timelines, and theories.
- Maintain preferences such as blacklists and notification settings.

Each user has a **profile** that reflects:

- Verification status.
- Trust score (how much other users trust them).
- Aggregated performance of their content (evidence, popularity, ratings, prediction accuracy).

**Key attributes:**

- `id`, `handle`, `display_name`, `bio`
- `verification_status`:
  - `UNVERIFIED | VERIFIED_USER | VERIFIED_EXPERT | ORGANIZATION`
- `user_trust_score` (0–1)
- `user_trust_votes_count`
- `content_profile`:
  - `theories_authored`, `timelines_authored`, `events_contributed`
  - `avg_theory_evidence_score`, `avg_theory_popularity_score`, `avg_theory_rating_score`
  - `prediction_score`, `predictions_resolved`
- Preferences:
  - `blacklist_tags`, `blacklist_users`, `blacklist_groups`
  - `notify_on_new_from_followed`
- Social:
  - `followers_count`, `following_count`
- Timestamps:
  - `created_at`, `updated_at`

---

### 3.2 Timelines

A **timeline** is an ordered set of events around a case or topic.

Examples:

- “Roswell – Official Narrative”
- “Roswell – Non-human Craft Hypothesis Timeline”
- “Belgium Wave Timeline”
- “NewsNation UAP Coverage Timeline”

**Attributes:**

- `id`, `title`, `description`
- `owner_id` (user or group)
- `status`: `DRAFT | PUBLISHED | ARCHIVED | DELETED`
- Tags (many-to-many)
- `event_ids` in order
- Metrics:
  - `evidence_score` (optional aggregation of event evidence)
  - `popularity_score`
  - `rating_score`
  - `views_30d`, `total_views`
  - `favourites_count`, `comments_count`
- Timestamps:
  - `created_at`, `updated_at`

---

### 3.3 Events

An **event** is a single point or interval in time, with optional uncertainty and geolocation.

Event **types**:

- `PAST`
- `SIGHTING`
- `PREDICTION`
- `ANNOUNCEMENT`

**Attributes:**

- `id`, `timeline_id`
- `type`
- Time model:
  - `start`, `end` (nullable)
  - `resolution`:
    - `SECOND | MINUTE | HOUR | DAY | MONTH | YEAR | DECADE | CENTURY | MILLENNIUM | MEGA_YEAR`
  - `certainty`:
    - `EXACT | ESTIMATED | VERY_UNSURE`
- Location (PostGIS):
  - `country`, `region`, optional `city`
  - `lat`, `lon` (geographic point)
  - `country_code` (ISO)
  - `geohash` or derived grid cell for clustering/tiling
- Content:
  - `title`, `description`
  - `media`:
    - `image_urls`
    - `reference_image_url`
  - `references`:
    - list of `{ url, type }`, e.g. `ENCYCLOPEDIA | BOOK | ARTICLE | VIDEO | FOIA_DOC`
- Evidence sub-object:
  - `source_quality_score` (0–1)
  - `community_confidence_score` (0–1)
  - `conflict_penalty` (0–1)
  - `event_evidence_score` (0–1, combined metric)
- Links:
  - `linked_theory_ids` (supporting/refuting)
- Timestamps:
  - `created_at`, `updated_at`

---

### 3.4 Theories

**Theories** interpret or explain sets of events and timelines.

**Attributes:**

- `id`, `title`, `summary`
- `author_id`, optional `owner_group_id`
- Tags
- Links:
  - `attached_to.timeline_ids`
  - `attached_to.event_ids`
- Scores (separate dimensions):
  - `evidence_score` – from linked events’ evidence.
  - `popularity_score` – from views, favourites, comments, followers.
  - `rating_score` – crowd rating average (0–1).
- Stats:
  - `views_30d`, `total_views`
  - `favourites_count`, `comments_count`, `ratings_count`
- Prediction info:
  - `prediction_related`: boolean
  - later: details on outcome and accuracy
- Timestamps:
  - `created_at`, `updated_at`

---

### 3.5 Tags & Taxonomy

Tags are used for classification and filtering.

**Attributes:**

- `id`, `name`
- Optional `parent_id` (for hierarchical structure later).
- `status`:
  - `PENDING_APPROVAL | APPROVED | REJECTED`
- `created_by`
- Timestamps

**Admin workflow:**

- Users can propose tags when creating timelines/theories.
- Admins review:
  - approve, reject, or merge with existing tags.
- Optionally limit the number of new tags per timeline/theory to avoid tag explosion.

---

### 3.6 Ratings & Trust

#### 3.6.1 Content Ratings

For **timelines** and **theories**:

- Users can rate (e.g. 1–5 stars or like/dislike).
- Store:
  - `score` (normalized to 0–1 internally).
  - `rater_id`, `target_type`, `target_id`, `created_at`.

The `rating_score` for a timeline/theory is:

- Weighted average of all ratings.
- Weight based on `user_trust_score` of the rater.

#### 3.6.2 User Trust Votes

Users can rate **other users’ trustworthiness**:

- A separate system from content rating.
- Attributes:
  - `voter_id`, `target_user_id`, `score`, `created_at`.

`user_trust_score` is a weighted average:

- Votes from high-trust users count more.
- New accounts / low-trust accounts have less weight.

---

### 3.7 Popularity

Popularity is separate from evidence and rating:

- Derived from:
  - `views_30d`, `total_views`
  - `favourites_count`
  - `comments_count`
  - `followers_count` (for theories/timelines).

`popularity_score` (0–1) is computed as a normalized, time-decayed combination of those metrics.

Important: **popularity does not equal evidence**. They are shown separately in the UI.

---

### 3.8 Evidence Model (High-Level)

Evidence is primarily modeled at the **event** level:

- `source_quality_score`:
  - based on source types and count:
    - government docs, primary witnesses, radar data, etc.
- `community_confidence_score`:
  - based on ratings of the event and its timeline, weighted by user trust.
- `conflict_penalty`:
  - reflects conflicting events/timelines about the same claim.

`event_evidence_score` is a weighted combination, e.g.:

```text
event_evidence_score =
  0.6 * source_quality_score +
  0.3 * community_confidence_score -
  0.1 * conflict_penalty
```

A **theory** references multiple events (supporting/refuting):

- `support_score` = weighted average of supporting events’ `event_evidence_score`.
- `refute_score`  = weighted average of refuting events’ `event_evidence_score`.

Example:

```text
theory_evidence_score = support_score - α * refute_score
```

(Where `α` > 1 to penalize strong refutation.)

This is then normalized to 0–1 and stored as `evidence_score` on the theory.

---

## 4. Architecture & Technology Choices

### 4.1 High-Level Architecture

- **Frontend:** SPA or SSR web app (React, Vue, Svelte – TBD).
- **Backend API:** REST (or GraphQL) service.
- **Primary DB:** PostgreSQL + PostGIS extension.
- **Auth:** JWT-based (stateless access tokens, optional refresh tokens).
- **Search:** PostgreSQL full-text search initially.
- **Caching:** In-memory per-app-instance caching; DB-level precomputed aggregates.

No Redis or external search engine for MVP, to minimize third-party dependencies.

---

### 4.2 Database: PostgreSQL (+ PostGIS)

Reasons:

- Stable, mature, excellent for relational data.
- Good support for:
  - relations (users ↔ timelines ↔ events ↔ theories ↔ ratings).
  - time types and ranges.
  - JSONB for flexible metadata.
- PostGIS for geospatial queries (events on a map).

**Example key tables (high-level):**

- `users`
- `user_trust_votes`
- `timelines`
- `timeline_events`
- `theories`
- `theory_event_links`
- `tags`
- `timeline_tags`, `theory_tags`
- `ratings` (for timelines/theories)
- `follows` (user ↔ user/group/timeline/theory)
- `views_daily` (aggregated views per day, for popularity)
- `country_event_aggregates` (country-level counts, densities, evidence-weighted totals)
- `region_event_aggregates` (optional finer-grained geo summaries)
- `admin_actions` (moderation logs)

---

### 4.3 Authentication & Authorization

- JWT-based access tokens:
  - Signed by backend.
  - Short-lived (e.g. 15–60 minutes).
- Optional refresh tokens stored in DB.
- Roles:
  - `USER`
  - `ADMIN`
  - `SUPER_ADMIN` (manages admin group membership)
- Fine-grained resource-level access:
  - Owner vs contributors for timelines.
  - Public view for published content.
  - Admins can soft-delete content and apply policy.

---

### 4.4 Search & Filtering

MVP search uses Postgres full-text + standard indexing:

- `tsvector` columns for:
  - timeline title/description.
  - theory title/summary.
  - event titles/descriptions.
- GIN indexes on `tsvector` columns.
- Filtering:
  - by tags (join on tag tables).
  - date range (event times).
  - location (PostGIS queries).
  - country / region / bounding box / radius.
  - min evidence score, rating, popularity.
  - exclusion based on user’s blacklist.
- Atlas-specific aggregation queries:
  - country counts by time window.
  - density ranking by area / later by population.
  - hotspot clustering for globe rendering.

Later, a dedicated search engine can be added if performance/complexity demands it.

---

## 5. Feature Design Ideas

### 5.1 Home / Landing Page

For a first-time logged-in user:

- Sections:
  - **Trending Theories** (high popularity, any evidence).
  - **Most Evidenced Theories** (highest evidence_score).
  - **Top Timelines** (by rating).
- Each card shows:
  - Title + short summary.
  - Evidence indicator: `✅ Strong / ⚠️ Mixed / 🚫 Weak`.
  - Popularity: `🔥`, `🙂`, `🧊`.
  - Rating: stars + count.
  - Author name + verification badge.

Filters at the top:

- By tags (multi-select).
- Time range.
- Location (country dropdown; advanced map drawer later).
- Author trust threshold (optional).

---

### 5.2 Timeline View

- Horizontal or vertical timeline visualization.
- Each event shown as a **card**:
  - title, time, location.
  - type icon: past, prediction, sighting, announcement.
  - small evidence bar or icon (if enabled).
  - optional thumbnail image.

- Users can:
  - click an event to expand full description and references.
  - see linked theories.
  - see a mini map for location.

Time axis:

- A marker for **“today”** in the middle when browsing wide ranges.
- Ability to zoom in/out (e.g. from decades to days).

---

### 5.3 Map & Globe View

- 2D world map with event markers.
- Time slider to filter events by date range.
- Markers colored by event type, confidence band, or hosting timeline.
- Clicking a marker:
  - opens event card.
  - allows jumping to the full timeline.

### 5.4 3D Globe / Atlas Mode

The signature interface of UFO Atlas should be a **3D globe** that turns raw event data into a geographic intelligence layer.

Core behaviors:

- Users can rotate and zoom a 3D Earth.
- Countries/regions can be shaded by:
  - **event count**
  - **weighted event density**
  - **evidence-weighted density**
  - **time-filtered activity**
- Heat/density overlays should make it obvious which countries have the most UFO-related activity.
- Hovering a country shows:
  - country name
  - total event count
  - density score
  - strongest cases / top linked timelines
- Clicking a country opens a detail panel with:
  - top cases
  - timelines connected to that geography
  - event-type breakdown
  - time distribution
- Users can switch between:
  - **marker mode**
  - **cluster mode**
  - **heat / density mode**
  - **country ranking mode**

Important product value:

- The globe should help answer questions like:
  - “Which country has the highest density of sightings?”
  - “Which regions had activity spikes in the 1950s?”
  - “Where are the most evidence-weighted military-linked cases?”
  - “Which countries dominate by raw count vs by density per area or population?”

Recommended derived metrics:

- `country_event_count`
- `country_event_density_area`
- `country_event_density_population` (later, optional)
- `country_evidence_weighted_score`
- `country_sighting_count`
- `country_disclosure_count`
- `country_prediction_count`

Implementation note:

- For MVP, keep this simple:
  - precompute country aggregates daily or on write
  - store them in aggregate tables/materialized views
  - render the 3D globe with a lightweight WebGL solution
- Full volumetric heatmaps and advanced temporal animation can come later.

---

### 5.5 Theory Detail View

- Top section:
  - title, summary.
  - author + badge.
  - Evidence/Popularity/Rating indicators.
- Tabs:
  - **Overview** – human-readable explanation, key supporting events & timelines.
  - **Evidence** – list of supporting and refuting events with event_evidence_score.
  - **Discussion** – comments, questions, arguments.
  - **Related** – linked timelines, other theories, related tags.

Evidence tab:

- Separate sections:
  - “Supporting events” (with evidence scores).
  - “Refuting events”.
- Possibly a trend graph for `theory_evidence_score` over time.

---

### 5.6 User Profile

Shows:

- Display name, handle, bio, verification badge.
- Metrics:
  - Trust: `High / Medium / Low` + numeric score.
  - Evidence profile: `Strong / Mixed / Weak` (based on avg_theory_evidence_score).
  - Popularity: `High / Medium / Niche`.
- Content:
  - list of top theories (by evidence or popularity).
  - list of top timelines.
- Prediction section:
  - number of predictions made.
  - accuracy (% correct, partial, incorrect).

---

### 5.7 Admin Panel

For admins:

- Tag approval queue:
  - list of pending tags, suggested merges, etc.
- User verification:
  - approve `VERIFIED_USER`, `VERIFIED_EXPERT`, `ORGANIZATION`.
- Moderation:
  - flagged timelines/theories/events.
  - ability to soft-delete, providing a policy reason.
- Audit log:
  - `admin_actions` table surfaced in UI.

---

## 6. Testing Strategies

### 6.1 Unit Testing

- **Backend:**
  - Models: CRUD operations and integrity constraints.
  - Business logic:
    - evidence score calculations.
    - popularity and rating aggregations.
    - trust score computations.
  - Authentication & authorization:
    - permissions for creating/editing timelines and theories.
    - admin-only actions.

- **Frontend:**
  - Component tests for key UI elements:
    - timeline rendering.
    - theory evidence indicators.
    - map interaction components.
  - Utility functions (sorting, formatting dates, etc.).

### 6.2 Integration Testing

- API integration tests:
  - User registration, login, JWT handling.
  - Timeline creation, event addition, theory linking.
  - Tag proposals and admin approvals.
  - Ratings and trust votes.
  - Search & filtering with realistic datasets.

- DB integration:
  - Migrations (up/down) tests on a throwaway database.
  - Data integrity for joins (e.g. deleting a user should respect constraints).

### 6.3 End-to-End (E2E) Testing

Use a browser automation tool (e.g. Playwright / Cypress):

- Scenarios:
  - “New user signs up, browses top timelines, opens a theory.”
  - “Verified expert creates a timeline, adds events, links a theory.”
  - “User rates a theory, trust-votes another user, sees updated scores.”
  - “Admin approves tags and verifies a user.”
  - “User applies tag + date + location filters and sees expected results.”

Focus on core flows that must not break.

### 6.4 Performance & Load Testing

- Use realistic mock data:
  - hundreds of thousands of events.
  - tens of thousands of timelines and theories.
  - millions of ratings and views.
- Test:
  - heavy read patterns (browsing, search).
  - light to moderate write patterns (new events/theories/ratings).
- Track:
  - DB query latency.
  - API P95/P99 response times.
  - impact of full-text search filters.

Adjust indexes and query strategies based on findings.

### 6.5 Security Testing

- Authentication:
  - JWT handling, token expiry, refresh flows.
- Authorization:
  - Ensure only owners/admins can edit/delete resources.
  - Verify that blacklists correctly hide content from users.
- Injection & XSS:
  - Validate/sanitize input fields.
  - Ensure markdown or HTML rendering is safe.
- Rate limiting:
  - Basic protections against abuse (login, rating spam, content creation).

---

## 7. Roadmap (High-Level)

### Phase 1 – MVP

- Core models: users, timelines, events, theories, tags, ratings, user trust.
- Basic UI:
  - Timeline view.
  - Theory view.
  - User profile.
  - Home page with simple recommendations.
- Evidence model v1:
  - per-event and aggregated per-theory.
- Map view v1 (basic event markers + time slider).
- 3D globe v1 with country density shading and top-country drilldown.
- Admin panel v1:
  - tag approval.
  - user verification.
  - basic moderation.

### Phase 2 – Enhancements

- Advanced filtering and saved searches.
- Better atlas analytics: density modes, ranking layers, and historical playback.
- More sophisticated popularity and trend analytics.
- Notifications and subscription flows.
- Public read-only API for integration and embeds.
- Better discussion features (structured comments: support, refute, question, etc.).

### Phase 3 – Scaling & Advanced Features

- External search engine integration (if needed).
- Advanced job scheduling & background processing.
- Deeper graph-like exploration (related cases and theories).
- Advanced globe intelligence layers: animated time sweeps, evidence-weighted heatmaps, and comparative country dashboards.
- Bulk data export for research (public datasets).

---

## 8. Summary

UFO Atlas aims to be the **authoritative, structured, and transparent** place to explore anomalous phenomena, with a particular focus on:

- Clear separation of **evidence**, **popularity**, and **opinion**.
- Rich **timeline, map, and 3D globe-based exploration**.
- Healthy **reputation and trust** signals at both content and user level.
- A conservative, robust tech stack centered on **PostgreSQL + PostGIS**, minimizing third-party dependencies.

This document provides the foundation for the initial implementation: domain model, features, architecture, testing strategies, and the first version of the UFO Atlas globe experience. It can evolve as we learn from real users and data.
