<div align="center">

# Weavr

### *Every Conversation Connected*

A full-stack, real-time chat application built with the MERN stack, TypeScript, and Socket.io.

**[Live App](https://weavr-chat.netlify.app)** · [Frontend on Netlify](https://weavr-chat.netlify.app) · [Backend on Render](https://weavr-backend.onrender.com)

## Demo Credentials

Try the live app with this demo account:

- **Username:** `demo` / `demo2`
- **Password:** `demo1234`

> The backend is on a free tier and sleeps after inactivity — the first login may take 30–60 seconds while the server wakes up. Just wait and try again if the first attempt is slow.

To see real-time features, open the app in two browser windows (one incognito) and log in as two different accounts.

</div>

---

## About

Weavr is a real-time messaging platform where users can hold private one-on-one conversations, chat in groups, share files, and see who's online — all updating live, without refreshing. The name comes from *weaving*: threading many separate people into connected conversations.

> **Note:** the backend runs on Render's free tier, which sleeps after inactivity. **The first request may take 30–60 seconds** while the server wakes up. Subsequent requests are fast.

---

## Features

**Authentication & Accounts**
- Register with username, email, and password
- Passwords hashed with bcrypt — never stored in plain text
- Login with **either username or email**
- JWT-based sessions that persist across refreshes
- Protected routes guarded by auth middleware

**Real-Time Messaging**
- One-on-one private conversations, delivered instantly via WebSockets
- Group chats with multiple members
- Full message history persisted to MongoDB
- Live online / offline presence indicators
- Unread message badges for both direct and group chats

**Notifications**
- In-app unread badges for direct and group chats
- Browser (desktop) push notifications for new messages, shown only while the tab is in the background
- `@username` mentions with a picker as you type; mentions get their own notification wording and a highlight on the message

**Search**
- Search within an open conversation (direct or group)
- Global search across all your conversations, with jump-to-conversation
- Filter results by person, date range, and content type (text / image / video / document)

**File Sharing**
- Send images, videos, and documents (PDF, Word, Excel, text)
- Stored on Cloudinary, so uploads persist across server restarts and redeploys
- Staged preview before sending, with optional caption
- Images and videos play inline; a full preview modal offers download
- Type and size validation on upload

**Profiles**
- Editable username, status message, and profile picture
- Profile pictures shown in the contact list, conversation headers, and group chats
- Click a contact or a group sender to view their profile: status, custom status message, join date, and recent activity (messages sent, groups joined, last active)

**Presence**
- Live online / away / offline indicators
- "Away" is set automatically after 2 minutes idle, or when the tab is backgrounded

**Group Management**
- Multiple group admins per group, with the creator permanently an admin
- Add and remove members, promote and demote admins
- Group name and group picture, editable by any group admin
- Public groups listed under **Discover**, so anyone can find and join them; groups are invite-only by default
- Members can leave a group themselves, and the creator can delete it outright
- File sharing works in group chats as well as direct messages

**Admin Panel**
- Admin-only dashboard, protected by layered auth + admin middleware
- Platform stats: total users, groups, messages, and open reports
- **Analytics & reporting** — message volume per day over a selectable 7/14/30 day range, most active users and groups, user activity (online now, active today/this week, new signups), engagement (average messages per user, weekly active share, attachment and group shares), and system health (uptime, memory, database latency)
- View all users and groups
- Create, rename, and delete groups (deleting a group also removes its messages)
- Manage any group's membership and permissions — add/remove members, grant or revoke group-admin rights
- Activate/deactivate accounts — a deactivated user keeps their data but cannot log in
- Delete users (with a self-delete guard)
- Content moderation: users report messages, admins hide them or dismiss the report

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React, TypeScript, Vite, TailwindCSS v4 |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | MongoDB Atlas (Mongoose ODM) |
| **Real-time** | Socket.io (WebSockets) |
| **Auth** | JSON Web Tokens (JWT), bcrypt |
| **File uploads** | Multer (in-memory) + Cloudinary |
| **Hosting** | Netlify (frontend), Render (backend), MongoDB Atlas (database) |

---

## Architecture

```
┌─────────────────┐      HTTP (REST)       ┌──────────────────┐
│                 │ ─────────────────────► │                  │
│  React Client   │                        │  Express Server  │ ──► MongoDB Atlas
│   (Netlify)     │ ◄────────────────────► │    (Render)      │
│                 │   WebSocket (Socket.io)│                  │
└─────────────────┘                        └──────────────────┘
```

The client talks to the server two ways: **HTTP** for request/response actions (login, fetching users, uploads) and a persistent **WebSocket** for real-time events (messages, presence). Socket.io **rooms** handle targeted delivery — each user joins a room named after their own ID for direct messages, and a room per group for group chats, so one emit reaches exactly the right people.

### Data Models

- **User** — username, email, hashed password, status, statusMessage, profilePicture, isAdmin, isActive
- **Message** — text, sender, receiver, optional file (url/name/type), mentions[], moderation flags, timestamps
- **Group** — name, members[], groupAdmins[], groupPicture, isPublic, createdBy, timestamps
- **GroupMessage** — text, sender, group, optional file, mentions[], moderation flags, timestamps

---

## Running Locally

### Prerequisites
- Node.js v18+
- A MongoDB Atlas account (free tier is fine)
- A Cloudinary account (free tier is fine) — used for file and picture uploads

### 1. Clone and install

```bash
git clone https://github.com/kalimuthu4978/weavr.git
cd weavr
```

Install both halves separately:

```bash
cd server && npm install
cd ../client && npm install
```

### 2. Environment variables

Create `server/.env`:

```
MONGO_URI=your_mongodb_atlas_connection_string
JWT_SECRET=any_long_random_string
SERVER_URL=http://localhost:5000

# Cloudinary — from your Cloudinary dashboard.
# Without these, file and picture uploads return a clear 500 error.
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Create `client/.env`:

```
VITE_API_URL=http://localhost:5000
```

### 3. Run both servers

Weavr needs two terminals — one per half:

```bash
# Terminal 1 — backend (port 5000)
cd server
npm run dev
```

```bash
# Terminal 2 — frontend (port 5173)
cd client
npm run dev
```

Open `http://localhost:5173`. Register two accounts (use an incognito window for the second) to try real-time messaging between them.

### 4. Creating an admin

Admin access is granted directly in the database, by design. In MongoDB Atlas, find your user in the `users` collection and set `isAdmin` to `true`. Log out and back in — an **Admin** button appears in the header.

---

## Deployment

| Part | Platform | Settings |
| --- | --- | --- |
| Frontend | Netlify | Base directory `client`, build `npm run build`, publish `client/dist` |
| Backend | Render | Root directory `server`, build `npm install && npm run build`, start `npm start` |
| Database | MongoDB Atlas | Network access open to the backend host |

Environment variables are set in each platform's dashboard rather than committed. The backend reads `PORT` from the environment (Render assigns it), and CORS is restricted to the known frontend origins.

---

## Known Limitations

- **Cold starts** — the free-tier backend sleeps after ~15 minutes idle; the first request afterwards takes 30–60 seconds.
- **Presence is per-connection** — a user with two tabs open is marked offline when either one closes.
- **Cloudinary free-tier caps** — the upload limit is set to 50 MB, but Cloudinary's own free tier caps images at 10 MB.
- **Push notifications need an open tab** — these use the browser Notification API, not a service worker, so they only fire while Weavr is open in a background tab. They also require https (or localhost).
- **Older uploads are broken** — files uploaded before the Cloudinary migration lived on Render's ephemeral disk and are gone. New uploads persist.

---

## Future Enhancements

- Service-worker push notifications that work with the app fully closed
- Message timestamps, typing indicators, and edit/delete
- Read receipts
- Exporting analytics reports as CSV

---

## Project Structure

```
weavr/
├── client/                  # React frontend
│   ├── public/              # Logo and static assets
│   └── src/
│       ├── api/             # Backend API calls
│       ├── auth/            # Session/token handling
│       ├── components/      # React components
│       ├── utils/           # Notification helpers
│       ├── config.ts        # Centralized backend URL
│       └── socket.ts        # Shared Socket.io connection
└── server/                  # Express backend
    ├── uploads/             # Legacy local uploads (pre-Cloudinary)
    └── src/
        ├── config/          # DB connection, Cloudinary, upload config
        ├── middleware/      # Auth and admin guards
        ├── models/          # Mongoose schemas
        ├── routes/          # API endpoints
        ├── socket/          # Modular Socket.io handlers
        └── utils/           # Shared server helpers
```

---

<div align="center">

Built by [kalimuthu4978](https://github.com/kalimuthu4978)

</div>
