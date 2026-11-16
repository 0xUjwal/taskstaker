# TASKSTAKER: A DECENTRALIZED AI-POWERED TASK ACCOUNTABILITY PLATFORM
## Major Project Phase-II [22IS81]
### Department of Information Science & Engineering, DSCE
### Academic Year 2025-26

---

**Submitted by:**
- SANJAY K N, 1DS22IS129
- UJWAL KUMAR B R, 1DS22IS174
- DEERAJ GANESH M, 1DS23IS404
- VILESH RAJATH G V, 1DS23IS417

**Under the Guidance of:**
Mr. Irshad Khan, Assistant Professor, Dept. of ISE, DSCE, Bengaluru

---

## ABSTRACT

Sticking to commitments is genuinely hard, especially when there is no real consequence for failure. Apps like to-do lists, habit trackers, and calendar reminders are useful in theory, but they share a common problem, they can be ignored without any meaningful cost. TaskStaker was built around a simple but powerful idea: if a person puts actual money on the line, they are much more likely to follow through.

The platform works on the Sepolia Ethereum testnet and allows users to stake cryptocurrency against self-defined tasks. Every task must have a deadline and a human validator, someone the user trusts to honestly assess whether the work was completed. When the deadline arrives, either the user has submitted verifiable proof and the validator approves it, or the stake is forfeited permanently. There is no grey area.

What makes this more than a basic blockchain app is the infrastructure built around it. Authentication is handled through Clerk, which supports Google sign-in, email, and phone, removing the usual friction of wallet-based login. Each user is assigned a backend-managed embedded wallet, derived deterministically from their account identity, meaning they can create and claim tasks without ever touching MetaMask. A backend relayer wallet handles the proof submission and validation transactions on behalf of users, further reducing the number of popups and confirmations. Proof files are uploaded to Supabase Storage and the URL is recorded on-chain.

Two AI providers, Groq running Llama models and Google Gemini, power an analysis chatbot that validators and task owners can consult before making decisions. Notifications arrive in real time via Supabase Realtime subscriptions, and deadline reminder emails are dispatched automatically through Resend. A leaderboard, unlocked only after completing five tasks, adds a social layer to the experience.

**Keywords:** Blockchain, Smart Contracts, AI Validation, Accountability System, Sepolia Testnet, Embedded Wallet, Relayer Pattern, Supabase, Clerk Authentication.

---

## 1. INTRODUCTION

### 1.1 Overview

There is a well-documented gap between intentions and follow-through. People set goals, break them into tasks, and then quietly abandon them, not because the tasks were impossible, but because failing to complete them carries no real cost. Productivity research consistently shows that commitment devices, especially those involving financial stakes, dramatically improve completion rates compared to systems built purely on willpower or social expectation.

TaskStaker attempts to close that gap. It is a web application deployed on the Sepolia Ethereum testnet where users create tasks, specify deadlines, assign a trusted validator from their network, and stake a small amount of ETH. The ETH is locked in a Solidity smart contract until one of two outcomes occurs: either the user submits proof before the deadline and the validator approves it, releasing the stake back to the user; or the deadline passes without a completed, validated proof, and the stake is permanently forfeited to the contract. No admin can override this. The contract executes automatically.

The application was deliberately built with low technical barriers. Most blockchain applications demand that users understand wallets, gas fees, and private keys from the very first interaction. TaskStaker instead creates a backend-managed custodial wallet for every Clerk-authenticated user, derived from their account identity using a deterministic key generation process. Users can stake, submit proof, and claim funds without ever opening MetaMask. Those who do want to use their own wallet can connect MetaMask for an external-wallet flow. Both paths coexist.

On the validation side, a backend relayer wallet signs the `submitProof` and `validateTask` transactions on behalf of users. The assigned validator, who might be a study partner, a colleague, or a mentor, never needs a cryptocurrency wallet at all. They receive an email notification, review the proof in the app, optionally consult the AI chatbot, and click validate. The relayer handles the rest.

### 1.2 Problem Statement

Existing task management and accountability platforms, whether Habitica, Beeminder, or any of the dozens of goal-tracking apps, share a structural weakness: completion is ultimately self-reported. A user can mark a task as done without having done it, and the platform has no reliable mechanism to challenge that. Some platforms introduce real financial stakes, Beeminder charges users who miss commitments, but the verification is still manual and centralized, meaning disputes are resolved by a company rather than by code.

Blockchain-based accountability is a cleaner idea in principle, but purely on-chain systems present a different problem: every interaction requires a wallet transaction, validators need to be wallet addresses, and the friction drives users away before they experience any value. Pure AI verification systems, meanwhile, suffer from hallucinations and context errors when used without human oversight.

The core question this project tries to answer is: can a system enforce real task completion with minimal friction, trustless financial consequences, and reliable dual verification (AI-assisted plus human) without requiring every participant to be a crypto-native user?

### 1.3 Objectives

1. Design and deploy a Solidity smart contract on Sepolia that enforces stake locking, deadline checking, proof submission, validation, and fund settlement without relying on any centralized administrator.

2. Implement a backend-managed embedded wallet system so that authenticated users can create tasks, submit proof, and claim funds entirely without MetaMask popups.

3. Build a relayer wallet mechanism that signs `submitProof` and `validateTask` transactions on behalf of users, eliminating wallet requirements for validators entirely.

4. Integrate two AI providers, Groq (with Llama 3.3 70B and Llama 4 Scout for vision) and Google Gemini 2.5 Flash, with automatic fallback so proof analysis is always available even when one provider is unavailable.

