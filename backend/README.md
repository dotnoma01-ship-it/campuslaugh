# CampusLaugh backend

Express + TypeScript API using MongoDB/Mongoose, Zod 4 validation, hashed refresh tokens, JWT access tokens, and authenticated Socket.IO connections.

## Local setup (PowerShell)

Open a PowerShell window in the project directory. The MongoDB Windows service should already be running at `127.0.0.1:27017`.

```powershell
cd C:\Users\USER\OneDrive\Desktop\campuslaugh-liquid-glass-frontend\backend
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
```

Backend config loads `.env.local` before `.env`; this lets local development override any existing environment file without overwriting it. Set `PORT=5000`, `MONGODB_URI=mongodb://127.0.0.1:27017/campuslaugh`, `FRONTEND_URL=http://localhost:5173`, and two different random JWT secrets of at least 32 characters in `.env.local`. The local file is ignored by Git. Keep all Cloudinary values blank until you have credentials; reset-email delivery is not configured.

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

The frontend environment example sets `VITE_API_BASE_URL=http://localhost:5000/api` and `VITE_SOCKET_URL=http://localhost:5000`. The socket URL can be omitted; the client then uses the origin from the API URL.

Check local services before running the application:

```powershell
node --version
npm --version
Get-Service -Name '*mongo*' -ErrorAction SilentlyContinue
Test-NetConnection 127.0.0.1 -Port 27017
Invoke-RestMethod http://localhost:5000/api/health
```

Start MongoDB using Windows Services if it is installed but stopped. The health response must include `mongodb: connected` and `MONGODB_URI` must point to `127.0.0.1`. Run `npm run dev` in `backend`, then `npm run dev -- --host 127.0.0.1` in the project root. Vite uses the ignored project-local `.vite-cache` to avoid OneDrive's read-only `node_modules/.vite` reparse point.

To exercise real-time messaging, keep the backend running with seeded institutions and run `npm run test:chat` in `backend`. This suite creates temporary accounts, checks authorized and rejected room joins, sends and receives a Socket.IO message, checks typing/read events and REST history, creates a group, then removes its test records. It uses the local service at `http://127.0.0.1:5000`; override with `CAMPUSLAUGH_API_ORIGIN` if needed.

## Implemented API routes

- `GET /api/health`
- `POST /api/auth/register`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password`; `GET /api/auth/me`; `PATCH /api/auth/password`
- `GET /api/institutions`, `/search`, `/states`, `/categories`, `GET /:id`; administrator `POST /` and `PATCH /:id`; institution request submission/review routes
- `/api/users` profile/search/follow/block routes
- `/api/posts` feed/create/delete/like/bookmark; `/api/posts/:id/comments` and `/api/comments/:id`
- `/api/conversations`, `/api/conversations/:id/messages`, `/api/conversations/:id/settings`, `/api/messages/:id` edit/delete/reactions
- `/api/notifications`, `/api/search`, `/api/hashtags`, `/api/reports`, `/api/announcements`
- `POST /api/uploads` multipart field `file`, Cloudinary-backed when all credentials are configured
- Socket.IO events: `conversation:join`, `message:send`, `typing`, `message:read`; outbound `message:new`, `typing`, `message:read`, `presence:online`, `presence:offline`

## Institution directory provenance and limits

`npm run directory:fetch` retrieves the NUC Nigerian University System, NBTE Public Register, and NCCE accredited-colleges register. It stores regulator source URLs and retrieval timestamps, canonicalizes only recognized state/ownership values, and leaves out entries where those values cannot be verified from the source. The current snapshot has 1,188 de-duplicated records across 37/37 jurisdictions and 9 categories: 327 NUC universities, 634 NBTE listed institutions, and 232 NCCE colleges/NCE-awarding institutions. Current MongoDB contains 1,190 active entries including two retained records from the earlier curated seed. Explicit locations provide city values for 861 entries; other city fields remain blank where the registers do not provide a clear city. The upstream pages list larger totals; rows lacking canonical ownership or jurisdiction are excluded rather than guessed. The directory is therefore broad but **not exhaustive**. NBTE programme-level accreditation expiry should be checked against its live register; an institution listing is not a claim that every programme is currently accredited.

Sources:

- [NUC Nigerian University System](https://enuc.nuc.edu.ng/nus)
- [NBTE official public register](https://digitalnbte.nbte.gov.ng/Public)
- [NCCE accredited colleges](https://ncce.gov.ng/AccreditedColleges/Index)

## Known gaps

Password reset email/token delivery is not configured; reset endpoints return an explicit unavailable response. Administrator accounts must be provisioned out of band; public registration cannot assign admin. The authenticated frontend hydrates direct chats from MongoDB and uses Socket.IO for text send/receive, typing and read receipts; message edit/delete/reaction and per-user conversation settings use REST. Group APIs exist, while group management UI, presence polish, unread counts, forwarding and attachment uploads remain incomplete. Other frontend integration is partial: parts of Explore, notifications, campus views, bookmarks, profiles and moderation are still local/demo data. Cloudinary storage requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`; reset email delivery requires a future email provider configuration.

