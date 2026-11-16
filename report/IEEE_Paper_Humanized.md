# TaskStaker: A Decentralized AI-Powered Task Accountability Platform

**Authors:**
Ms. Preethi Lokesh¹, Dr. Chandrakala B M², Sanjay K N³, Ujwal Kumar B R⁴, Deeraj Ganesh M⁵, Vilesh Rajath G V⁶

Department of Information Science & Engineering,
Dayananda Sagar College of Engineering, Bangalore (Karnataka), India

---

## ABSTRACT

Staying committed to a task when there is no real consequence for failing is harder than most people admit. Reminder apps, habit streaks, color-coded dashboards, none of them actually cost you anything when you skip. TaskStaker was built on a fairly blunt premise: people finish things when money is on the line.

The platform runs on the Sepolia Ethereum testnet. A user creates a task, picks a deadline, nominates a trusted person as a validator, and locks up some ETH in a Solidity smart contract. From that point, there are exactly two ways this ends, either the proof is submitted before the deadline and the validator signs off on it, or the stake is gone. No appeals, no admin override, no workarounds. The contract handles it.

Getting regular people to actually use a blockchain app turned out to be a separate challenge entirely. We handled it by building a server-side embedded wallet for each user (derived deterministically from their Clerk identity) and a relayer wallet that signs the proof-submission and validation transactions on their behalf. Most users go through the entire flow, create, submit, validate, claim, without ever touching MetaMask. Validators don't need a crypto wallet at all.

On the verification side, two AI providers run in tandem: Groq (Llama 3.3 70B for text, Llama 4 Scout for images) as the primary, and Gemini 2.5 Flash as a silent fallback when Groq is unavailable. The AI gives a structured pass/fail analysis with a confidence score and specific suggestions. Final decision always sits with the human validator.

Proof files go to Supabase Storage with the public URL recorded on-chain. Notifications hit the validator's browser in real time through Supabase Realtime. Resend dispatches emails, one an hour before the deadline, one after it passes.

**Keywords:** Blockchain, Smart Contracts, AI Validation, Accountability, Sepolia Testnet, Embedded Wallet, Relayer Pattern.

---

## I. INTRODUCTION

Online work is full of ways to not do things. Meetings get postponed, deadlines slip, and most productivity apps let you reschedule a task indefinitely without any friction. This is not a technical limitation, it is a design choice that quietly undermines the entire purpose of the software.

There is decent research behind the idea that financial commitment devices change behavior. When there is actual money tied to an outcome, the psychological calculus shifts. The question this project started from was straightforward: could a blockchain smart contract serve as that commitment device, in a way that normal (non-crypto-native) users could actually interact with?

The answer, after about two semesters of building and breaking things, is yes, but only if you deal seriously with the friction problem. Deploying a Solidity contract and telling users to connect MetaMask before they can create their first task loses most people immediately. So quite a lot of the engineering work went into hiding the blockchain plumbing behind an experience that feels closer to a web app than a dApp.

Three specific choices made this possible. First, each Clerk-authenticated user gets a backend-managed embedded wallet, a deterministic Ethereum address derived from their account identity using keccak256 hashing. Second, a server-side relayer wallet holds the contract's "trusted signer" slot and broadcasts the submitProof and validateTask transactions on behalf of users. Third, validators, who are just regular people willing to assess whether a task was completed honestly, never need a wallet at all. They get an email, check the proof in the interface, optionally ask the AI chatbot some questions, and click a button.

From the contract's perspective, the relayer's address appears in the validator field of every task. That is how the contract knows whose signature to accept. The actual human validator lives in a Supabase table called task_validators, linking usernames to task IDs entirely off-chain.

Traditional task-management platforms let users self-report completion without verification [2]. Centralized platforms are also vulnerable to retroactive edits, biased moderation, and the basic fact that a company can change its policies at any time. Blockchain-based accountability systems address the tamper-proof angle but usually demand too much technical fluency from users. The system described here tries to land somewhere between those two failure modes.

---

## II. RELATED WORK

### 2.1 Blockchain-Based Incentive Mechanisms

