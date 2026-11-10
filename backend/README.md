# CampusLaugh backend

Express + TypeScript API using MongoDB/Mongoose, Zod 4 validation, hashed refresh tokens, JWT access tokens, and authenticated Socket.IO connections.

## Local setup (PowerShell)

Open a PowerShell window in the project directory. The MongoDB Windows service should already be running at `127.0.0.1:27017`.

```powershell
cd C:\Users\USER\OneDrive\Desktop\campuslaugh-liquid-glass-frontend\backend
if (!(Test-Path .env)) { Copy-Item .env.example .env }
```

Set `PORT=5000`, `MONGODB_URI=mongodb://127.0.0.1:27017/campuslaugh`, `FRONTEND_URL=http://localhost:5173`, and two separate random JWT secrets of at least 32 characters in `.env`. Never commit `.env`. The current ignored local `.env` is configured with distinct random secrets.

```powershell
npm ci
npm run build
npm test
npm run directory:fetch # Optional; refreshes the snapshot from NUC, NBTE, and NCCE public registers.
npm run seed            # Idempotently inserts verified records; preserves existing records by default.
npm run dev
```

`UPDATE_EXISTING=true` can be set for a deliberate administrator-controlled refresh of matched directory records. The seed does not delete records or create users/social activity. Verify the API at `http://localhost:5000/api/health`; health includes MongoDB connectivity.

For Mongo-backed auth tests, with MongoDB running and institution records seeded:

```powershell
npm run test:integration
```

In a second PowerShell window, from the frontend project root:

```powershell
if (!(Test-Path .env)) { Copy-Item .env.example .env }
npm ci
npm run dev
```

The frontend environment example sets `VITE_API_BASE_URL=http://localhost:5000/api` and `VITE_SOCKET_URL=http://localhost:5000`.

## Implemented API routes

- `GET /api/health`
- `POST /api/auth/register`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`; `GET /api/auth/me`; `PATCH /api/auth/password`
- `GET /api/institutions`, `/search`, `/states`, `/categories`, `GET /:id`; administrator `POST /` and `PATCH /:id`; institution request submission/review routes
- `/api/users` profile/search/follow/block routes
- `/api/posts` feed/create/delete/like/bookmark; `/api/posts/:id/comments` and `/api/comments/:id`
- `/api/conversations` and `/api/conversations/:id/messages`
- `/api/notifications`, `/api/search`, `/api/hashtags`, `/api/reports`, `/api/announcements`
- `POST /api/uploads` multipart field `file`, Cloudinary-backed when all credentials are configured
- Socket.IO events: `conversation:join`, `message:send`, `typing`, `message:read`; outbound `message:new`, `typing`, `message:read`, `presence:offline`

## Institution directory provenance and limits

`npm run directory:fetch` retrieves the NUC Nigerian University System, NBTE Public Register, and NCCE accredited-colleges register. It stores regulator source URLs and retrieval timestamps, canonicalizes only recognized state/ownership values, and leaves out entries where those values cannot be verified from the source. The current snapshot has 1,188 de-duplicated records across 37/37 jurisdictions and 9 categories: 327 NUC universities, 634 NBTE listed institutions, and 232 NCCE colleges/NCE-awarding institutions. Current MongoDB contains 1,190 active entries including two retained records from the earlier curated seed. Explicit locations provide city values for 861 entries; other city fields remain blank where the registers do not provide a clear city. The upstream pages list larger totals; rows lacking canonical ownership or jurisdiction are excluded rather than guessed. The directory is therefore broad but **not exhaustive**. NBTE programme-level accreditation expiry should be checked against its live register; an institution listing is not a claim that every programme is currently accredited.

Sources:

- [NUC Nigerian University System](https://enuc.nuc.edu.ng/nus)
- [NBTE official public register](https://digitalnbte.nbte.gov.ng/Public)
- [NCCE accredited colleges](https://ncce.gov.ng/AccreditedColleges/Index)

## Known gaps

Password reset email/token delivery is not configured; reset endpoints return an explicit unavailable response. Administrator accounts must be provisioned out of band; public registration cannot assign admin. Frontend API integration is partial: Home feed and core post/comment/profile/follow/settings mutations plus auth/institution selection call the backend, while Explore/search pages, most chat state, notifications, uploads, and several profile widgets still rely on demo/local data. The frontend does not yet use the Socket.IO events for full chat. Messaging event persistence is implemented for core text messages; presence heartbeats, message edit/delete/reaction/forward/attachments and complete delivery/read fanout remain incomplete. Cloudinary UI integration requires credentials.

