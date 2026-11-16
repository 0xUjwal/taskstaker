# TaskStaker

> Stake ETH on what you say you'll do. Get it back when you prove it. Lose it when you don't.

TaskStaker is a Web3 accountability platform where users put real money on the line to commit to tasks. A user creates a task, stakes ETH, picks a validator (a real person), uploads proof when done, and either gets the stake back after validation — or forfeits it on a missed deadline. AI assistance helps both sides judge if proof is sufficient.

Built as an end-to-end production-grade demo combining Solidity, React, Node.js, Supabase, Clerk, blockchain event listeners, AI vision models, and a custodial wallet system.

---

## Table of Contents

- [Live Stack](#live-stack)
- [What's in the box](#whats-in-the-box)
- [Architecture at a glance](#architecture-at-a-glance)
- [Quick Start](#quick-start)
- [Environment variables](#environment-variables)
- [Database setup](#database-setup)
- [Common workflows](#common-workflows)
- [Deeper documentation](#deeper-documentation)

---

## Live Stack

| Layer | Technology |
|---|---|
| **Smart Contract** | Solidity 0.8.19, Hardhat, deployed on Sepolia testnet |
| **Frontend** | React 18 + Vite, TailwindCSS, React Router 7, Framer Motion, Ethers.js v5 |
| **Backend** | Node.js + Express, Ethers.js v5, Multer, Resend |
| **Auth** | Clerk (Google + email + phone) |
| **Database & Storage** | Supabase (PostgreSQL + Storage + Realtime) |
| **AI** | Groq (Llama 3.3 70B + Llama 4 Scout vision) with Gemini 2.5 Flash fallback |
| **Email** | Resend (deadline reminders + transactional notifications) |

---

## What's in the box

- **Two wallet modes**
  - **Embedded wallet** — backend custodially derives an ETH wallet per user from their Clerk ID. Zero MetaMask popups for everyday actions.
  - **External wallet** — connect MetaMask, sign your own transactions.

- **Relayer pattern** — backend signs `submitProof` and `validateTask` on behalf of users, removing wallet popups for those flows. Only `createTask` and `claimFunds` ever require a user signature, and only in MetaMask mode.

- **Validator system** — every task has an assigned human validator (any TaskStaker user). Validators don't even need a wallet; the backend relayer signs validation on their behalf.

- **AI-assisted validation** — the chatbot drawer reads the task description and proof file (image/PDF/text), then provides a structured pass/fail recommendation. Validators stay in control; AI only advises.

- **Email + in-app notifications** — Supabase Realtime pushes a live notification feed; Resend sends emails for proof-submitted, task-validated, deadline-approaching (1 hour out), and deadline-missed events.

- **Leaderboard** — locked until the user completes 5 tasks; ranks all users by completion count.

- **Auto-refresh task list** — tasks reload every 7 seconds and after every create/claim/validate action.

---

## Architecture at a glance

```
                                     ┌──────────────────────────┐
   ┌────────┐    HTTPS               │  Backend (Express)       │
   │ React  │◄────────────►          │                          │
   │ Vite   │                        │  ┌─ /api/users           │
   │  (UI)  │   ◄ Realtime ───┐      │  ├─ /api/tasks           │
   └────┬───┘                  │     │  ├─ /api/wallet          │
        │ ethers.js            │     │  ├─ /api/ai              │
        ▼                      │     │  ├─ /api/upload          │
  ┌──────────┐                 │     │  ├─ /api/notifications   │
  │ MetaMask │                 │     │  └─ /api/leaderboard     │
  └────┬─────┘                 │     │                          │
       │                       │     │  Relayer wallet (signs   │
       ▼                       │     │  on behalf of users)     │
  ┌──────────────┐             │     │                          │
  │   Sepolia    │ ◄───events──┴─────┤  Event listener +        │
  │ TaskStakerV2 │                   │  deadline checker (5min) │
  └──────────────┘                   └──────────┬───────────────┘
                                                │
                  ┌─────────────────────────────┼─────────────┐
                  ▼                             ▼             ▼
            ┌───────────┐                ┌───────────┐  ┌─────────┐
            │ Supabase  │                │   Clerk   │  │  Groq/  │
            │ Postgres  │                │  (Auth)   │  │ Gemini  │
            │ Storage   │                └───────────┘  │  + AI   │
            │ Realtime  │                               └─────────┘
            └───────────┘
```

For deeper technical detail, see [`ARCHITECTURE.md`](./ARCHITECTURE.md).

---

## Quick Start

### Prerequisites

- Node.js 18+
- A free [Clerk](https://clerk.com), [Supabase](https://supabase.com), [Groq](https://console.groq.com), [Resend](https://resend.com), and [Alchemy](https://alchemy.com) account
- (Optional) MetaMask for the external-wallet flow

### 1. Clone & install

```bash
git clone <repo>
cd taskstaker
cd contract  && npm install
cd ../backend && npm install
cd ../frontend && npm install
```

### 2. Deploy the smart contract

```bash
cd contract
# Set PRIVATE_KEY (deployer wallet, funded with Sepolia ETH) and RELAYER_ADDRESS in contract/.env
# Get free Sepolia ETH from https://www.alchemy.com/faucets/ethereum-sepolia
npx hardhat run --network sepolia scripts/deploy.js
```

Copy the deployed address into both `frontend/.env` (`VITE_CONTRACT_ADDRESS`) and `backend/.env` (`CONTRACT_ADDRESS`).

Copy the compiled ABI too:
```bash
# Frontend ABI
cp artifacts/contracts/TaskStakerV2.sol/TaskStakerV2.json ../frontend/src/abis/
# Backend ABI
mkdir -p ../backend/abi && cp artifacts/contracts/TaskStakerV2.sol/TaskStakerV2.json ../backend/abi/
```

### 3. Run the database migration

In the Supabase SQL editor, run the schema in [`ARCHITECTURE.md`](./ARCHITECTURE.md#database-schema). At minimum:

```sql
-- See ARCHITECTURE.md for the full schema with all columns and indexes
CREATE TABLE users (...);
CREATE TABLE notifications (...);
CREATE TABLE task_validators (...);
CREATE TABLE ai_analyses (...);
```

Create a public Storage bucket named `taskstaker` for proof uploads.

### 4. Boot all three services

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Visit `http://localhost:5173`.

---

## Environment variables

### `contract/.env`
```bash
PRIVATE_KEY=<deployer wallet private key>
RELAYER_ADDRESS=<address of the relayer wallet (passed to constructor)>
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<your-key>
```

### `backend/.env`
```bash
# Clerk
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=<service-role key, NOT anon>

# AI
AI_PROVIDER=groq
GROQ_API_KEY=gsk_...
GEMINI_API_KEY=AIzaSy...

# Blockchain
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<your-key>
CONTRACT_ADDRESS=0x...
RELAYER_ADDRESS=0x...
RELAYER_PRIVATE_KEY=0x...

# Email (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM=onboarding@resend.dev   # or a verified domain

# Embedded wallet derivation
WALLET_MASTER_SECRET=<32 random bytes hex — TREAT LIKE A MASTER PRIVATE KEY>

# Server
PORT=3001
FRONTEND_URL=http://localhost:5173
```

### `frontend/.env`
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key, NOT service-role>
VITE_API_URL=http://localhost:3001
VITE_CONTRACT_ADDRESS=0x...
VITE_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/<your-key>
VITE_SEPOLIA_FALLBACK_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
```

---

## Database setup

Run this in your Supabase SQL editor:

```sql
-- Users
CREATE TABLE users (
  id            BIGSERIAL PRIMARY KEY,
  clerk_id      TEXT UNIQUE NOT NULL,
  username      TEXT UNIQUE NOT NULL,
  unique_id     TEXT UNIQUE NOT NULL,
  wallet_address TEXT,
  completed_tasks INT DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_users_wallet ON users(wallet_address);

-- Notifications
CREATE TABLE notifications (
  id          BIGSERIAL PRIMARY KEY,
  user_id     BIGINT REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  task_id     INT,
  read        BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_notif_user ON notifications(user_id);

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

-- AI analyses
CREATE TABLE ai_analyses (
  id          BIGSERIAL PRIMARY KEY,
  task_id     INT NOT NULL,
  analysis    JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

Then **enable Realtime** on the `notifications` table (Database → Replication in the Supabase dashboard) so the bell updates live.

---

## Common workflows

### Embedded wallet (the default, zero MetaMask popups)
1. Sign in with Clerk → backend derives a deterministic Sepolia wallet from your Clerk ID
2. Fund it from the wallet drawer (faucet link)
3. Create a task → backend signs `createTask` with your embedded key
4. Submit proof → relayer signs `submitProof`
5. Validator validates → relayer signs `validateTask`
6. Claim → backend signs `claimFunds` with your embedded key
7. ETH lands back in your embedded wallet

### External wallet (MetaMask)
Same flow, but you sign `createTask` and `claimFunds` yourself.

### As a validator
1. Get assigned by a friend (they enter your `@username` when creating a task)
2. Get notified via email + in-app bell when proof is uploaded
3. Open AI Chatbot drawer → ask questions about the proof
4. Click "Validate Task" — backend relayer signs on your behalf

---

## Verification & tests

The smart contract has a full Hardhat test suite covering task creation, proof submission, validation, claims, forfeits, deadline enforcement, relayer permissions, and edge cases.

```bash
cd contract
npx hardhat compile
npx hardhat test
```

Current status: **31/31 tests passing** against `TaskStakerV2.sol`.

Frontend production build:

```bash
cd frontend
npm run build
```

---

## Deeper documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — full system design, every file explained, smart contract walkthrough, every API route, every database table, deployment guide, real-world use cases with example proofs

---

## License

MIT