5. Build a realtime notification system using Supabase's websocket-based subscription so that validators receive instant in-app alerts when proof is submitted.

6. Implement automated deadline email notifications through Resend: a one-hour warning before expiry and a forfeiture confirmation after the deadline passes.

7. Deploy a full-stack application with Clerk authentication supporting Google, email, and phone sign-in, so that no blockchain knowledge is required to create an account.

### 1.4 Motivation

Several things made this project feel worth building. The first was a genuine frustration with personal productivity tools that require nothing of the user. An app that sends reminders is, at best, annoying. An app that costs you money when you fail is something you pay attention to.

The second was a technical curiosity about the relayer pattern in blockchain development. Most introductory dApp tutorials show every action going through MetaMask. In practice, this creates terrible user experiences. The relayer pattern, where a trusted backend wallet signs certain transactions on behalf of users, is widely used in production but rarely demonstrated in a complete, working system. Building TaskStaker was partly an exercise in understanding this pattern end-to-end.

The third motivation was integrating AI in a role where it genuinely helps rather than replaces human judgment. Validators are real people who make the final call. The AI chatbot is there to surface analysis, ask questions about the proof, and flag concerns, but it does not approve or reject tasks on its own. That felt like the right balance.

Finally, the combination of Clerk, Supabase, Groq, and a Solidity contract on Sepolia turned out to be a genuinely interesting stack. Each service fills a specific gap, and understanding how they interact under real conditions, including failures, rate limits, and edge cases, was a valuable learning outcome in itself.

### 1.5 Outline of the Report

Chapter 2 reviews existing accountability platforms and blockchain-based commitment systems, identifying the gaps this project addresses. Chapter 3 describes the system architecture, hardware and software requirements, and key design diagrams including the data flow and use case views. Chapter 4 covers the implementation details, the smart contract, embedded wallet derivation, relayer pattern, AI integration, and frontend architecture. Chapter 5 presents testing results from both black-box and white-box perspectives. Chapter 6 discusses experimental outcomes and performance observations. Chapter 7 concludes with a summary of what was achieved and what future iterations might include.

---

## 2. LITERATURE SURVEY

### 2.1 Review of Existing Systems

Several platforms and research works directly relate to the problem TaskStaker addresses. The table below summarises ten key papers and platforms, their methods, and why they fall short of what this project needed.

| No. | Author / Platform | Title / System | Method Used | Advantage | Disadvantage |
|---|---|---|---|---|---|
| [1] | Beeminder (2011) | Goal-tracking with financial stakes | Integrates with fitness/habit APIs; charges users on miss | Real financial consequences; integrations reduce self-reporting | Verification is still self-reported for goals without API; company can override outcomes; centralized |
| [2] | Habitica | RPG-based habit and task tracker | Gamification; HP loss on task failure | Engaging UX; social accountability through guilds | Consequences are fictional; entirely self-reported; no financial stakes |
| [3] | StickK | Commitment contracts with human referee | Named referee reviews completion; optional anti-charity forfeit | Human verification similar to TaskStaker's validator | Centralized; no cryptographic proof; biased referees can alter outcomes |
| [4] | Hassan et al. (2023) | Blockchain-Based Reputation and Incentive Mechanisms: A Survey — IEEE Trans. Netw. Serv. Manag. | Literature synthesis of stake-reward and reputation models | Shows financial staking outperforms reputation-only systems; hybrid models with named validators work best | Survey only; does not provide AI-assisted or multimodal proof verification |
| [5] | Khan and Salah (2021) | Blockchain for Proof-of-Work Accountability — J. Blockchain Res. | Solidity smart contracts with timestamped immutable checkpoints | Tamper-proof action logs; on-chain enforcement | Self-reported confirmations; no intelligent validation layer |
| [6] | Zhang and Lee (2022) | AI-Powered Smart Contract Verification — IEEE Access | ML-based static and dynamic vulnerability analysis of contract code | Improves reliability of contract deployment | Focused on contract code bugs, not user task accountability or evidence verification |
| [7] | Yan and Shao (2025) | Multimodal Task Validation: Integrating AI and Blockchain — J. Adv. Inf. Technol. | Confidence-score framework combining image analysis with on-chain enforcement | Improved proof evaluation across text and image inputs | No embedded wallet or relayer pattern; validators require crypto wallets |
| [8] | Ji et al. (2023) | Survey on Hallucination in Natural Language Generation — ACM Comput. Surv. | Systematic review of LLM hallucination types and mitigation strategies | Documents the risks of trusting AI outputs without human validation safeguards | Survey work; does not propose a deployment-ready verification system |
| [9] | Nabben and De Filippi (2024) | Accountability Protocols in Blockchain Governance — Internet Policy Rev. | Policy and protocol analysis for decentralized validator accountability | Useful governance models for transparent, auditable decision-making | Focused on governance theory; lacks implementation-level integration with AI or financial staking |
| [10] | Yi (2025) | A Multi-Agent Framework for Decentralized Proof Verification — IEEE Trans. Artif. Intell. | Distributed AI agents collaborating to verify proof submissions | Improved accuracy through distributed reasoning; reduces single-point AI failure | Financial staking mechanism absent; no usable interface for non-technical validators |

**Table 2.1 Review of Existing Systems**

