# AGENTS.md

## Frontend Source Of Truth
- The canonical frontend root is `website/src/main.tsx` -> `website/src/App.tsx`.
- Do not introduce or switch to a second top-level app shell for production work.
- Any prototype UI must live under `website/src/prototypes/` or an explicit prototype route and must never replace the canonical root.

## Current Product Scope
- Follow `.kiro/specs/automated-data-collection/steering.md`.
- Current phase is Phase 1: automated data collection and admin review workflows.
- Required UI scope in this phase:
  - scan trigger
  - review queue
  - approve/reject actions
  - keyword management
  - tag management
  - saved searches
  - search history
  - error logs

## Merge Rule
- Visual improvements must be integrated into the routed TypeScript admin app.
- Do not build a separate static/public shell that bypasses backend-connected admin routes.
- If design exploration is needed, treat it as prototype-only until it is merged into the canonical app.

## Coordination Rule
Before starting frontend work, confirm:
1. which route/page is being changed
2. whether it is production UI or prototype UI
3. that the change stays inside the canonical app root

If those are unclear, stop and align first.