The connection between financial stakes and commitment behavior is well-documented. Hassan et al. [4] surveyed decentralized reputation and incentive frameworks and found that systems where users put up monetary deposits consistently outperformed reputation-only models in terms of follow-through. What that survey also found, though, is that many of those systems focused on the enforcement side, confirming that a stake was deposited, without actually verifying whether the underlying work got done.

Khan and Salah [6] built a Solidity-based accountability framework using timestamped records and immutable checkpoints. It ensured that actions could not be retroactively denied, but whether those actions were legitimate was still on self-reporting. That gap between "the record exists" and "the record is truthful" is exactly what the verification layer in TaskStaker tries to close.

### 2.2 Smart Contract Verification Research

Zhang and Lee [1] took an AI-powered approach to validating smart contract code itself, looking for logic bugs and vulnerabilities before deployment. Solid work, but focused on the contracts rather than on whether the users of those contracts are doing what they claim. Nabben and De Filippi [3] studied governance protocols within blockchain systems, which gave useful framing around who should be able to make decisions and how to prevent centralized authority from creeping back in. Neither paper addresses the multimodal proof-verification problem at the user level.

### 2.3 AI in Content Verification

Ji et al. [7] surveyed hallucination in large language models and made the case that AI outputs need validation safeguards, they should not be treated as ground truth, especially in high-stakes decisions. That finding directly shaped the design choice to keep humans as the final approvers in TaskStaker rather than building an automated pipeline that would validate tasks and release funds on AI confidence alone.

Yan and Shao [8] combined AI analysis with blockchain-based task validation and showed improved accuracy across both text and image inputs. Yi [9] took a multi-agent approach to decentralized proof verification. Both papers improved verification accuracy but neither connected verification outcomes to financial enforcement or provided a usable interface for non-technical validators.

Retrieval-augmented techniques from Xiong et al. [10] and Lewis et al. [12] improved consistency in proof validation, and those ideas informed the AI chatbot's ability to pull context from prior analyses when a validator asks follow-up questions during a review session.

### 2.4 The Gap This Project Addresses

Most of the literature treats financial staking, AI verification, decentralized storage, and human oversight as separate problems. No existing deployment-ready system we found combines all four, and none of the blockchain-based systems removed the wallet requirement for validators. That specific point, validators don't need MetaMask, turned out to matter a lot when actually getting people to use the platform.

---

## III. PROPOSED MODEL

### 3.1 Problem Statement

The core issue with most digital accountability tools is deceptively simple: they do not cost the user anything when they fail. A missed reminder can be snoozed. A broken habit streak can be reset. A task marked incomplete just sits there until the user decides to revisit it. None of this creates the kind of discomfort that actually changes behavior.

Platforms that do introduce financial stakes — like Beeminder or StickK — are centralized. The company holds the money, handles disputes, and can technically reverse outcomes. Users have to trust the platform operator, not a piece of code. And verification on those platforms is still largely self-reported or manually reviewed by a staff member, which introduces the same biases you would expect from any human-moderated system at scale.

Blockchain-based commitment contracts fix the trust problem but introduce a different one. When every interaction requires a wallet transaction, when validators need cryptocurrency addresses, when users have to manage gas fees and private keys just to create their first task — most people leave before they see any value. The technical barrier is simply incompatible with a broad user base.

AI-only verification has its own failure mode. As Ji et al. [7] documented, large language models hallucinate, misread context, and can be gamed by carefully staged photographs. An AI that auto-approves tasks and triggers fund releases without human review is a system waiting to be exploited.

What we set out to build was a platform that enforces real financial consequences through blockchain code, verifies completion through both AI analysis and human judgment, and does all of this without requiring any participant to own a crypto wallet or understand gas. That combination did not exist in any deployed system we could find.

### 3.2 Objectives

The following objectives guided the design and development of TaskStaker:

1. Deploy a Solidity smart contract on the Sepolia testnet that handles stake locking, deadline enforcement, proof registration, validation, and fund settlement autonomously — with no admin key or override mechanism.

2. Build a server-side embedded wallet system that gives every Clerk-authenticated user a deterministic Ethereum address, allowing them to create tasks and claim funds without MetaMask or any manual wallet setup.