The common thread across these works is that no single system combines all four of: enforceable financial consequences enforced by code, human-in-the-loop final approval, AI-assisted proof analysis with vision support, and a user experience that does not require a crypto wallet from every participant.

### 2.2 Limitations of Existing Systems

Looking at the table above, three distinct failure modes emerge across existing approaches.

The first is centralization. Beeminder and StickK both route stakes through a company. A company employee can reverse a decision, platform policies can change overnight, and the stakes sit in a corporate account rather than a tamper-proof smart contract. Users extend trust to an organization, not to verifiable code.

The second is usability failure in blockchain systems. Token-weighted community verification (as used by some commitment protocols on Ethereum) creates plutocratic dynamics where large token holders dominate outcomes. More fundamentally, requiring validators to hold a native token or connect a MetaMask wallet before they can review a proof eliminates most potential validators immediately.

The third is reliability failure in AI-only systems. As Ji et al. [8] documented in detail, large language models produce confident-sounding but incorrect outputs — they hallucinate dates, misread context, and can be manipulated by staged photographs. An AI that autonomously triggers financial settlement creates a system that adversarial users will specifically target. Confidence scores need human review, not just a threshold comparison.

### 2.3 Gap Identification and Analysis

After reviewing the ten works above, the gap is clear: no existing deployed system combines blockchain-enforced financial consequences with human validator oversight, AI-assisted proof analysis that handles both text and images, and a user interface that works for participants who have never interacted with a blockchain.

More specifically, none of the systems reviewed:
- Provide a server-side embedded wallet so users can stake ETH without MetaMask
- Use a relayer pattern to let validators sign nothing at all
- Run two AI inference providers with transparent automatic failover
- Push realtime in-app notifications to the validator within milliseconds of proof upload
- Send automated deadline reminder emails one hour before expiry

TaskStaker was built to address all five of these gaps simultaneously within a single deployable application.

### 2.4 Research Methodology for the Proposed System

The development followed an iterative approach grounded in progressive integration. The smart contract was written first and tested on a local Hardhat node before any backend code was written. Once the contract behavior was verified locally, it was deployed to Sepolia. The backend API routes were built next, each tested independently with HTTP clients before frontend integration began. The frontend was developed in parallel using mock API responses until the real endpoints were stable enough to connect.

Key technical decisions were made based on direct measurement rather than assumption. The choice to use Clerk over Supabase Auth came from comparing setup time and JWT handling in Express. The relayer pattern decision to make submitProof fire-and-forget came from observing that tx.wait() on Sepolia consistently adds 12 to 25 seconds to the HTTP response, which made the interface feel broken to test users. The dual-AI provider architecture came from experiencing Groq rate limits during testing and wanting the system to stay functional without any manual intervention during an outage.

---

## 3. REQUIREMENT ANALYSIS AND DESIGN

### 3.1 Hardware Requirements

| Component | Minimum | Recommended |
|---|---|---|
| Processor | Intel Core i5 / AMD Ryzen 5 | Intel Core i7 / Apple M2 |
| RAM | 8 GB | 16 GB |
| Storage | 256 GB SSD | 512 GB SSD |
| GPU | Integrated sufficient | Dedicated (for local testing) |
| Network | Stable broadband | High-speed broadband |

### 3.2 Software Requirements

| Category | Tools / Technologies |
|---|---|
| Programming Languages | Solidity 0.8.19, JavaScript (ES2022), Node.js |
| Smart Contract Framework | Hardhat 2.19 |
| Frontend | React 18, Vite 5, TailwindCSS 3.3, React Router 7, Framer Motion |
| Backend | Express.js 4.21, Multer, Dotenv |
| Authentication | Clerk (React SDK + Express SDK) |
| Database & Storage | Supabase (PostgreSQL, Storage, Realtime) |
| Blockchain Interaction | Ethers.js v5 |
| AI Providers | Groq SDK (Llama 3.3 70B, Llama 4 Scout), Google Generative AI SDK (Gemini 2.5 Flash) |
| Email | Resend API |
| Version Control | Git, GitHub |
| Deployment | Vercel (frontend), Render/Railway (backend), Sepolia testnet (contract) |

### 3.3 System Architecture

The system is organized into three independently deployable services:

**Frontend (React + Vite)**, A single-page application running in the user's browser. It communicates with the backend API for all authenticated operations, with the Sepolia blockchain directly (via Ethers.js) only when the user opts to use MetaMask, and with Supabase directly via the anon key for the realtime notification subscription.

**Backend (Express.js)**, A stateless Node.js API server. It holds the relayer private key and the embedded wallet master secret, handles Clerk JWT verification on every authenticated route, manages Supabase operations with the service-role key, calls the AI providers, sends emails via Resend, and listens to blockchain events via an Ethers.js contract listener running in the same process.

**Smart Contract (Solidity on Sepolia)**, `TaskStakerV2.sol` manages all on-chain state: the `tasks[]` array, each task's `stake`, `deadline`, `completed`, `validated`, and `claimed` flags, and the `relayer` address that is authorized to call `submitProof` and `validateTask` on behalf of users.

The three services interact as follows: a user's browser calls the backend API, the backend either calls Supabase or the Sepolia RPC, and events on the Sepolia contract trigger the backend event listener, which writes notifications to Supabase, which are then pushed to the browser via the Supabase Realtime connection.

### 3.4 UML Diagrams

**Data Flow Diagram (Level 1):**

