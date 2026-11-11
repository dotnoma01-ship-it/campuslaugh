# CampusLaugh development checklist

Status labels reflect the current implementation and verification; COMPLETE means verified for the stated scope, not full production readiness.

## Environment and foundation

- **COMPLETE** — Existing React/Vite project and backend audited; original Liquid Glass UI preserved.
- **COMPLETE** — Backend and frontend package/lock files checked. Backend uses Zod 4.6.7; `npm ls` confirms esbuild 0.28.2 and iconv-lite 0.4.24. Zod schema smoke, esbuild TypeScript transform, and backend TypeScript build pass.
- **COMPLETE** — Backend `.env` created only because it did not exist; ignored by Git. Set to requested local Mongo URI, port 5000, frontend URL, and distinct random 48-byte JWT secrets. Secret values were never printed.
- **COMPLETE** — MongoDB connection verified; API health reported `mongodb: connected`. Startup waits for MongoDB and creates declared indexes without index drops or data reset.
- **COMPLETE** — Backend HTTP suite passes 6/6.
- **COMPLETE** — MongoDB-backed auth integration suite passes against the seeded directory, including a persisted C++ search result. Test-created user/post/token records are removed by exact generated test identity.
- **COMPLETE** — Frontend TypeScript check and production build pass in the current project state.

## Backend/API features

- **COMPLETE** — Environment validation, configured CORS, Helmet, request-size limits, rate limiting, structured errors, health status, and DB startup/index setup.
- **PARTIAL** — Authentication: register/login/refresh rotation/logout/current user/password change, hashing and inactive-account rejection implemented and tested. Forgot/reset password is unavailable until email delivery is configured; change-password journey lacks a dedicated integration test.
- **PARTIAL** — Institution API supports search, category/state/ownership/active filters, pagination, details, states/categories, institution requests and admin routes. Admin import/edit/review workflows need deeper authorization/API tests.
- **PARTIAL** — Follow, like, comment/reply and repost actions now create persistent recipient notifications. Notification listing is paginated and populates actor profiles; frontend hydrates the persisted list and persists read/delete/clear actions. Post edit, hide, repost, and bookmark retrieval endpoints are available. Remaining privacy/follow-request, broad interaction, UI and authorization coverage gaps remain.
- **PARTIAL** — Socket.IO authenticates users and checks conversation membership; basic persistent text send, typing and read events exist. Delivery semantics, presence heartbeat and edit/delete/reaction/forward/attachment events are incomplete.
- **BLOCKED** — Cloudinary upload UI validation needs Cloudinary credentials; no credentials are configured.

## Institution directory

- **COMPLETE** — Repeatable `npm run directory:fetch` imports official NUC, NBTE, and NCCE public register pages into a timestamped snapshot with source URLs and normalized data.
- **COMPLETE** — Current snapshot contains 1,188 de-duplicated entries over all 36 states plus FCT and 9 categories: NUC universities, NBTE polytechnics/nursing/health/agricultural/allied/IEI/VEI listings, and NCCE colleges/NCE-awarding institutions. City is populated for 861 entries when explicitly stated in an official institution name; otherwise it remains blank. Current MongoDB contains 1,190 active entries including two retained records from the earlier curated seed.
- **PARTIAL** — The upstream registers list more rows than the importer can safely include. Current import excludes 1 NUC, 153 NBTE, and 32 NCCE rows whose ownership/jurisdiction cannot be canonicalized from source metadata. The directory is broad, not exhaustive; NBTE programme accreditation dates need live per-program verification.
- **COMPLETE** — Idempotent seed inserts missing records and preserves existing records by default; `UPDATE_EXISTING=true` opts into updating matches. No destructive database commands are used.

## Frontend connection map

| Screen / feature | Status | Data source / remaining work |
| --- | --- | --- |
| Login and registration | **PARTIAL** | Auth endpoints and institution search/request are wired; browser smoke plus Mongo journey pass. No reset-email delivery. |
| Home feed/composer/post actions | **PARTIAL** | Authenticated feed, publish/delete, like/bookmark, comments and post report use API; trending/announcements/side panels still use demo arrays. |
| Profile/follow/settings | **PARTIAL** | API profile lookup/update, follow, logout, and password change calls exist. Counts, bookmarks view, images, block/mute and some settings are local/demo. |
| Explore/search/hashtags | **PARTIAL** | Authenticated Explore search now calls the database API for users/posts/hashtags with debounce, cache hydration, loading, empty, and error/retry states; regex search input is escaped server-side. Browse/trending/discussion/gallery/announcement panels and hashtags detail screens still use demo data. |
| Chats/messages | **NOT STARTED** | Chat UI and StoreContext remain local/demo; no full Socket.IO client wiring. |
| Notifications | **PARTIAL** | Follow, like, comment/reply and repost generate persistent notifications; authenticated StoreContext hydrates the API list and persists read/delete/clear actions. Other event types, realtime delivery, preferences, and eliminating demo notifications remain. |
| Media uploads | **BLOCKED** | Cloudinary configuration exists but no credentials or connected UI upload flow. |
| Admin/moderation | **PARTIAL** | Some admin-guarded routes exist; admin UI and complete moderation workflow are unfinished. |

## Next development tasks

1. Replace local chat state with the existing REST API and authenticated Socket.IO client; complete message lifecycle and presence semantics.
2. Connect trending/hashtags and the remaining Explore panels to verified database results.
3. Persist notification creation/preferences and connect the existing notification UI to REST and sockets.
4. Add deeper automated authorization, route-validation, and password-change tests; run the full end-to-end user journey after each integration stage.
5. Complete Cloudinary integration after credentials are configured; continue reconciling directory omissions from authoritative detail records without guessing.

