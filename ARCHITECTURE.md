# TaskStaker — Architecture & Deep Dive

This document explains every piece of TaskStaker in detail: how it works, why each tech was chosen, and how every file fits together. Read this if you want to understand, fork, or extend the project.

---

## Table of Contents

1. [The Idea](#1-the-idea)
2. [Tech Stack & Why](#2-tech-stack--why)
3. [System Architecture](#3-system-architecture)
4. [Smart Contract](#4-smart-contract)
5. [Backend (Express)](#5-backend-express)
6. [Frontend (React + Vite)](#6-frontend-react--vite)
7. [Authentication (Clerk)](#7-authentication-clerk)
8. [Database & Storage (Supabase)](#8-database--storage-supabase)
9. [AI Validation (Groq + Gemini)](#9-ai-validation-groq--gemini)
10. [Email System (Resend)](#10-email-system-resend)
11. [Wallet Modes — Embedded & External](#11-wallet-modes--embedded--external)
12. [The Relayer Pattern](#12-the-relayer-pattern)
13. [UI / UX Decisions](#13-ui--ux-decisions)
14. [Database Schema](#14-database-schema)
15. [Complete API Reference](#15-complete-api-reference)
16. [Deployment Guide](#16-deployment-guide)
17. [Real-World Use Cases & Proof Examples](#17-real-world-use-cases--proof-examples)

---

## 1. The Idea

People are bad at keeping promises to themselves. Studies show that public commitments + financial stakes dramatically increase follow-through. TaskStaker combines both:

- **Public**: you assign a real human as your validator
- **Financial**: you stake real (testnet) ETH that you only get back if validated

If you don't ship before the deadline, your stake is forfeited. The contract enforces this on-chain — no admin can override it.

**Core philosophy:** the stakes must be *real* for the platform to work. Forfeiture isn't a bug; it's the feature. The whole psychological mechanism breaks if you can squirm out.

---

## 2. Tech Stack & Why

### Smart Contract — Solidity 0.8.19 on Sepolia

- **Why Solidity**: industry standard for EVM contracts, mature tooling, well-documented
- **Why 0.8.19**: built-in overflow checks (no SafeMath needed), supports custom errors, stable
- **Why Sepolia**: Ethereum's official testnet — closest thing to real mainnet behavior without real money. Free Sepolia ETH from faucets makes the stakes "real enough" for accountability without putting users at financial risk

### Frontend — React + Vite

- **Why React**: huge ecosystem, fast dev iteration, plenty of Web3 libraries
- **Why Vite over CRA**: 10x faster cold starts, native ES modules in dev, modern tooling
- **Why React Router 7**: simplest, most flexible client-side routing for SPAs
- **Why Framer Motion**: declarative animations for the wallet panel, hamburger menu, AI chatbot drawer
- **Why date-fns over Moment**: 6x smaller, immutable, tree-shakeable
- **Why TailwindCSS**: utility-first means no CSS file maintenance, no class-name disputes, instant theme changes via the config file. The dark obsidian + crimson palette is achievable in a single config edit

### Backend — Node.js + Express

- **Why Node**: same language as the frontend; sharing types/logic is trivial. Ethers.js is a first-class citizen
- **Why Express**: minimal, unopinionated, every blog post for the last 10 years assumes it. Easy for new devs to read
- **Why Multer**: standard for handling `multipart/form-data` (file uploads)

### Auth — Clerk

- **Why not Auth0 / Firebase Auth / Supabase Auth**: Clerk has the best DX for React. `useUser()`, `useAuth()`, `<SignedIn>`, `<SignedOut>` components mean ~5 lines to gate a route. Built-in UI components save weeks of work
- **Why not metamask-only auth**: most users don't have MetaMask. Clerk supports Google, email, phone, OAuth out of the box. The wallet is *separate* from identity — you have an account first, then optionally link a wallet

### Database — Supabase (Postgres + Storage + Realtime)

- **Why not Firebase**: Firestore is NoSQL; we need joins and proper relational queries (e.g. "give me notifications for user where task.owner = me")
- **Why not raw Postgres + S3**: Supabase bundles auth-aware Postgres, file storage with signed URLs, *and* a realtime websocket feed for free. One service, one dashboard
- **Why service-role key on backend**: bypasses RLS for trusted server operations. Anon key on frontend gets RLS protection automatically

### AI — Groq (primary) + Gemini (fallback)

- **Why Groq**: blazing fast inference (`llama-3.3-70b-versatile` returns in ~1s). Free tier is generous. Vision support via `meta-llama/llama-4-scout-17b-16e-instruct`
- **Why Gemini fallback**: `gemini-2.5-flash-preview` is also fast, also free-tier, and we get redundancy if Groq is down. Both are exposed via the `AI_PROVIDER` env var
- **Why two providers**: AI APIs have outages. The user feels nothing — backend silently falls back

### Email — Resend

- **Why not SendGrid / Mailgun / Postmark**: Resend is the cleanest API (literally one POST), free tier covers a side project comfortably, beautiful dashboard with delivery analytics
- **`onboarding@resend.dev`** lets you send without a verified domain — ideal for testing

### Blockchain — Ethers.js v5

- **Why not v6**: v6 is faster but the API broke; many tutorials and packages still ship v5. Sticking with v5 means our code matches every Stack Overflow answer. Easy to upgrade later
- **Why not Web3.js**: ethers has cleaner types, better error messages, smaller bundle

---

## 3. System Architecture

### Three independent processes

1. **Frontend (Vite dev server)** — port 5173. Pure SPA. Talks to backend via `/api/*` and to the chain directly via Ethers.js (only for MetaMask flows)
2. **Backend (Express)** — port 3001. Stateless API + a long-running blockchain event listener and deadline checker
3. **Smart Contract** — Sepolia testnet at the address from `.env`

### Two wallet flows

| Flow | Who signs | When |
|------|-----------|------|
| Embedded | Backend (using user's deterministic key) | Default — zero MetaMask popups |
| External | User (via MetaMask) | Optional — for users who want full custody |

### Three signing identities for chain transactions

| Identity | Who | Signs |
|---|---|---|
| **User wallet** | The user (via MetaMask or embedded key) | `createTask`, `claimFunds` (only ETH-moving txs) |
| **Relayer wallet** | Backend server | `submitProof`, `validateTask` (no ETH movement, just status updates) |
| **Anyone** | Anyone, including a cron job | `forfeitStake` (cleanup after deadline; doesn't move funds anywhere it shouldn't) |

The relayer separation is critical — it removes the wallet popup from the most-used user actions.

### Realtime data flow

```
User submits proof
   │
   ▼
Backend signs submitProof tx (relayer)
   │
   ├── tx broadcast to Sepolia
   ├── Backend inserts notification row in Supabase
   ├── Supabase pushes realtime event to all subscribed clients
   ├── Validator's notification bell badge updates instantly
   └── Resend email sent to validator
```

---

## 4. Smart Contract

**File:** `contract/contracts/TaskStakerV2.sol`

### Storage layout

```solidity
struct Task {
    address user;          // task owner
    address validator;     // assigned validator (always the relayer in V2)
    string  name;
    uint256 stake;         // wei
    uint256 deadline;      // unix timestamp
    bool    completed;     // proof was submitted
    bool    validated;     // validator approved
    bool    claimed;       // funds were claimed OR forfeited
    string  proofUrl;
    address token;         // address(0) = native ETH
}

Task[] public tasks;
mapping(address => uint256) public completedTaskCount;
address public owner;
address public relayer;
uint256 public constant MIN_DURATION_HOURS = 1;
```

### Functions

| Function | Caller | Purpose |
|---|---|---|
| `constructor(address _relayer)` | Deployer | Sets owner + relayer |
| `setRelayer(address)` | Owner only | Rotate the relayer if compromised |
| `createTask(name, durationHours, validator)` | User | Stake ETH; minimum 1 hour |
| `createTaskWithToken(name, hours, validator, token, amount)` | User | Same, but with ERC-20 (Base chain) |
| `submitProof(taskId, proofUrl)` | User OR relayer | Mark `completed = true` |
| `validateTask(taskId)` | On-chain validator OR relayer | Mark `validated = true` |
| `claimFunds(taskId)` | Task owner | Transfer stake back; **only after validation** |
| `forfeitStake(taskId)` | Anyone | Permanent forfeit; **only after deadline expired and not completed** |
| `getTask(taskId)` | View | Returns full Task struct |
| `getTaskCount()` | View | Total tasks ever created |

### Why `validator` always equals `relayer`

In V2, the assigned-validator concept is tracked **off-chain in Supabase** (`task_validators` table). The on-chain `validator` field is set to the relayer address during `createTask`. This means:

- A validator never needs a wallet
- The backend can authorize validation against the off-chain assignment
- The contract just trusts the relayer for status updates

Trade-off: requires trusting the backend operator. Acceptable for a portfolio-grade demo on testnet. For mainnet you'd want a multi-validator consensus or DAO governance.

### Stake zeroing

Both `claimFunds` and `forfeitStake` set `task.stake = 0` before the transfer. This is a reentrancy-safe pattern (Checks-Effects-Interactions). It's also why the frontend caches stake amounts in `localStorage` for the display of settled tasks (see `TaskList.jsx`).

### Events

```solidity
event TaskCreated(uint256 taskId, address user, address validator, string name, uint256 stake, uint256 deadline, address token);
event ProofSubmitted(uint256 taskId, string proofUrl);
event TaskValidated(uint256 taskId, address validator);
event FundsClaimed(uint256 taskId, address user, uint256 amount);
event StakeForfeited(uint256 taskId, address user, uint256 amount);
```

These power the backend event listener which, in turn, populates Supabase notifications.

---

## 5. Backend (Express)

**Entry:** `backend/src/index.js`

### Boot sequence

1. Load `.env`
2. Initialize Express, CORS, JSON body parsing, Clerk middleware
3. Mount routes
4. Start listening on `PORT`
5. Initialize blockchain event listener (`initEventListener`)
6. Start deadline checker (`startDeadlineChecker`) — runs immediately + every 5 min

### Directory layout

```
backend/src/
  index.js                  # Boot + global routes (health, config, ETH price)
  middleware/
    auth.js                 # Clerk middleware wrappers
  services/
    supabase.js             # Service-role Supabase client
    relayer.js              # Backend wallet for submitProof / validateTask
    embeddedWallet.js       # Per-user deterministic wallet
    events.js               # Blockchain event listener + deadline checker
    email.js                # Resend wrapper + 4 email templates
    ai.js                   # Groq + Gemini providers
  routes/
    users.js                # Register, link wallet, resolve, /me
    tasks.js                # Off-chain proof/validation, assignments
    wallet.js               # Embedded wallet info + create-task + claim
    upload.js               # Proof file upload to Supabase Storage
    ai.js                   # AI analyze + chat endpoints
    notifications.js        # Get / mark-read
    leaderboard.js          # Top 50 users by completed tasks
```

### Critical services

#### `relayer.js`
A single wallet (private key in `RELAYER_PRIVATE_KEY`) signs all `submitProof` and `validateTask` calls. The contract's `relayer` storage variable must equal this wallet's address — set at deployment.

```js
const tx = await c.submitProof(taskId, proofUrl, { gasLimit: 200000 });
tx.wait().catch(/* fire-and-forget */);
return { txHash: tx.hash };
```

The `tx.wait()` call is intentionally not awaited. The Sepolia block time of 12-25s would make the HTTP response unbearably slow. We broadcast and return; the chain confirms in the background. The Supabase notification + email already capture the user-facing "this happened" signal.

#### `embeddedWallet.js`
```js
const seed = keccak256(WALLET_MASTER_SECRET + ":" + clerkId);
const wallet = new ethers.Wallet(seed);
```

Two inputs → deterministic wallet. The same Clerk user always gets the same Sepolia address. Means we can show a stable "Your TaskStaker wallet: 0xabc..." in the UI. The master secret is the keystone — losing it loses every user's funds.

#### `events.js`
Two responsibilities:

1. **Live event listener** — `contract.on("ProofSubmitted")`, `"TaskValidated"`, `"TaskCreated"`, `"FundsClaimed"`. Each handler inserts a Supabase notification row.

2. **Deadline checker** — `setInterval` running every 5 min:
   - Loops every on-chain task
   - For each unsettled task with `deadline - now <= 1 hour`: send "deadline approaching" notification + email
   - For each unsettled task with `deadline <= now`: send "deadline missed — stake forfeited" notification + email
   - Notifications are deduplicated by `(user_id, task_id, type)` so the same email is never sent twice

Returns a function so `index.js` can expose a `/api/debug/deadline-check` route to manually trigger it (useful when developing).

### Key route logic

#### `routes/wallet.js#create-task` (embedded path)
```
1. Validate input (hours >= 1, stake > 0, validator exists)
2. Resolve validator + owner from Supabase IN PARALLEL
3. Get embedded wallet for clerkId
4. Verify balance >= stake + gas buffer
5. Sign + broadcast createTask
6. Return { txHash } IMMEDIATELY (don't await tx.wait())
7. In background: tx.wait() → upsert task_validators → notify validator
```

This is the optimistic-response pattern: HTTP returns in ~1.5s, the actual chain confirmation happens out-of-band, and the frontend polls for the new task.

#### `routes/tasks.js#submit-proof`
```
1. Verify task ownership (Supabase task_validators OR on-chain user address)
2. Single getTask() call serves both auth check and preflight
3. Preflight: not already completed, not past deadline
4. Relay submitProof via backend wallet
5. If relayer fails with CALL_EXCEPTION: fall back to user's embedded wallet
6. Respond immediately with { success: true }
7. Background: insert notification row + send email to validator
```

#### `routes/tasks.js#validate`
Auth check happens against `task_validators.validator_user_id` for new tasks, or against the on-chain validator address for legacy tasks. Either way, the relayer signs the on-chain `validateTask` transaction — the validator never needs a wallet.

---

## 6. Frontend (React + Vite)

**Entry:** `frontend/src/main.jsx` → `App.jsx`

### Component tree

```
ClerkProvider
  BrowserRouter
    App
      Routes
        / (Landing or AuthenticatedApp)
        /dashboard (AuthenticatedApp)
        /leaderboard (AuthenticatedApp page="leaderboard")
        /profile (AuthenticatedApp page="profile")
      AuthenticatedApp
        UsernameSetup (if first login)
        Layout
          NotificationBell
          WalletPanel (drawer)
          HamburgerMenu (drawer)
          {page-specific content}:
            - Dashboard (CreateTask + TaskList side-by-side)
            - Leaderboard
            - Profile
            - AIChatbot (drawer, opens from any task card)
```

### State architecture

| State | Lives in | Why |
|---|---|---|
| `userProfile` | `App.jsx` | Loaded once on mount via `getMe()`; passed everywhere |
| `derivedCompletedTasks` | `App.jsx` | Counted from chain by TaskList; ratcheted via `maxCompletedRef` so it never decreases (prevents leaderboard flicker) |
| `effectiveProfile` | Memo in `App.jsx` | `max(userProfile.completed_tasks, derivedCompletedTasks, ratchet)` |
| `walletState` | `App.jsx` | MetaMask connection state (address, chain, balance) |
| `tasks[]` | `TaskList.jsx` | Loaded from chain every 7s + after every action |
| `assignments` | `TaskList.jsx` | Validator/owner usernames keyed by task ID, from Supabase |
| `taskCreateTick` | `Dashboard.jsx` | Bumps when CreateTask succeeds → triggers TaskList polling |

### TaskList: the most complex component

Three patterns work together:

1. **Stable `loadTasks` callback** — `useCallback([walletReady, myUserId, myWalletAddr])`. Primitive deps only, so it doesn't re-fire on every render.
2. **`loadGenRef` race guard** — increments per call. Stale assignment-fetch promises check `gen !== loadGenRef.current` and bail out.
3. **localStorage stake cache** — for tasks that have been claimed (where `task.stake = 0` on-chain), we look up the original amount from `localStorage` keyed by task ID. We populate this cache every time we load a task while its stake is non-zero. Zero RPC calls, fully reliable for the user's own tasks.

```js
// Pseudocode for stake recovery
const cache = JSON.parse(localStorage.getItem("ts_task_stakes") || "{}");
tasksData.forEach(t => {
  if (!t.claimed && stake > 0)             cache[t.id] = t.stake;     // remember
  if (t.claimed && stake === 0 && cache[t.id]) t.stake = cache[t.id];  // restore
});
localStorage.setItem("ts_task_stakes", JSON.stringify(cache));
```

### Auto-refresh pipeline

```
TaskList mounts
  ├── useEffect → loadTasks() once on mount
  ├── useEffect → setInterval(loadTasks, 7000) for live state
  └── useEffect → on taskCreateTick change: immediate load + 6×5s polling
                  (catches the new task as soon as it confirms on-chain)
```

### CreateTask logic

Two paths share the same form:

- **Embedded**: POST `/api/wallet/create-task` → backend signs and returns `txHash` instantly. UI shows "Confirming on chain…" with a spinner; `pollForConfirmation` clears it after 20s.
- **MetaMask**: `contract.createTask(...)` directly → user signs in popup → `tx.wait()` resolves with the receipt → frontend extracts `taskId` from `TaskCreated` event → POST `/api/tasks/assign-validator` to record the assignment.

Both call `onTaskCreated()` to bump `taskCreateTick` in Dashboard, kicking TaskList's polling into action.

### Frontend utilities

- `utils/web3.js` — `initWeb3`, `getReadOnlyContract`, network switching, `formatEther`/`parseEther` re-exports
- `utils/api.js` — every fetch wrapped with `Authorization: Bearer ${clerkToken}` and JSON / FormData handling
- `utils/storage.js` — proof file upload via `/api/upload`, returns Supabase public URL
- `utils/supabase.js` — anon-key Supabase client for the realtime notification subscription
- `hooks/useNotifications.js` — subscribes to `INSERT` on `notifications` filtered by `user_id`; updates badge & list

---

## 7. Authentication (Clerk)

### Frontend
- `<ClerkProvider publishableKey={...}>` wraps the app in `main.jsx`
- `<SignedIn>` / `<SignedOut>` components gate routes
- `useAuth().getToken()` returns a JWT for backend calls
- `useUser()` provides Clerk's user object

### Backend
- `clerkMiddleware()` populates `req.auth` for every request
- `requireAuth()` rejects unauthenticated calls with 401
- `getUserId(req)` extracts the Clerk ID (handles both old + new Clerk APIs)

### Username flow
On first login the user has no row in our `users` table. `App.jsx` catches the 404 from `/api/users/me` and shows `UsernameSetup.jsx`. They pick a unique username, the backend assigns a random 5-digit `unique_id`, and inserts the row.

The `unique_id` is the fallback identifier for users who pick the same username (case-insensitive). It also enables "find user by either" lookup in `task_validators`, so a user can be assigned as validator by either `@alice` or `12345`.

---

## 8. Database & Storage (Supabase)

### Why service-role on backend
The backend bypasses Row-Level Security because it's already authenticated the user via Clerk. Service-role gives full access; we trust our own backend logic to do the right query (e.g. always filter by `clerk_id`).

### Why anon key on frontend
For the Realtime notification subscription. Supabase's realtime engine respects RLS policies, so the anon client can only see notifications it's authorized to see (in practice we trust client-side filtering for the demo, but RLS would lock this down for production).

### Storage bucket: `taskstaker`
- Public bucket (proof files have public URLs anyone can view)
- Files stored under `proofs/{timestamp}_{random}.{ext}`
- 10MB max per file (enforced by Multer)
- Public URL goes on-chain in `task.proofUrl`

### Realtime
The `notifications` table has Realtime replication enabled. The frontend subscribes to `INSERT` events filtered by `user_id`, so the notification bell updates within ~100ms of the backend inserting a row.

---

## 9. AI Validation (Groq + Gemini)

### Two endpoints

#### `/api/ai/analyze` — structured pass/fail
Accepts task description + proof file + optional notes. Returns:
```json
{
  "passed": true,
  "confidence": 87,
  "analysis": "The screenshot clearly shows...",
  "suggestions": ["Add a timestamp", "..."]
}
```

System prompt instructs the model to return strict JSON. Both providers' SDKs support `response_format: { type: "json_object" }` (Groq) or `responseMimeType: "application/json"` (Gemini).

#### `/api/ai/chat` — conversational
Drives the AIChatbot drawer. Takes message history + the current task description + optional file. Returns plain-text reply. The system prompt explicitly says "no markdown" because rendering markdown inside a chat bubble looks broken.

### Vision support

When the proof is an image (`image/*` MIME):
- Groq: switches to `meta-llama/llama-4-scout-17b-16e-instruct` and embeds the image as a `data:` URL in `image_url` content part
- Gemini: passes `inlineData: { mimeType, data: base64 }` directly

For PDFs / docs: only Gemini handles those natively. The backend doesn't try to OCR — just hands the file to the multimodal model and lets it figure out what it sees.

### Fallback chain
If the configured provider throws, the other one runs. If both fail, returns a graceful default analysis with `passed: false, confidence: 0, analysis: "AI unavailable"`. Validators always retain final say.

---

## 10. Email System (Resend)

### Templates (`backend/src/services/email.js`)

| Function | Trigger | Purpose |
|---|---|---|
| `proofSubmittedEmail` | Owner submits proof | Notify validator that something needs review |
| `taskValidatedEmail` | Validator approves | Tell owner they can claim their stake |
| `deadlineApproachingEmail` | 1hr before deadline | Last-chance reminder with minutes-left countdown |
| `deadlineMissedEmail` | Deadline passed without proof | Inform owner of forfeiture, with motivational closing |

All templates use a dark theme (`#111` background, `#FF3B30` crimson accents) matching the in-app design. Each has a single CTA button that deep-links to `/dashboard`.

### Why bother with the deadline checker?
The 1-hour and missed-deadline emails are the most important UX touchpoints. Most apps that use commitment psychology fail because users forget. A well-timed email is the difference between "oh shit, last 30 min, let me ship" and "oops, lost my stake".

### Resend config
- Free tier: 100 emails/day, 3000/month — plenty for a demo
- `EMAIL_FROM=onboarding@resend.dev` works without verifying a domain (only delivers to your own Resend account email — fine for testing)
- For production: verify a domain, set `EMAIL_FROM=TaskStaker <noreply@yourdomain.com>`

---

## 11. Wallet Modes — Embedded & External

### Embedded wallet (the default UX)

**Goal:** zero MetaMask popups, zero gas fee complexity for the user.

**How:** every Clerk-authenticated user gets a deterministic Sepolia address. The backend holds the private key, derived from `keccak256(WALLET_MASTER_SECRET + clerkId)`.

**Funding:** the user copies their address and grabs free Sepolia ETH from a faucet. The wallet drawer shows the balance live across Sepolia + Base + Polygon.

**Signing:** `createTask`, `claimFunds` are signed server-side with the user's embedded key. Submit/validate go through the relayer.

**Trade-offs:**
- ✅ Frictionless onboarding
- ✅ Truly gasless for users (faucet ETH, no card)
- ❌ Backend custody — operator can spend user funds. Acceptable on testnet
- ❌ Single master secret leak compromises every wallet

### External wallet (for crypto natives)

User connects MetaMask. Same flows, but they sign `createTask` and `claimFunds` themselves. The relayer still handles `submitProof` and `validateTask` — those are status updates that don't move ETH, so why subject the user to a popup?

The frontend Dashboard has logic to auto-detect Sepolia (`isChainSupported`) and prompt to switch networks if wrong.

---

## 12. The Relayer Pattern

This is the single most important UX decision in the project.

### The problem
Every on-chain action normally requires a wallet popup. For a task lifecycle that's:
1. Connect wallet (popup)
2. Switch to Sepolia (popup)
3. Create task (popup)
4. Submit proof (popup)
5. (validator) Validate (popup)
6. Claim funds (popup)

Five MetaMask prompts. Users bail.

### The solution
Designate a backend "relayer" wallet. The contract gives this wallet permission to call `submitProof` and `validateTask` on anyone's behalf:

```solidity
require(msg.sender == task.user || msg.sender == relayer, "Not authorized");
```

The relayer pays gas (negligible on testnet — backend wallet just needs to stay funded). Now:

1. ~~Connect wallet~~ — embedded wallet, automatic
2. ~~Switch network~~ — embedded wallet runs server-side
3. Create task (popup OR embedded sign)
4. Submit proof — **relayer** signs
5. Validate — **relayer** signs (validator doesn't even need a wallet)
6. Claim funds (popup OR embedded sign)

Two popups max, often zero.

### Why not relay claim/create too?
- `createTask` moves user's ETH into the contract. Server-signing this would mean the backend can drain user wallets unprompted. Bad
- `claimFunds` transfers ETH to `msg.sender`. Server-signing this is fine because the backend would receive the funds, not the user. Useless.

These two need user intent and user signature.

### The fallback chain in `submit-proof`
If the relayer fails (e.g. contract was redeployed and the on-chain `relayer` field is stale), the backend tries to sign with the user's embedded wallet as a fallback. Only if that also fails does it return an error. Resilience built in.

---

## 13. UI / UX Decisions

### Colour palette — Obsidian + Crimson
- Backgrounds: `#000` → `#131313` → `#1B1B1B` → `#2C2C2E` (Material 3 tonal hierarchy)
- Primary: `#FF3B30` (Apple-style alert red — connotes "stakes are real")
- Secondary: pure white for high-contrast text
- Tertiary: same crimson, used for success states (Validated, Completed) — red feels "important and earned"
- Error: brighter `#FF453A` for forfeit states

The crimson + black creates urgency without being aggressive. It signals "this is serious" — appropriate for an accountability platform where you can lose money.

### Typography
- Headlines: Space Grotesk (geometric sans, slightly futuristic)
- Body: Manrope (humanist sans, very readable)
- Labels: Space Grotesk uppercase + wide letter-spacing for "system" feel

### Glass panels & blurs
`backdrop-filter: blur(20px)` on the header and modals. Layered radial gradients in the background give the page subtle visual depth without being distracting.

### Animations
- Framer Motion `<AnimatePresence>` on the wallet drawer and hamburger menu — smooth slide-in
- CSS `animate-pulse` on loading spinners using the crimson glow
- `animate-spin` on refresh buttons during fetch
- All transitions go through Tailwind's `transition-all` for consistency

### Form decisions
- Stake input is dual-field: USD ↔ ETH with live conversion at the live ETH price (CoinGecko primary, Binance fallback, 60s cache)
- Deadline is a plain number input — no preset buttons. Forces the user to think about the actual time they need
- Validator field requires explicit "Verify" click before allowing form submission. Stops typo-induced wrong-validator assignment

### Notification bell
Live-updates via Supabase Realtime. Red dot when unread > 0. Clicking opens a dropdown with the last 50 notifications, marks all as read on close.

### Leaderboard lock
Until 5 tasks done, the leaderboard is blurred with an overlay showing progress dots ("Complete 1 more task to unlock"). This creates a goal: do 5 tasks, unlock the social-comparison loop.

---

## 14. Database Schema

```sql
-- Users
CREATE TABLE users (
  id              BIGSERIAL PRIMARY KEY,
  clerk_id        TEXT UNIQUE NOT NULL,
  username        TEXT UNIQUE NOT NULL,
  unique_id       TEXT UNIQUE NOT NULL,    -- 5-digit fallback ID
  wallet_address  TEXT,                    -- nullable; only set when MetaMask is linked
  completed_tasks INT DEFAULT 0,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_wallet ON users(wallet_address);

-- Notifications (also subscribed-to via Realtime)
CREATE TABLE notifications (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,    -- proof_submitted, task_validated, validation_needed,
                                -- deadline_approaching, deadline_missed, funds_claimed
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  task_id     INT,
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notif_user ON notifications(user_id);
CREATE INDEX idx_notif_user_unread ON notifications(user_id, read) WHERE read = FALSE;

-- Validator assignments (off-chain because validators don't need wallets)
CREATE TABLE task_validators (
  task_id            INT PRIMARY KEY,
  validator_user_id  BIGINT REFERENCES users(id),
  owner_user_id      BIGINT REFERENCES users(id),
  validator_username TEXT,
  owner_username     TEXT,
  task_name          TEXT,
  stake_eth          TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_tv_validator ON task_validators(validator_user_id);
CREATE INDEX idx_tv_owner ON task_validators(owner_user_id);

-- AI analyses (cached so the chatbot can reload prior analysis without re-prompting)
CREATE TABLE ai_analyses (
  id          BIGSERIAL PRIMARY KEY,
  task_id     INT NOT NULL,
  analysis    JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_ai_task ON ai_analyses(task_id);
```

### Why `task_validators` lives off-chain
On-chain validator assignment would mean every validator needs a wallet. That defeats the "validators are anyone with a TaskStaker account" goal. Storing in Supabase + having the relayer sign on their behalf keeps things flexible.

### `stake_eth` column
Added later because the contract zeroes `task.stake` on settle. Backend writes this on task creation; frontend has localStorage fallback for the existing tasks before this column was added.

---

## 15. Complete API Reference

All routes prefixed with `/api`. Auth-required routes need `Authorization: Bearer <clerk_jwt>`.

### `/api/users`
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/register` | ✓ | First-time username pick + 5-digit ID assignment |
| POST | `/link-wallet` | ✓ | Bind a MetaMask address to the account |
| GET  | `/resolve/:username` | — | Look up a user by `@username` or 5-digit ID (used during validator search) |
| GET  | `/me` | ✓ | Returns full profile row |

### `/api/tasks`
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/assign-validator` | ✓ | Called by frontend after on-chain `createTask`; writes the validator assignment to Supabase |
| POST | `/submit-proof` | ✓ | Off-chain proof submission; relayer signs `submitProof` |
| POST | `/validate` | ✓ | Off-chain validation; relayer signs `validateTask` |
| GET  | `/assignments?taskIds=0,1,2` | — | Returns map of task_id → {validator, owner usernames + IDs} |
| GET  | `/original-stakes?taskIds=0,1,2` | — | Backup endpoint to recover original stakes from chain events |

### `/api/wallet`
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET  | `/info` | ✓ | Embedded wallet address + Sepolia ETH balance |
| GET  | `/balances?chains=sepolia,base,polygon` | ✓ | Multi-chain native + ERC-20 balances |
| POST | `/create-task` | ✓ | Backend signs `createTask` with embedded wallet |
| POST | `/claim` | ✓ | Backend signs `claimFunds` with embedded wallet |

### `/api/ai`
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/analyze` | ✓ | One-shot structured analysis (multipart, file optional) |
| POST | `/chat` | ✓ | Conversational chatbot (multipart, file optional) |
| GET  | `/analysis/:taskId` | — | Latest cached analysis for a task |

### `/api/upload`
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/` | ✓ | `multipart/form-data` with `file` field; returns Supabase public URL |

### `/api/notifications`
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET   | `/` | ✓ | Last 50 notifications for current user |
| GET   | `/unread-count` | ✓ | Just the count, for the bell badge |
| PATCH | `/:id/read` | ✓ | Mark one as read |
| PATCH | `/read-all` | ✓ | Mark all as read (bell-close handler) |

### `/api/leaderboard`
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/` | — | Top 50 by `completed_tasks DESC` |

### Top-level (in `index.js`)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | — | `{ status: "ok", timestamp }` |
| GET | `/api/config` | — | Public relayer + contract addresses |
| GET | `/api/price/eth` | — | ETH/USD with 60s cache; CoinGecko primary, Binance fallback |
| GET | `/api/debug/deadline-check` | — | Manually trigger the deadline checker (dev convenience) |

---

## 16. Deployment Guide

### Smart Contract
```bash
cd contract
# Set in contract/.env: PRIVATE_KEY, RELAYER_ADDRESS, SEPOLIA_RPC_URL
npx hardhat compile
npx hardhat run --network sepolia scripts/deploy.js
# Note the deployed address; copy ABI to ../frontend/src/abis/ and ../backend/abi/
```

### Backend (production)
- Recommended: Railway, Render, Fly.io, or any Node-friendly host
- The deadline checker is a stateful long-running process — make sure your platform doesn't aggressively scale to zero
- Set all `backend/.env` variables in the host's environment config
- Health check: `GET /api/health`

### Frontend
- `npm run build` → static `dist/` folder
- Deploy to Vercel, Netlify, Cloudflare Pages
- Set `VITE_*` env variables in the host's project settings
- After deploy, set `FRONTEND_URL` in the backend env to the production URL (used for email CTAs and CORS)

### Supabase
- Create a project (free tier)
- Run the schema in [Section 14](#14-database-schema)
- Create a Storage bucket named `taskstaker` (public)
- Enable Realtime on the `notifications` table

### Clerk
- Create an application
- Configure sign-in methods: Google + email + phone (or whichever)
- Copy publishable + secret keys to env files
- Add your production frontend URL to Clerk's allowed origins

### Resend
- Create account, get API key
- For testing: use `onboarding@resend.dev` (only sends to your account email)
- For production: verify a domain via DNS, set `EMAIL_FROM=TaskStaker <noreply@yourdomain.com>`

---

## 17. Real-World Use Cases & Proof Examples

The platform is genuinely useful for any commitment where you'd otherwise procrastinate. Here are concrete scenarios with proof types that work well.

### Personal productivity

**Task:** "Finish my online course module 5 by Sunday"
- Stake: 0.005 ETH (~$10), 7-day deadline
- Validator: study buddy
- **Proof:** screenshot of the course platform showing module 5 marked complete, with completion date visible

**Task:** "Wake up at 6 AM every day this week"
- Stake: 0.01 ETH (~$20), 7-day deadline
- Validator: roommate
- **Proof:** 7 photos timestamped at 6:xx AM each day, or a screenshot of an alarm-tracking app like Sleep Cycle

### Fitness

**Task:** "Run 5km every morning for 14 days"
- Stake: 0.02 ETH (~$40), 14-day deadline
- Validator: running partner
- **Proof:** Strava activity feed screenshot showing 14 runs, or a single composite image with all the runs visible

**Task:** "Hit the gym 4× this week"
- Stake: 0.005 ETH, 7-day deadline
- Validator: trainer
- **Proof:** gym entry-card timestamps, or selfies in the gym mirror with timestamps

### Career / Learning

**Task:** "Apply to 10 jobs by Friday"
- Stake: 0.01 ETH, 5-day deadline
- Validator: career coach friend
- **Proof:** screenshot of LinkedIn / Indeed application history showing 10 applications

**Task:** "Solve 30 LeetCode problems this month"
- Stake: 0.03 ETH, 30-day deadline
- Validator: study group leader
- **Proof:** LeetCode profile page screenshot showing the count

**Task:** "Read 'Atomic Habits' cover to cover"
- Stake: 0.005 ETH, 21-day deadline
- Validator: book club friend
- **Proof:** photo of yourself holding the book at the last page, plus a 200-word summary in the proof notes

### Creative

**Task:** "Ship a side project landing page"
- Stake: 0.05 ETH, 14-day deadline
- Validator: dev mentor
- **Proof:** live URL + screenshot. Validator can click through and verify

**Task:** "Write 3 blog posts this month"
- Stake: 0.015 ETH, 30-day deadline
- Validator: writing partner
- **Proof:** 3 published URLs in the proof notes, screenshots of each

**Task:** "Record and upload 5 YouTube videos"
- Stake: 0.025 ETH, 30-day deadline
- Validator: subscriber friend
- **Proof:** YouTube channel page showing 5 new videos with publish dates

### Habits / Lifestyle

**Task:** "No social media for 30 days"
- Stake: 0.05 ETH, 30-day deadline
- Validator: significant other
- **Proof:** Screen Time / Digital Wellbeing report showing zero usage of designated apps

**Task:** "Cook dinner at home 5 nights a week"
- Stake: 0.01 ETH, 7-day deadline
- Validator: family member
- **Proof:** 5 photos of home-cooked meals with timestamps

**Task:** "Meditate for 10 min every day"
- Stake: 0.005 ETH, 14-day deadline
- Validator: meditation buddy
- **Proof:** Headspace / Calm app stats screen showing the streak

### Why these proofs work
Good proofs are:
- **Visual** (screenshots, photos) — AI can analyze; humans can verify in seconds
- **Timestamped** — establishes that work happened in the deadline window
- **Specific to the task** — the AI is asked to match the proof against the task description
- **Easy for the validator to check** — friends won't review 50-page documents

### Why some proofs fail
- "Trust me bro" text-only proofs — AI rejects, validator should too
- Stock images / screenshots not personalized
- Proofs that don't match the task ("ran 5km" with a screenshot of a different app)
- Files behind auth (validator can't open them)

### How to set yourself up to win
1. **Pick proof types in advance.** Tell yourself "for this task I'll take a screenshot of X"
2. **Pick the right validator.** Someone who actually checks. A friend who'll rubber-stamp anything makes the staking pointless
3. **Realistic deadlines.** The whole system breaks if you give yourself 1 hour for a 10-hour task
4. **Stake what hurts.** Too small = no urgency. Too big = you panic and quit. Sweet spot is "enough to be uncomfortable but not catastrophic"

The point isn't to get your stake back. It's to use the loss aversion to actually do the thing.