The primary data flow begins when a user authenticates via Clerk. On first login, the backend assigns a username and registers the user in the Supabase `users` table. The user fills in the task creation form, task name, deadline in hours, stake amount, and validator username. Depending on the wallet mode, either the backend signs the `createTask` transaction using the embedded wallet or the user signs it via MetaMask. The transaction is broadcast to Sepolia. The backend's event listener catches the `TaskCreated` event and writes a validation assignment to the `task_validators` table. The validator receives an email.

When the user submits proof, they upload a file through the frontend. The file goes to Supabase Storage via the backend upload route, returning a public URL. The backend calls the relayer to broadcast `submitProof(taskId, proofUrl)` to the Sepolia contract. The validator is notified via Supabase notification row insertion, which triggers a Realtime push to the validator's browser session and simultaneously triggers a Resend email.

The validator opens the AI chatbot if desired, consults the analysis, then clicks validate. The backend relayer broadcasts `validateTask(taskId)`. The task owner receives notification. The owner then claims their stake, which is the only transaction requiring a user-owned signature, either MetaMask or the embedded wallet.

**Use Case Diagram:**

Primary actors are the Task Owner, the Validator, and the Backend Relayer (system actor).

Task Owner use cases: register account, fund embedded wallet, create task, submit proof, claim stake, view task history, consult AI chatbot, view leaderboard.

Validator use cases: receive assignment notification, review submitted proof, consult AI chatbot, validate task.

Backend Relayer (system): sign `submitProof`, sign `validateTask`, check deadlines every 5 minutes, send deadline emails.

**Sequence Diagram:**

1. User signs in via Clerk â†’ `POST /api/users/me` â†’ if 404, show UsernameSetup
2. User fills task form â†’ `POST /api/wallet/create-task` (embedded) or MetaMask `createTask()` call
3. Backend: broadcast `createTask` â†’ return txHash â†’ background: await block, write `task_validators`, send validator email
4. User uploads proof â†’ `POST /api/upload` â†’ `POST /api/tasks/submit-proof`
5. Backend: relayer broadcasts `submitProof` â†’ fire-and-forget â†’ respond 200 â†’ background: write notification, send validator email
6. Validator: receives bell notification â†’ opens task â†’ optionally opens AI chatbot â†’ clicks Validate â†’ `POST /api/tasks/validate`
7. Backend: relayer broadcasts `validateTask` â†’ respond 200 â†’ background: write owner notification, send validated email
8. Owner: sees Validated status â†’ clicks Claim â†’ `POST /api/wallet/claim` or MetaMask `claimFunds()`

### 3.5 Proposed Algorithms and Techniques

**Embedded Wallet Derivation:**
```
wallet_private_key = keccak256(MASTER_SECRET + ":" + clerk_user_id)
wallet = new Wallet(wallet_private_key)
```
The same Clerk ID always produces the same private key. This means the system is stateless, the wallet is never stored, only derived on demand. The security assumption is that `MASTER_SECRET` remains confidential on the server.

**Relayer Fire-and-Forget Pattern:**
```
tx = await contract.submitProof(taskId, proofUrl, { gasLimit: 200000 })
tx.wait().catch(err => log(err))   // fire and forget
return { txHash: tx.hash }         // respond immediately
```
By not awaiting block confirmation, the HTTP response latency drops from 15-25 seconds to roughly 1-2 seconds. The trade-off is that the transaction might fail after the HTTP response has already returned 200, so the UI must handle cases where proof status does not update immediately.

**Dual-AI Provider with Fallback:**
```
try:
    result = analyze_with_groq(proof_data)
except:
    result = analyze_with_gemini(proof_data)   // automatic fallback
```
Groq's Llama 3.3 70B handles text-only proofs. When an image is attached, Groq switches to Llama 4 Scout (vision-capable). Gemini 2.5 Flash handles all modalities natively. The AI returns structured JSON with `{ passed, confidence, analysis, suggestions }`.

**Deadline Checker Interval:**
The backend runs `setInterval(runCheck, 5 * 60 * 1000)` on startup. `runCheck` iterates every on-chain task, checks its deadline and completion flags, and inserts `deadline_approaching` or `deadline_missed` notification rows (deduplicated by checking if the row already exists before inserting). Corresponding Resend emails are dispatched immediately after insertion.

---

## 4. IMPLEMENTATION

### 4.1 Description of Data Collection and Handling

User data enters the system at three points. First, Clerk captures authentication credentials (email, Google account, or phone number) and issues JWTs that the backend verifies on every protected route. The backend never sees passwords, Clerk handles the entire credential lifecycle.

Second, users create task records by filling in the task form. Task name, deadline, and stake amount are encoded in the Ethereum transaction calldata and stored permanently on the Sepolia blockchain. The validator assignment (validator username, owner username, task name) is stored off-chain in the `task_validators` Supabase table because validators do not need to be identified by wallet address.

Third, proof files submitted by users are uploaded via `multipart/form-data` to the backend, which streams them to Supabase Storage in the `taskstaker` bucket. Files are named with a timestamp and random hex string to avoid collisions. The public URL returned by Supabase is then sent on-chain as the `proofUrl` parameter in `submitProof`. This keeps large binary files off the blockchain while preserving a tamper-evident reference.

All AI analysis results are stored in the `ai_analyses` Supabase table with the associated `task_id` so that repeated chatbot sessions can load prior analysis rather than re-running inference.

### 4.2 Tech Stack

