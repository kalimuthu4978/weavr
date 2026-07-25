<div align="center">

# Weavr

### *Every Conversation Connected*

A full-stack, real-time chat application built with the MERN stack, TypeScript, and Socket.io.

**[Live App](https://weavr-chat.netlify.app)** · [Frontend on Netlify](https://weavr-chat.netlify.app) · [Backend on Render](https://weavr-backend.onrender.com)

## Demo Credentials

Try the live app with this demo account:

- **Username:** `demo` / 'demo2'
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

**Search**
- Search within an open conversation (direct or group)
- Global search across all your conversations, with jump-to-conversation

**File Sharing**
- Send images and documents (PDF, Word, Excel, text)
- Staged preview before sending, with optional caption
- Click any shared file: images open a full preview, all files offer download
- Type and size validation on upload

**Profiles**
- Editable username and status message
- A contact's status message shows in the conversation header

**Admin Panel**
- Admin-only dashboard, protected by layered auth + admin middleware
- Platform stats: total users, groups, and messages
- View all users and groups
- Delete users (with a self-delete guard)

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React, TypeScript, Vite, TailwindCSS v4 |
| **Backend** | Node.js, Express, TypeScript |
| **Database** | MongoDB Atlas (Mongoose ODM) |
| **Real-time** | Socket.io (WebSockets) |
| **Auth** | JSON Web Tokens (JWT), bcrypt |
| **File uploads** | Multer |
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

- **User** — username, email, hashed password, status, statusMessage, isAdmin
- **Message** — text, sender, receiver, optional file (url/name/type), timestamps
- **Group** — name, members[], createdBy, timestamps
- **GroupMessage** — text, sender, group, timestamps

---

## Running Locally

### Prerequisites
- Node.js v18+
- A MongoDB Atlas account (free tier is fine)

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
- **Uploaded files are not permanent** — Render's free tier uses an ephemeral disk, so files uploaded to the server are cleared when the service restarts. Messages, users, and groups (all in MongoDB) persist normally. The fix is migrating uploads to cloud storage such as Cloudinary or S3.
- **Presence is per-connection** — a user with two tabs open is marked offline when either one closes.

---

## Future Enhancements

- Migrate file storage to Cloudinary so uploads persist
- Profile pictures for users and groups
- Group member management — multiple admins, adding and removing members
- Message timestamps, typing indicators, and edit/delete

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
│       ├── config.ts        # Centralized backend URL
│       └── socket.ts        # Shared Socket.io connection
└── server/                  # Express backend
    ├── uploads/             # Uploaded files (local only)
    └── src/
        ├── config/          # DB connection, upload config
        ├── middleware/      # Auth and admin guards
        ├── models/          # Mongoose schemas
        └── routes/          # API endpoints
```

---

<div align="center">

Built by [kalimuthu4978](https://github.com/kalimuthu4978)

</div>
