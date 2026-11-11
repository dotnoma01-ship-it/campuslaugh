# CampusLaugh development checklist

Status labels reflect the current implementation and verification; COMPLETE means verified for the stated scope, not full production readiness.

## Environment and foundation

- **COMPLETE** — Existing React/Vite project and backend audited; original Liquid Glass UI preserved.
- **COMPLETE** — Backend and frontend package/lock files checked. Backend uses Zod 4.6.7; `npm ls` confirms esbuild 0.28.2 and iconv-lite 0.4.24. Zod schema smoke, esbuild TypeScript transform, and backend TypeScript build pass.
- **COMPLETE** — Backend `.env` created only because it did not exist; ignored by Git. Set to requested local Mongo URI, port 5000, frontend URL, and distinct random 48-byte JWT secrets. Secret values were never printed.
- **COMPLETE** — MongoDB connection verified; API health reported `mongodb: connected`. Startup waits for MongoDB and creates declared indexes without index drops or data reset.
- **COMPLETE** — Local development is isolated from the existing backend `.env`: ignored `backend/.env.local` takes precedence and points to `127.0.0.1:27017/campuslaugh` with distinct generated local JWT secrets and blank Cloudinary fields. The local database responds with 1,190 active institutions. MongoDB service-control status cannot be queried under this Windows session, but localhost MongoDB connectivity and the API health check are verified.
- **COMPLETE** — Backend HTTP suite passes 6/6.
- **COMPLETE** — MongoDB-backed auth integration suite passes against the seeded directory, including a persisted C++ search result. Test-created user/post/token records are removed by exact generated test identity.
- **COMPLETE** — Local chat integration test passes against port 5002 with temporary authenticated accounts: room membership enforcement, Socket.IO text delivery, HTTP text delivery, realtime and persisted message notifications, notification ownership/read persistence, typing and read events, REST history persistence, and group creation. The test removes only records associated with generated test accounts; a follow-up query found zero remaining chat/auth test users.
- **COMPLETE** — Frontend TypeScript check and production bundle pass after the fake-content cleanup. Bundle output was written to a fresh temporary directory so the existing tracked `dist/index.html` change was preserved.
- **COMPLETE** — Backend production TypeScript build passes; HTTP app suite passes 6/6; Mongo-backed auth integration passes 1/1.

## Backend/API features

- **COMPLETE** — Environment validation, configured CORS, Helmet, request-size limits, rate limiting, structured errors, health status, and DB startup/index setup.
- **PARTIAL** — Authentication: register/login/refresh rotation/logout/current user/password change, hashing and inactive-account rejection implemented. The backend has a rate-limited, hashed, one-use reset-token flow; the forgot/reset frontend screens and SMTP credentials are still missing. Change-password journey lacks a dedicated integration test.
- **PARTIAL** — Institution API supports search, category/state/ownership/active filters, pagination, details, states/categories, institution requests and admin routes. Admin import/edit/review workflows need deeper authorization/API tests.
- **PARTIAL** — Follow, like, comment/reply and repost actions create persistent recipient notifications. Notification listing is paginated and populates actor profiles; frontend hydrates the persisted list and persists read/delete/clear actions. Post edit, hide, repost, and bookmark retrieval endpoints are available. Private-account requests and block/privacy checks are implemented in the feature API; broader interaction and UI authorization coverage remains.
- **PARTIAL** — Authenticated Socket.IO client hydrates conversations, joins authorized rooms, sends persistent text, processes incoming messages/typing/read receipts and presence. REST supports message edit/delete/reactions and per-user pin/mute/archive settings. Group creation and member administration endpoints, message forwarding, persisted unread/read state, and message notification delivery are implemented; two-account integration tests cover message notifications, notification ownership/read/delete, forwarding, and unread/read persistence. The group administration UI remains unfinished.
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
| Home feed/composer/post actions | **PARTIAL** | Authenticated Mongo feed, publishing, post deletion, like/repost/bookmark, comments and post reports use the API. Feed pagination and empty/error states are present. Poll voting and some actions for posts not loaded from the API remain unavailable. |
| Profile/follow/settings | **PARTIAL** | Authenticated profile lookup/update, follow, sign-out, profile image upload and password change are connected. Server-side private-account, profile privacy and notification preference settings are wired. Profile statistics/saved-post UI hydration, visible follow-request management and blocked-list controls remain unfinished. |
| Explore/search/hashtags | **PARTIAL** | User/post/hashtag search, trends, suggested users and announcements use API-backed endpoints with loading, empty and error/retry states. Broader discovery panels and a dedicated hashtag detail route are unfinished. |
| Chats/messages | **PARTIAL** | Authenticated Mongo conversations and text messages use REST and Socket.IO; typing, read receipts, presence, forwarding, persisted unread counts and message notifications are connected. Two-account tests cover HTTP/socket messages and notification ownership. Chat image/video upload UI is connected to authenticated Cloudinary storage but cannot be verified until credentials are configured. Voice notes, calls, clear-chat and group administration UI remain unfinished. |
| Notifications | **PARTIAL** | Follow, like, comment/reply, repost, mention and HTTP/Socket.IO message events create Mongo notifications and emit realtime events to authenticated user rooms. Listing, deduplication, read, read-all and deletion use the API. Account notification preferences persist server-side and suppress matching deliveries. |
| Media uploads | **PARTIAL** | Profile image and chat image/video upload paths use the authenticated Cloudinary-backed endpoint. Cloudinary credentials are not configured in this local environment, so external media storage cannot be exercised. |
| Admin/moderation | **PARTIAL** | Post and user report submission reaches the API; some admin-guarded routes exist. Admin UI and report history remain unfinished. Block/privacy enforcement is in relevant profile, feed, interaction, and messaging endpoints; broader authorization regression coverage remains. |

## Fake/demo content audit

- **COMPLETE** — Removed the unused bundled mock dataset and simulated API service. Authenticated feed, discovery, messaging and notifications no longer initialize from those datasets.
- **COMPLETE** — Removed fake call and voice-note success states, sample document/location actions, fake campus switching, and the inbox action that labelled archiving as deletion. Unsupported features are identified as unavailable.
- **PARTIAL** — Targeted source audit found no bundled demo datasets or simulated activity generators. Remaining unavailable states name unsupported call/voice features. Continue checking settings and discovery copy as features evolve. Browser-local appearance preferences and recent searches remain intentional client preferences, not account activity.

## Next development tasks

1. **PARTIAL** — Forgot/reset password screens and account deletion UI are now connected; configure SMTP delivery and test password-change/reset expiry and one-use behavior.
2. **PARTIAL** — Profile posts/replies/media/likes/reposts/saved tabs and calculated statistics are wired; verify cross-account privacy and refresh behavior with two accounts.
3. **PARTIAL** — Blocking, private follow requests, privacy preferences, and notification preferences have backend endpoints and settings UI; expand regression tests across direct API and Socket.IO access.
4. **PARTIAL** — Chat attachments, forwarding, unread persistence, and group creation are wired. Group member administration UI and Cloudinary end-to-end testing remain.
5. **PARTIAL** — Report submission/review endpoints exist; an admin moderation UI and institution administration UI remain unfinished.
6. Configure Cloudinary and SMTP credentials and exercise uploads/email delivery.
7. Run a real browser journey plus broader MongoDB-backed account/profile/discovery/privacy tests; keep test cleanup scoped to generated IDs.
8. Complete deployment release checks in `DEPLOYMENT.md`; the app is not deployment-ready until all blockers are resolved.
9. Continue reconciling directory omissions from authoritative records without guessing.