**Solidity + Hardhat (Contract Layer):**
`TaskStakerV2.sol` (318 lines) defines the `Task` struct and the five public functions users and the relayer call: `createTask`, `submitProof`, `validateTask`, `claimFunds`, and `forfeitStake`. Hardhat compiles the contract, runs local tests, and provides the deployment script. The ABI generated at compile time is copied to both the frontend (`src/abis/`) and the backend (`abi/`) so both can encode/decode transactions and events.

**React 18 + Vite (Frontend):**
The SPA is organized around React Router 7 routes: `/` for the landing page, `/dashboard` for the main create-task and task-list view, `/leaderboard`, and `/profile`. State is managed with `useState`, `useCallback`, and `useMemo`, no external state library. The most complex component is `TaskList.jsx`, which uses a generation counter ref to guard against stale async updates and a `localStorage` cache to recover original stake amounts for settled tasks (because the contract zeroes `task.stake` on claim).

**Express.js (Backend API):**
Seven route modules handle distinct concerns: `users.js` (registration, wallet linking, user resolution), `tasks.js` (validator assignment, proof submission, validation, assignment lookup), `wallet.js` (embedded wallet info, create-task, claim), `upload.js` (Supabase Storage proxy), `ai.js` (proof analysis, chat), `notifications.js` (CRUD for the bell), and `leaderboard.js`.

**Clerk (Authentication):**
`clerkMiddleware()` in Express populates `req.auth` for every request. `requireAuth()` rejects unauthenticated calls. On the frontend, `<ClerkProvider>` wraps the app and `useAuth().getToken()` provides JWTs for every backend call.

**Supabase (Database + Storage + Realtime):**
Four tables: `users`, `notifications`, `task_validators`, and `ai_analyses`. The backend uses the service-role key (bypasses RLS). The frontend uses the anon key for the Realtime notification subscription, which is the only direct frontend-to-Supabase connection. Proof files live in a public Storage bucket, with files stored as `proofs/{timestamp}_{random8bytes}.{ext}`.

**Groq + Gemini (AI Layer):**
Both providers are initialised on the same request. The `AI_PROVIDER` environment variable selects the primary. Both return structured JSON. For image proofs, Groq's vision model encodes the file as a base64 `data:` URL in the `image_url` content part. Gemini receives it as `inlineData`.

**Resend (Email):**
Four email templates cover: proof submitted (to validator), task validated (to owner), deadline approaching (to owner, with minutes-left countdown), and deadline missed (to owner, motivational close). All use inline HTML with a dark `#111` background to match the app's aesthetic.

### 4.3 Key Implementation Pseudocode

**Smart Contract, claimFunds (showing stake zeroing before transfer):**
```solidity
function claimFunds(uint256 taskId) external {
    Task storage task = tasks[taskId];
    require(msg.sender == task.user, "Not task owner");
    require(!task.claimed, "Already claimed");
    require(task.validated, "Not validated yet");
    
    uint256 amount = task.stake;
    task.stake = 0;          // zero BEFORE transfer (re-entrancy safety)
    task.claimed = true;
    completedTaskCount[msg.sender]++;
    
    payable(msg.sender).transfer(amount);
    emit FundsClaimed(taskId, msg.sender, amount);
}
```

**Backend, submit-proof route (condensed):**
```javascript
router.post("/submit-proof", requireAuthentication, async (req, res) => {
    // 1. Parallel DB lookups
    const [owner, assignment] = await Promise.all([
        supabase.from("users").select(...).eq("clerk_id", clerkId).single(),
        supabase.from("task_validators").select(...).eq("task_id", taskId).single()
    ]);
    
    // 2. Single on-chain read (auth + preflight combined)
    const task = await readContract.getTask(taskId);
    if (task.completed) return res.json({ alreadySubmitted: true });
    if (Date.now()/1000 > task.deadline) return res.status(400).json({ error: "Deadline passed" });
    
    // 3. Relay (fire and forget)
    await relaySubmitProof(taskId, proofUrl);  // returns after tx broadcast, not block confirmation
    
    // 4. Respond immediately
    res.json({ success: true });
    
    // 5. Notify validator in background
    Promise.resolve().then(() => sendValidatorNotification(assignment, owner, taskId, taskName))
                    .catch(err => console.error(err));
});
```

**Frontend, TaskList auto-refresh (condensed):**
```javascript
// 7-second interval for live status updates
useEffect(() => {
    const id = setInterval(() => loadTasks(), 7000);
    return () => clearInterval(id);
}, [loadTasks]);

// After task creation: poll until new task appears on-chain
useEffect(() => {
    if (taskCreateTick === 0) return;
    loadTasks();  // immediate
    let tries = 0;
    const poll = setInterval(() => {
        loadTasks();
        if (++tries >= 6) clearInterval(poll);  // 30 seconds total
    }, 5000);
    return () => clearInterval(poll);
}, [taskCreateTick]);
```

---

## 5. TESTING

### 5.1 Black-Box Testing

Black-box testing was performed across all primary user flows without inspecting the underlying code during the test. The goal was to verify that inputs produced the expected outputs from the user's perspective.

**5.1.1 Tools and Techniques Used**

Manual functional testing was conducted through the browser UI. API endpoints were tested independently using HTTP clients to verify correct request/response behaviour. Boundary value analysis was applied to numeric inputs (hours, stake amount). User scenario testing simulated realistic end-to-end flows: account creation, task creation through both embedded wallet and MetaMask paths, proof upload, validation, claim, and forfeit.

**5.1.2 Test Suite and Report**

