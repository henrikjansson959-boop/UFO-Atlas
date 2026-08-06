# UFO Atlas Project Handoff

Read this first when opening UFO Atlas in a new Codex chat.

## Quick start

The easiest option is to double-click `Start UFO Atlas.cmd`.

From PowerShell in this folder:

```powershell
.\Start-UFOAtlas.ps1
```

This starts and verifies:

1. LM Studio's local API on port `1234`
2. Gemma 4 E4B (`google/gemma-4-e4b`)
3. The UFO Atlas API on port `3005`
4. The Vite website on port `5173`

It then opens:

`http://127.0.0.1:5173/admin/scan`

To stop everything started for UFO Atlas:

- Double-click `Stop UFO Atlas.cmd`, or
- run this from PowerShell:

```powershell
.\Stop-UFOAtlas.ps1
```

Docker is not required for the current setup. LM Studio runs Gemma directly and
provides an OpenAI-compatible local API.

## Current architecture

- Repository: `C:\Users\henri\Repos\UFO Atlas`
- Canonical frontend: `website/src/main.tsx` -> `website/src/App.tsx`
- Frontend: React, TypeScript, Vite
- Backend: Express and TypeScript
- Database: the user's UFO Atlas Supabase project
- Local AI: LM Studio with Gemma 4 E4B
- Internet discovery: Bing RSS by default, optional SearXNG

The root `.env` is already configured for:

- `API_PORT=3005`
- `LOCAL_AI_ENABLED=true`
- `LOCAL_AI_URL=http://127.0.0.1:1234/v1`
- `LOCAL_AI_MODEL=google/gemma-4-e4b`

Never print or replace the Supabase keys from `.env`.

## What has been built

- Admin scan workflow and review queue
- Approve and reject actions
- Keyword, tag, saved-search, search-history, and error-log tools
- Public content area
- Case pages that group articles, documents, forums, video, images, books,
  podcasts, witness reports, news reports, and case files around one case
- Public people profiles with photo, role, biography, related content, related
  cases, and sources
- Gemma-assisted person profile suggestions from review-queue material
- Navigation from admin back to the public Cases and People area
- Category colors for quicker recognition
- Supabase migrations for cases and people

## Scan behavior

- The user's text is searched as a normal search query.
- There is no fixed 30-result cap.
- Bing RSS or SearXNG pages continue until the provider returns no new links.
- Duplicate, obvious mismatch, safety, and relevance checks still apply.
- Accepted discoveries enter the review queue; publication remains an explicit
  admin choice.

## Useful addresses

- Public cases: `http://127.0.0.1:5173/cases`
- Public people: `http://127.0.0.1:5173/people`
- Admin scan: `http://127.0.0.1:5173/admin/scan`
- Review queue: `http://127.0.0.1:5173/admin/review-queue`
- API status: `http://127.0.0.1:3005/api/system/status`
- LM Studio models API: `http://127.0.0.1:1234/v1/models`

## Notes for the next AI

- Preserve existing user changes in the dirty worktree.
- Do not create a second frontend shell.
- Do not switch the AI integration back to Ollama or Qwen.
- Do not create fake public cases or people merely for testing.
- Before frontend edits, follow the coordination rule in `AGENTS.md`.