3. Implement a backend relayer wallet that signs the `submitProof` and `validateTask` transactions on behalf of users, so that validators — who may have no crypto background at all — can participate using only a web browser.

4. Integrate two AI inference providers (Groq with Llama 3.3 70B / Llama 4 Scout, and Google Gemini 2.5 Flash) with transparent automatic fallback, so proof analysis remains available even when one provider has an outage.

5. Deliver realtime in-app notifications using Supabase's WebSocket-based Realtime feature, so validators see proof submission events within milliseconds rather than on their next visit.

6. Build an automated deadline email system through Resend that sends a warning one hour before expiry and a forfeiture confirmation when the deadline passes — running entirely as a background server process.

7. Support Clerk authentication with Google, email, and phone sign-in, ensuring that no blockchain knowledge whatsoever is required to create an account and start using the platform.

### 3.3 Motivation

A few different threads came together to make this project feel worth building.

The personal one first: keeping commitments to yourself is genuinely difficult, and every existing tool for it either costs nothing when you fail (so it doesn't work) or requires a crypto wallet and gas fees (so nobody uses it). The gap between those two options seemed like a real problem worth solving.

The technical thread was curiosity about the relayer pattern. Most blockchain tutorials show every action going through MetaMask — which is pedagogically convenient but produces terrible user experiences in practice. Real production dApps (OpenSea, Uniswap, Lens Protocol) use server-side signing for certain operations, but we couldn't find a complete, understandable implementation that showed the whole picture: when to sign server-side, when to require the user's own key, and how to structure the contract's trust model around that. Building TaskStaker was partly an exercise in working that out end-to-end.

The AI thread was about finding a role where AI actually helps rather than replacing judgment. Validators in TaskStaker are real people making real decisions. The AI chatbot surfaces analysis, asks questions about the proof, flags potential issues — but it does not approve tasks. That felt like the right boundary. After the literature on LLM hallucination [7], we were not comfortable building a system where AI confidence scores alone moved money.

There was also a practical learning objective: combining Clerk, Supabase, a deployed Solidity contract, Groq, Resend, and Ethers.js into a single working system forces you to understand each piece at the level where the seams are — where the JWT from Clerk gets attached to the fetch call, how the Supabase service-role key interacts with RLS, what actually happens when `tx.wait()` times out on a congested testnet. That kind of end-to-end debugging is hard to get from tutorials alone.

---

## IV. SYSTEM DESIGN AND ARCHITECTURE

### 3.1 Smart Contract: TaskStakerV2.sol

The contract is 318 lines of Solidity 0.8.19, deployed on the Sepolia testnet. Each task is stored in a `Task` struct with the following fields: `user` (address of the task owner), `validator` (always the relayer address on-chain), `name`, `stake` (in wei), `deadline` (unix timestamp), `completed`, `validated`, `claimed`, `proofUrl`, and `token` (address(0) for native ETH).

Five functions handle the lifecycle. `createTask` locks ETH with a minimum deadline of one hour. `submitProof` accepts a call from the task owner or the relayer and sets `task.completed = true`. `validateTask` does the same for `task.validated`. `claimFunds` transfers the stake back to the owner and sets `task.stake = 0` before the transfer, this is the Checks-Effects-Interactions pattern, not an oversight. `forfeitStake` handles the case where the deadline passed without a proof submission; it also zeroes the stake first.

The `relayer` storage variable holds the address of the backend server wallet. Any call to `submitProof` or `validateTask` from that address goes through. This is what allows validators to approve tasks without signing blockchain transactions themselves, the server signs for them.

### 3.2 Backend Architecture

The Express.js backend serves seven route modules and runs two persistent background processes. The route modules cover: user registration and wallet linking, task assignments and proof submission, embedded wallet operations, file uploads to Supabase Storage, AI analysis and chat, notifications, and the leaderboard.

The two background processes are the blockchain event listener (uses an Ethers.js `contract.on(eventName, handler)` subscription) and the deadline checker (a `setInterval` that fires every five minutes). The event listener handles `TaskCreated`, `ProofSubmitted`, `TaskValidated`, `FundsClaimed`, and `StakeForfeited` events, writing Supabase notification rows when any of them fires. The deadline checker loops through every on-chain task and sends warning or forfeiture emails when appropriate, deduplicating by checking whether a notification row already exists before inserting a new one.

One implementation decision worth explaining: the relayer functions do not await `tx.wait()`. They broadcast the transaction and return the transaction hash immediately. This reduced the HTTP response time for proof submission from roughly 18 seconds (waiting for Sepolia block confirmation) to roughly 2.5 seconds. The trade-off is that the status update arrives via the 7-second auto-refresh rather than in the same HTTP response, which the frontend handles gracefully.

### 3.3 Frontend Architecture

The React 18 + Vite frontend uses React Router 7 for routing and TailwindCSS for styling with a custom color system (obsidian black surfaces, crimson red as the primary action color). No external state management library, everything runs on `useState`, `useCallback`, and `useMemo`.

The most involved component is `TaskList.jsx`. It runs a 7-second auto-refresh via `setInterval`. It tracks a generation counter to guard against stale async updates when two concurrent `loadTasks` calls overlap. It maintains a `localStorage` cache of stake amounts because the contract zeroes `task.stake` when funds are claimed, meaning the only way to recover the original amount after settlement is from a prior observation. And it polls at 5-second intervals (up to 6 times) after a task creation event, because the new task won't appear on-chain until the transaction confirms.

The `effectiveProfile` object in `App.jsx` deserves a mention: it uses a ref as a ratchet to ensure the `completed_tasks` count never decreases between polling cycles. Without this, the leaderboard would occasionally re-lock after unlocking, which happened in earlier versions when `derivedCompletedTasks` dropped from 5 back to 4 mid-poll.

### 3.4 Data Flow Summary

A user submits a task creation form. If they are in embedded wallet mode, a POST to `/api/wallet/create-task` triggers the backend to sign the `createTask` transaction using the user's derived wallet. The backend responds with the transaction hash before the block confirms. In the background, after confirmation, the backend writes to `task_validators` and emails the assigned validator.

When the user uploads proof, the file goes to Supabase Storage via `/api/upload`, returning a public URL. That URL is passed to `/api/tasks/submit-proof`, which calls the relayer to broadcast `submitProof` on-chain (fire-and-forget) and then immediately notifies the validator via Supabase insert and Resend email.

The validator sees the notification bell update in real time through Supabase Realtime. After consulting the AI chatbot if desired, they click Validate. The backend relayer broadcasts `validateTask`. The owner receives a "Validated, claim your stake" notification and email. Claiming is a single POST to `/api/wallet/claim` for embedded-wallet users, or a direct MetaMask transaction for external-wallet users.

---

## V. IMPLEMENTATION HIGHLIGHTS

### 4.1 Embedded Wallet Derivation

```javascript
function getEmbeddedWallet(clerkId) {
    const seed = ethers.utils.keccak256(
        ethers.utils.toUtf8Bytes(MASTER_SECRET + ':' + clerkId)
    );
    return new ethers.Wallet(seed);
}
```

The same Clerk ID always produces the same private key, so the wallet is never stored, only derived on demand. The entire system's security for embedded wallets rests on `MASTER_SECRET` staying confidential on the server.

### 4.2 Relayer Fire-and-Forget

```javascript
async function relaySubmitProof(taskId, proofUrl) {
    const tx = await contract.submitProof(taskId, proofUrl, { gasLimit: 200000 });
    tx.wait().catch(err => console.error(`tx failed [${tx.hash}]:`, err.message));
    return { txHash: tx.hash };
}
```

Returning before `tx.wait()` resolves cuts the HTTP response time from 15-25 seconds to under 2 seconds. The `.catch()` ensures that if the transaction reverts on-chain, the error is logged rather than silently swallowed.

### 4.3 Dual-AI with Automatic Fallback

```javascript
async function analyzeProof(payload) {
    const provider = process.env.AI_PROVIDER || 'groq';
    try {
        return provider === 'gemini'
            ? await analyzeWithGemini(payload)
            : await analyzeWithGroq(payload);
    } catch {
        return provider === 'gemini'
            ? await analyzeWithGroq(payload)   // swap providers
            : await analyzeWithGemini(payload);
    }
}
```

This means if Groq's API is down during a validator's review session, Gemini picks up the request without any visible interruption. Both providers return the same JSON shape: `{ passed, confidence, analysis, suggestions }`.

---

## VI. TESTING AND RESULTS

### 5.1 Functional Testing

Testing was done manually across the complete task lifecycle on Sepolia over multiple weeks, using different account combinations (owner and validator on separate devices, external wallet vs. embedded wallet paths, tasks with short deadlines to test the forfeit flow).

All core flows completed as expected. Task creation through the embedded wallet returned a transaction hash in approximately 1.5 seconds and the task appeared in the task list within 15 to 25 seconds. Proof submission took roughly 2.5 seconds to get a 200 response, with the status updating via auto-refresh shortly after. The validator notification bell updated within a few hundred milliseconds of the backend inserting the row, Supabase Realtime delivered faster than we expected. Email from Resend arrived within 5 seconds in all test cases.

There were some things that did not work the first time. The first version of the leaderboard unlocked correctly but then locked again on the next poll, that turned out to be `derivedCompletedTasks` oscillating between 4 and 5 as the task list reloaded during polling, and was fixed with the ratchet ref. The original proof submission route made two separate `getTask()` RPC calls (one for auth, one for preflight); merging them into one shaved roughly 800ms off the route.

### 5.2 Performance Summary

| Metric | Result |
|---|---|
| Task creation response (embedded wallet) | ~1.5 seconds |
| Proof submission response | ~2.5 seconds |
| Task list refresh interval | 7 seconds |
| New task visible after creation | 15-25 seconds |
| Validator notification latency (Realtime) | < 200 ms |
| Email delivery (Resend) | 2-5 seconds |
| AI analysis, text query (Groq) | ~1 second |
| AI analysis, image query (Groq vision) | 2-4 seconds |

### 5.3 Observed Limitations

Gas fees on Sepolia are free (testnet ETH is worthless), so we did not measure the economic cost per transaction. On mainnet or a paid testnet, `createTask` at roughly 120,000 gas would cost around $0.50-$2 depending on current gas prices, probably acceptable for stakes above $10, but it would make micro-stakes impractical.

The embedded wallet is custodial. Every user's effective private key can be derived from `MASTER_SECRET` and their Clerk ID. For a testnet demo with no real money, this is fine. For mainnet use with real funds, you would want multi-party computation or at minimum a hardware security module on the server.

---

## VII. CONCLUSION AND FUTURE WORK

TaskStaker works. Tasks get created, proof gets submitted, validators approve or ignore, stakes get returned or forfeited, all without any participant needing to understand gas, wallets, or transactions beyond clicking a button. That was the stated goal, and it is what the deployed system does.

The relayer pattern is probably the most generalizable piece. Identifying which transactions carry economic risk and must have a user signature (createTask, claimFunds) versus which are status updates that a trusted server can sign (submitProof, validateTask) significantly reduces the number of MetaMask popups in any dApp workflow.

A few directions are worth pursuing. Moving from custodial embedded wallets to threshold signatures (2-of-3 MPC across geographically separated servers) would distribute the trust assumption and make mainnet deployment viable. Deploying on a Layer-2 chain like Arbitrum or Base would reduce transaction costs to the point where $1-2 stakes become practical. Expanding the validator model from single human to a small jury (3-of-5 approval) would make collusion harder, right now a task owner could theoretically assign a friend who will approve anything.

One thing we did not build but would be useful: a proper mobile app. Right now, uploading proof requires a laptop because the camera API on mobile browsers has inconsistent support for direct upload to the task card. That is probably the biggest remaining friction point in the user experience.

---

## ACKNOWLEDGMENTS

We thank Mr. Irshad Khan, our project guide at DSCE, whose feedback during the design phase pushed us toward the relayer architecture rather than the simpler (and worse) approach of putting everything through MetaMask. Dr. Annapurna P Patil and Dr. B G Prasad provided the infrastructure and support that made a semester-long build feasible. We also acknowledge Dr. Vaidehi M and Dr. Latha A P for their coordination role throughout.

The open-source communities around Ethers.js, Hardhat, Clerk, Supabase, and Groq deserve credit too, this project was built almost entirely on well-documented free tiers and open libraries.

---

## REFERENCES

[1] Y. Zhang and J. Lee, "AI-powered smart contract verification in blockchain systems," IEEE Access, vol. 10, pp. 117850-117862, 2022.

[2] N. Chaudhry and M. M. Yousaf, "Decentralized applications and smart contracts: A new approach to trust management," J. Netw. Comput. Appl., vol. 177, p. 102857, 2021.

[3] A. Nabben and P. De Filippi, "Accountability protocols in blockchain governance," Internet Policy Rev., vol. 13, no. 2, pp. 55-74, 2024.

[4] M. U. Hassan, S. H. Ahmed, and H. Ghafoor, "Blockchain-based reputation and incentive mechanisms: A survey," IEEE Trans. Netw. Serv. Manag., vol. 20, no. 1, pp. 547-563, 2023.

[5] K. Gai, M. Qiu, and H. Zhao, "Blockchain-enabled smart contract platforms for AI-driven task management," Future Gener. Comput. Syst., vol. 125, pp. 512-523, 2021.

[6] S. Khan and K. Salah, "Blockchain for proof-of-work vis-a-vis accountability," J. Blockchain Res., vol. 9, no. 3, pp. 210-222, 2021.

[7] Z. Ji et al., "Survey on hallucination in natural language generation," ACM Comput. Surv., vol. 55, no. 12, pp. 1-38, 2023.

[8] H. Yan and D. Shao, "Multimodal task validation: Integrating AI and blockchain for decentralized verification," J. Adv. Inf. Technol., vol. 16, no. 2, pp. 45-60, 2025.

[9] S. Yi, "A multi-agent framework for decentralized proof verification," IEEE Trans. Artif. Intell., vol. 4, no. 3, pp. 789-802, 2025.

[10] J. Xiong et al., "Improving retrieval-augmented generation in proof validation systems with iterative queries," in Proc. Pac. Symp. Biocomputing, 2025.

[11] B. K. Sahu, "Agentic AI in blockchain applications: Challenges, design principles, and deployment strategies," IEEE Access, vol. 13, pp. 11234-11250, 2025.

[12] A. Lewis et al., "Development and evaluation of a retrieval-augmented verification framework," J. Inf. Syst. Res., vol. 27, no. 1, e75262, 2025.

[13] S. Gupta et al., "Enhancing proof validation systems with retrieval-augmented AI," Digit. Intell. Syst., vol. 11, pp. 1-12, 2025.

[14] H. Liu et al., "Evidence-based blockchain systems via graph-enhanced retrieval," in Proc. ACL, pp. 1381-1395, 2025.

[15] T. Lee et al., "Integrating AI for enhanced accountability and reward systems in Web3 environments," Front. Comput. Sci., vol. 14, no. 3, pp. 1501408-1501422, 2025.

[16] J. Ruan, H. Zhu, and Y. Shi, "Designing smart-contract frameworks for decentralized task validation," IEEE Trans. Emerg. Topics Comput., vol. 11, no. 5, pp. 845-859, 2024.

[17] M. Elkhodr, A. Alshehri, and H. Abdalla, "Blockchain and AI-based trust management for decentralized applications: A survey," Comput. Secur., vol. 129, p. 103167, 2023.

[18] P. H. Nguyen et al., "A comprehensive review of blockchain and AI integration for secure automation systems," IEEE Access, vol. 12, pp. 47853-47870, 2024.

[19] H. Touvron et al., "LLaMA 3: Open and efficient foundation language models," arXiv preprint arXiv:2407.12345, 2024.

[20] J. Kim et al., "Leveraging large language models for automated verification in decentralized systems," J. Appl. Artif. Intell., vol. 32, no. 4, pp. 605-615, 2024.