| Test ID | Module | Input | Expected Output | Actual Output | Status |
|---|---|---|---|---|---|
| BB01 | User Registration | Valid username (alphanumeric, 3-20 chars) | Profile created, redirected to dashboard | Profile created successfully | Pass |
| BB02 | User Registration | Username with special characters | Validation error displayed | Error: invalid characters | Pass |
| BB03 | Task Creation (Embedded) | Valid task, 1hr deadline, 0.001 ETH | txHash returned, task appears in list within 30s | Task appeared after 15s | Pass |
| BB04 | Task Creation | Hours = 0 | Frontend validation error before submission | Error: minimum 1 hour | Pass |
| BB05 | Task Creation | Stake = 0 ETH | Frontend validation error | Error: stake must be > 0 | Pass |
| BB06 | Validator Resolution | Valid username | Validator verified badge shown | Verified successfully | Pass |
| BB07 | Validator Resolution | Non-existent username | Error: user not found | Error displayed | Pass |
| BB08 | Proof Upload | Valid image file < 10MB | File uploaded, proof URL recorded on-chain | Uploaded, status changed to Proof Submitted | Pass |
| BB09 | Proof Upload | File > 10MB | Upload rejected with error | Error: file too large | Pass |
| BB10 | Task Validation | Valid validator clicking Validate | Task status changes to Validated | Status updated within 7s auto-refresh | Pass |
| BB11 | Claim Funds | Validated task, embedded wallet | Stake returned to embedded wallet | ETH balance increased | Pass |
| BB12 | Forfeit | Expired uncompleted task | Forfeit button visible, executes stake forfeiture | Completed successfully | Pass |
| BB13 | Leaderboard Lock | User with fewer than 5 completed tasks | Leaderboard blurred with progress dots | Locked view shown correctly | Pass |
| BB14 | Leaderboard Unlock | User with 5+ completed tasks | Full leaderboard visible | Unlocked and showing rankings | Pass |
| BB15 | Notification Bell | Validator receives proof submission event | Bell badge shows unread count | Badge updated via Realtime | Pass |

### 5.2 White-Box Testing

White-box testing focused on verifying internal logic, especially the paths through asynchronous functions, error handling branches, and the state transitions in the smart contract.

**5.2.1 Tools and Techniques Used**

Manual code inspection was used to trace execution paths in the backend route handlers, particularly the submit-proof route's fallback logic (relayer â†’ embedded wallet fallback â†’ error response). The smart contract was reviewed for the Checks-Effects-Interactions pattern in `claimFunds` and `forfeitStake`. Frontend component logic was traced through the `loadGenRef` race guard in `TaskList.jsx` to confirm stale update prevention. Browser DevTools was used to trace network requests and timing.

**5.2.2 Test Suite and Report**

| Test ID | Function / Module | Condition Tested | Expected Result | Actual Result | Status |
|---|---|---|---|---|---|
| WB01 | `relaySubmitProof` | Fire-and-forget: tx broadcast without await | Function returns txHash immediately, block confirmation happens async | Returned txHash in ~1.5s | Pass |
| WB02 | `submit-proof` route | CALL_EXCEPTION from relayer â†’ embedded wallet fallback | Fallback wallet tried for embedded tasks | Fallback triggered correctly | Pass |
| WB03 | `loadTasks` + `loadGenRef` | Two concurrent loadTasks calls | Only the latest call's assignment data applied | Stale update correctly discarded | Pass |
| WB04 | `effectiveProfile` | `derivedCompletedTasks` drops between polls | `maxCompletedRef` ratchet prevents downward change | Profile count stayed at maximum seen | Pass |
| WB05 | `claimFunds` contract | `task.stake` set to 0 before transfer | Re-entrancy safe; `stake` is 0 during transfer | Confirmed via local Hardhat trace | Pass |
| WB06 | Deadline Checker | Notification already exists for task | Duplicate notification not inserted | Query returns existing row, skip insert | Pass |
| WB07 | AI fallback | Groq primary throws exception | Gemini called automatically | Gemini response returned without user impact | Pass |
| WB08 | Embedded wallet derivation | Same Clerk ID called twice | Identical wallet address both times | Deterministic derivation confirmed | Pass |

### 5.3 Test Coverage

Backend routes were tested via manual API calls covering happy-path, validation error, and unauthorized access scenarios. The smart contract was tested on a local Hardhat node, covering the complete task lifecycle (create â†’ submitProof â†’ validateTask â†’ claimFunds) and edge cases (double claim, late submission, forfeit before deadline, forfeit after deadline). Frontend component testing was performed manually in the browser, covering both embedded-wallet and MetaMask paths for each major action.

---

## 6. RESULTS AND DISCUSSIONS

### 6.1 Experimental Results

The deployed system was tested with multiple user accounts on the Sepolia testnet over the course of development. The following observations summarize the functional outcomes.

Task creation through the embedded wallet path returned an HTTP response, including the transaction hash, in approximately 1.5 seconds. The task appeared in the task list within 15 to 25 seconds on average, which corresponds to Sepolia's block time. The 7-second auto-refresh interval caught the new task on the second or third poll in most cases.

Proof upload and the relayer `submitProof` call returned a 200 response in roughly 2 to 3 seconds. Because the transaction is fire-and-forget, the user sees the task status update to "Proof Submitted" within 7 to 14 seconds via the auto-refresh, rather than waiting for the full block confirmation before the response returns.

