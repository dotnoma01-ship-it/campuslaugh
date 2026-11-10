# CampusLaugh API quick reference

Base URL: `http://localhost:5000/api`. Authenticated routes accept `Authorization: Bearer <accessToken>`. Refresh tokens are rotated in the HTTP-only `refreshToken` cookie. Send requests with credentials enabled.

| Area | Routes |
| --- | --- |
| Health | `GET /health` |
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`; `GET /auth/me` |
| Institutions | `GET /institutions?q=&category=&ownership=&state=&page=&limit=`; `/search`; `/states`; `/categories`; `GET /institutions/:id` |
| Users | `GET /users/search?q=`, `/users/:id`, `/users/me`; `PATCH /users/me`; `POST /users/:id/follow`, `/block`; `DELETE /users/:id/block` |
| Posts and comments | `GET/POST /posts`; `DELETE /posts/:id`; `POST /posts/:id/like`, `/bookmark`; `GET/POST /posts/:id/comments`; `DELETE /comments/:id` |
| Conversations | `GET/POST /conversations`; `GET/POST /conversations/:id/messages` |
| Notifications | `GET /notifications`, `/notifications/unread-count`; `PATCH /notifications/read-all`, `/:id/read`; `DELETE /notifications/:id` |
| Discovery | `GET /search?q=`; `/hashtags/trending`; `/hashtags/:name/posts` |
| Moderation/admin | `POST /reports`; admin `GET/PATCH /reports`; public `GET /announcements`; admin `POST/PATCH/DELETE /announcements` |
| Media | `POST /uploads` with multipart form field `file` |

Institution category/ownership values are stored as free strings/category names. Directory results are alphabetically sorted and paginated. Anonymous post feed results mask their author in the public feed response.
