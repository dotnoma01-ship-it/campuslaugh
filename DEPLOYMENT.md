# CampusLaugh deployment preparation

## Readiness

This checkpoint is **not yet production-ready**. Cloudinary and SMTP are unconfigured locally, and end-to-end browser journeys, moderation UI, and group administration UI still need completion and verification. Do not deploy until final checks pass.

## Recommended architecture

- Frontend: Vercel static hosting for the Vite build.
- API and Socket.IO: Render web service with persistent Node and WebSocket support.
- Database: MongoDB Atlas replica set in the API region.
- Media: Cloudinary.
- Email: SMTP provider such as Postmark, Amazon SES, or another verified provider.

Use `app.example.com` and `api.example.com` on the same registrable domain. Configure the API's exact CORS origin as the frontend origin. Production refresh cookies are HttpOnly, Secure, and SameSite=Lax.

## Environment variables

Set backend values in the hosting secret manager. Never commit real credentials.

| Variable | Requirement |
| --- | --- |
| `NODE_ENV` | `production` |
| `PORT` | Hosting platform provided port |
| `MONGODB_URI` | Atlas SRV URI with least-privilege database user |
| `FRONTEND_URL` | Exact HTTPS frontend origin |
| `TRUST_PROXY` | `true` only behind the hosting TLS proxy |
| `JWT_ACCESS_SECRET` | Unique random value, at least 32 characters |
| `JWT_REFRESH_SECRET` | Different unique random value, at least 32 characters |
| `CLOUDINARY_CLOUD_NAME` | Required for media; configure all Cloudinary values together |
| `CLOUDINARY_API_KEY` | Required for media; secret manager only |
| `CLOUDINARY_API_SECRET` | Required for media; secret manager only |
| `EMAIL_HOST` | SMTP host for password reset email |
| `EMAIL_PORT` | SMTP port, usually 587 with STARTTLS |
| `EMAIL_USER` | SMTP account |
| `EMAIL_PASSWORD` | SMTP credential, secret manager only |
| `EMAIL_FROM` | Verified sender address |
| `PASSWORD_RESET_URL` | HTTPS frontend reset route |

Frontend build variable: `VITE_API_URL=https://api.example.com/api`. Verify the Socket.IO origin against the production build.

## Build and start

In `backend/`, run `npm ci`, `npm run build`, and `npm start`. For the frontend, run `npm ci` and `npm run build`; publish the generated static assets. Do not run the development server in production. Restrict Atlas network access and enable TLS.

## Backups and recovery

Enable Atlas continuous backups or scheduled snapshots with an appropriate retention window. Before schema/index changes, take a snapshot. Restore into a separate cluster, validate user counts and representative records, then cut over the API connection string. Never test restore against the live database.

## Release verification

1. Confirm production variables and unique secrets.
2. Verify `/api/health` reports MongoDB connected.
3. Verify CORS accepts only the configured frontend origin.
4. Exercise two isolated accounts through login, refresh, posts, follow, notifications, messaging, and authorization boundaries.
5. Verify Cloudinary and SMTP with real provider credentials.
6. Check cookie attributes, API requests, and Socket.IO in browser devtools.
7. Review logs for errors without recording credentials or tokens.

## Rollback

Keep the prior frontend deployment and backend revision available. Redeploy compatible previous revisions and environment values. A code rollback should not roll back MongoDB data; restore a snapshot only for confirmed data corruption. Recheck health, authentication, and messaging after rollback.