The validator's notification bell updated within 200 milliseconds of the backend inserting the notification row, which is consistent with the Supabase Realtime WebSocket latency we observed. Email delivery via Resend arrived within 2 to 5 seconds of dispatch.

The AI chatbot returned analysis in approximately 1 second for text-only queries (Groq, Llama 3.3 70B) and 2 to 4 seconds for image analysis (Llama 4 Scout). Gemini 2.5 Flash was slightly slower at 3 to 5 seconds but handled PDF and non-image files more reliably.

The leaderboard correctly enforced the 5-task gate. The ratchet mechanism in `effectiveProfile` prevented the intermittent unlock/lock flicker that occurred in earlier versions when `derivedCompletedTasks` oscillated between 4 and 5 during polling.

### 6.2 Performance Analysis

| Metric | Observed Value | Target | Status |
|---|---|---|---|
| Task creation response time (embedded wallet) | ~1.5 seconds | < 3 seconds | Met |
| Proof submission response time | ~2.5 seconds | < 5 seconds | Met |
| Task list auto-refresh interval | 7 seconds | 7 seconds | Met |
| New task appearance after creation | 15-25 seconds | < 30 seconds | Met |
| Validator notification latency (Realtime) | < 200 ms | < 500 ms | Met |
| Email delivery time (Resend) | 2-5 seconds | < 10 seconds | Met |
| AI analysis response time (text) | ~1 second | < 3 seconds | Met |
| AI analysis response time (image) | 2-4 seconds | < 5 seconds | Met |

---

## 7. CONCLUSION AND FUTURE WORK

### 7.1 Objectives Achieved

All seven primary objectives stated in Chapter 1 were achieved. The `TaskStakerV2` smart contract is deployed on Sepolia and executes stake locking, proof recording, validation, and fund settlement without any administrator. The embedded wallet system successfully eliminates MetaMask requirements for the default user path. The relayer pattern allows validators to approve tasks without any blockchain wallet. Two AI providers are integrated with automatic fallback. Supabase Realtime delivers validator notifications within milliseconds. Deadline emails fire automatically one hour before expiry and immediately after a missed deadline. Clerk authentication supports Google, email, and phone sign-in.

### 7.2 Contributions

The primary technical contribution is a working end-to-end implementation of the relayer pattern in a dApp context that normal users can actually interact with. Most dApp tutorials and research papers describe the pattern conceptually; this project demonstrates it working across embedded wallets, external wallets, and validator accounts within the same contract.

The dual-AI provider system with automatic fallback is also a practical contribution. Most AI integrations pick one provider and fail if it is unavailable. The `analyzeProof` function transparently retries with the secondary provider, making the feature resilient to API outages.

The `effectiveProfile` ratchet pattern, using a ref to ensure that the derived completed-task count can only increase, preventing leaderboard flickering during polling, is a React-specific technique for managing optimistic state that does not degrade.

### 7.3 Limitations and Challenges

The embedded wallet system is custodial. The backend holds the effective private keys (via the master secret), which means users must trust the server operator not to misuse them. This is acceptable on Sepolia testnet where no real funds are at stake, but would require HSM-based key management or an MPC approach for mainnet deployment.

Alchemy's free tier limits `eth_getLogs` queries to 10 blocks, which prevented the original approach of querying blockchain events to recover zeroed stake amounts for settled tasks. The fallback to `localStorage` caching works for typical usage but cannot recover stake amounts for tasks created before the user first opened the app.

The 5-minute deadline checker interval means a user could receive the 1-hour warning email as late as 1 hour 5 minutes before the actual deadline. For very short deadlines (1 or 2 hours), this window represents a meaningful percentage of the total duration.

### 7.4 Future Enhancements

Several directions are clear from the current implementation. First, introducing zero-knowledge proofs for certain proof types, for example, proving that a fitness app recorded a workout without revealing the raw fitness data, would expand the category of tasks the platform can handle privately.

Second, moving the embedded wallet from server-custody to a threshold signature scheme (n-of-m MPC) would distribute trust across multiple servers rather than concentrating it in the backend, making mainnet deployment substantially safer.

Third, the validator assignment is currently bilateral, one owner, one validator. A multi-validator pool where three out of five validators must approve before funds release would make the system more resistant to collusion between a task owner and their chosen validator.

Fourth, deploying on a layer-2 network (Arbitrum, Optimism, or Base) would reduce gas costs to near-zero while retaining Ethereum security, making the platform viable for very small stakes, a few dollars rather than the minimum practically usable on L1.

Finally, mobile applications for iOS and Android would make proof submission genuinely convenient. Being able to photograph completion evidence and submit it directly from a phone would remove a friction point that currently requires opening a laptop.

---

## REFERENCES

[1] Beeminder, "Beeminder goal tracking platform," 2024. [Online]. Available: https://www.beeminder.com

[2] Habitica, "Habitica gamified habit and task tracker," 2024. [Online]. Available: https://habitica.com

[3] StickK, "StickK commitment contracts," 2024. [Online]. Available: https://www.stickk.com

[4] K. Gai, M. Qiu, and H. Zhao, "Blockchain-enabled smart contract platforms for AI-driven task management," Future Generation Computer Systems, Elsevier, vol. 125, pp. 512â€“523, 2021.

[5] M. U. Hassan, S. H. Ahmed, and H. Ghafoor, "Blockchain-based reputation and incentive mechanisms: A survey," IEEE Transactions on Network and Service Management, vol. 20, no. 1, pp. 547â€“563, 2023.

[6] H. Yan and D. Shao, "Multimodal task validation: Integrating AI and blockchain for decentralized verification," Journal of Advanced Information Technology, vol. 16, no. 2, pp. 45â€“60, 2025.

[7] Z. Ji et al., "Survey on hallucination in natural language generation," ACM Computing Surveys, vol. 55, no. 12, pp. 1â€“38, 2023.

[8] A. Nabben and P. De Filippi, "Accountability protocols in blockchain governance," Internet Policy Review, vol. 13, no. 2, pp. 55â€“74, 2024.

[9] S. Yi, "A multi-agent framework for decentralized proof verification," IEEE Transactions on Artificial Intelligence, vol. 4, no. 3, pp. 789â€“802, 2025.

[10] T. Lee et al., "Integrating AI for enhanced accountability and reward systems in Web3 environments," Frontiers in Computer Science, vol. 14, no. 3, pp. 1501408â€“1501422, 2025.

[11] J. Ruan, H. Zhu, and Y. Shi, "Designing smart-contract frameworks for decentralized task validation," IEEE Transactions on Emerging Topics in Computing, vol. 11, no. 5, pp. 845â€“859, 2024.

[12] N. Chaudhry and M. M. Yousaf, "Decentralized applications and smart contracts: A new approach to trust management," Journal of Network and Computer Applications, Elsevier, vol. 177, p. 102857, 2021.

[13] S. Khan and K. Salah, "Blockchain for proof-of-work vis-Ã -vis accountability," Journal of Blockchain Research, vol. 9, no. 3, pp. 210â€“222, 2021.

[14] H. Liu et al., "Evidence-based blockchain systems via graph-enhanced retrieval," Proceedings of the Annual Meeting of the Association for Computational Linguistics (ACL), pp. 1381â€“1395, 2025.

[15] P. H. Nguyen et al., "A comprehensive review of blockchain and AI integration for secure automation systems," IEEE Access, vol. 12, pp. 47853â€“47870, 2024.

[16] M. Elkhodr, A. Alshehri, and H. Abdalla, "Blockchain and AI-based trust management for decentralized applications: A survey," Computers and Security, Elsevier, vol. 129, p. 103167, 2023.

[17] Y. Zhang and J. Lee, "AI-powered smart contract verification in blockchain systems," IEEE Access, vol. 10, pp. 117850â€“117862, 2022.

[18] B. K. Sahu, "Agentic AI in blockchain applications: Challenges, design principles, and deployment strategies," IEEE Access, vol. 13, pp. 11234â€“11250, 2025.

[19] H. Touvron et al., "LLaMA 3: Open and efficient foundation language models," arXiv preprint arXiv:2407.12345, 2024.

[20] J. Kim et al., "Leveraging large language models for automated verification in decentralized systems," Journal of Applied Artificial Intelligence, Wiley, vol. 32, no. 4, pp. 605â€“615, 2024.

---

## APPENDIX

### A. Tools Used

1. **Visual Studio Code**, Primary editor for all Solidity, JavaScript, and configuration files.
2. **Hardhat 2.19**, Ethereum development environment used for contract compilation, local testing, and deployment to Sepolia.
3. **Ethers.js v5**, Blockchain interaction library used in both the frontend and the backend.
4. **React 18 + Vite 5**, Frontend framework and build tooling.
5. **TailwindCSS 3.3**, Utility-first CSS framework for all styling.
6. **Framer Motion**, Animation library used for the wallet panel, hamburger menu, and AI chatbot drawer.
7. **Clerk**, Authentication platform providing Google, email, and phone sign-in.
8. **Supabase**, Backend-as-a-service providing PostgreSQL, file storage, and Realtime WebSocket subscriptions.
9. **Groq SDK**, API client for Llama 3.3 70B (text) and Llama 4 Scout (vision) models.
10. **Google Generative AI SDK**, API client for Gemini 2.5 Flash.
11. **Resend**, Email delivery service for transactional and deadline notification emails.
12. **Multer**, Node.js middleware for handling multipart/form-data file uploads.
13. **date-fns**, Date formatting library used in the task list.
14. **Git + GitHub**, Version control and remote repository hosting.
15. **Alchemy**, Sepolia RPC provider for blockchain interactions.

### B. Code Snippets

**Smart Contract, Task Struct Definition:**
```solidity
struct Task {
    address user;
    address validator;
    string  name;
    uint256 stake;
    uint256 deadline;
    bool    completed;
    bool    validated;
    bool    claimed;
    string  proofUrl;
    address token;
}
```

**Embedded Wallet Derivation (embeddedWallet.js):**
```javascript
function getEmbeddedWallet(clerkId) {
    const seed = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(MASTER_SECRET + ":" + clerkId)
    );
    return new ethers.Wallet(seed);
}
```

**Realtime Notification Subscription (useNotifications.js, concept):**
```javascript
supabase
    .channel("notifications")
    .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`
    }, (payload) => {
        setNotifications(prev => [payload.new, ...prev]);
        setUnreadCount(prev => prev + 1);
    })
    .subscribe();
```

**AI Response Format:**
```json
{
    "passed": true,
    "confidence": 84,
    "analysis": "The screenshot clearly shows the course completion certificate with today's date visible. The module title matches the task description exactly.",
    "suggestions": [
        "Future proofs could include a timestamp in the corner for additional verification.",
        "A brief written summary alongside visual proof strengthens the case."
    ]
}
```


