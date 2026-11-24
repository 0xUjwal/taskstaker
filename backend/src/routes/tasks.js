/**
 * Tasks route — off-chain proof submission and validation.
 *
 * Architecture:
 *  - On-chain validator address = RELAYER_ADDRESS (set at deploy time)
 *  - Real validator is tracked in Supabase `task_validators` table
 *  - Validators never need a wallet; only task owners need one (createTask + claimFunds)
 *
 * POST /api/tasks/assign-validator  — called by frontend after createTask tx succeeds
 * POST /api/tasks/submit-proof      — task owner uploads proof (relayer calls on-chain)
 * POST /api/tasks/validate          — validator approves task (relayer calls on-chain)
 * GET  /api/tasks/assignments       — returns { taskId: { validatorUsername, ownerUsername } }
 */

const express = require("express");
const { ethers } = require("ethers");
const { requireAuthentication, getUserId } = require("../middleware/auth");
const supabase = require("../services/supabase");
const { relaySubmitProof, relayValidateTask, relayForfeitStake } = require("../services/relayer");
const {
  sendEmail,
  proofSubmittedEmail,
  taskValidatedEmail,
} = require("../services/email");
const {
  getEmbeddedWallet,
  getEmbeddedWalletWithProvider,
} = require("../services/embeddedWallet");

const { verifiedAddress } = require('../services/walletLinkProof');
const { taskRoles, readContract, accountContext, requireTaskAccess } = require('../services/taskAccess');
const { requestReport, isOurStorageUrl } = require('../services/taskReports');
const { getReviewState, addAttempt, addDecision } = require('../services/reviewState');
const router = express.Router();

// The feed is derived from the authenticated account, never a client-supplied
// user ID or the global list of public blockchain tasks.
router.get('/mine', requireAuthentication, async (req, res) => {
  try {
    const { user, embeddedAddress } = await accountContext(getUserId(req));
    const { data: rows, error } = await supabase.from('task_validators').select('*');
    if (error) throw error;
    const byId = new Map((rows || []).map(row => [row.task_id, row]));
    const c = readContract();
    const count = (await c.getTaskCount()).toNumber();
    const tasks = [];
    const assignments = {};
    for (let id = 0; id < count; id++) {
      const row = byId.get(id);
      if (row?.owner_user_id && row.owner_user_id !== user.id && row.validator_user_id !== user.id) continue;
      const t = await c.getTask(id);
      const roles = taskRoles(t, row, user, embeddedAddress, process.env.RELAYER_ADDRESS);
      if (!roles.isOwner && !roles.isValidator) continue;
      tasks.push({ id, user: t.user, validator: t.validator, name: t.name,
        stake: ethers.utils.formatEther(t.stake), deadline: t.deadline.toNumber() * 1000,
        completed: t.completed, validated: t.validated, claimed: t.claimed,
        proofUrl: t.proofUrl, token: t.token, ...roles });
      if (row) assignments[id] = { validatorUsername: row.validator_username,
        ownerUsername: row.owner_username, validatorUserId: row.validator_user_id,
        ownerUserId: row.owner_user_id };
    }
    res.set('Cache-Control', 'private, no-store');
    res.json({ tasks: tasks.reverse(), assignments });
  } catch (err) {
    console.error('Private task feed error:', err.message);
    res.status(err.status || 503).json({ error: err.status ? err.message : 'Unable to load your tasks. Please retry.' });
  }
});

async function getClerkEmail(clerkId) {
  try {
    const { clerkClient } = require("@clerk/express");
    const user = await clerkClient.users.getUser(clerkId);
    return user?.emailAddresses?.[0]?.emailAddress || null;
  } catch {
    return null;
  }
}

/**
 * POST /api/tasks/assign-validator
 * Called immediately after createTask on-chain tx succeeds.
 * Body: { taskId, validatorUsername, taskName }
 */
router.post("/assign-validator", requireAuthentication, async (req, res) => {
  try {
    const clerkId = getUserId(req);
    const { taskId, validatorUsername, taskName, stakeEth } = req.body;

    if (taskId === undefined || !validatorUsername) {
      return res
        .status(400)
        .json({ error: "taskId and validatorUsername are required" });
    }

    // Check on-chain ownership before allowing an assignment to be written.
    await requireTaskAccess(clerkId, taskId, true);

    // Get owner
    const { data: owner } = await supabase
      .from("users")
      .select("id, username")
      .eq("clerk_id", clerkId)
      .single();
    if (!owner) return res.status(404).json({ error: "Owner not found" });

    // Get validator by username or unique_id
    const { data: validator } = await supabase
      .from("users")
      .select("id, username, clerk_id")
      .or(
        `username.eq.${validatorUsername.toLowerCase()},unique_id.eq.${validatorUsername}`,
      )
      .single();
    if (!validator)
      return res.status(404).json({ error: "Validator not found" });

    if (validator.id === owner.id) return res.status(400).json({ error: "Choose another person as validator. You cannot validate your own task." });

    // Upsert assignment
    const { error } = await supabase.from("task_validators").upsert(
      {
        task_id: Number(taskId),
        validator_user_id: validator.id,
        owner_user_id: owner.id,
        task_name: taskName || "",
        owner_username: owner.username,
        validator_username: validator.username,
      },
      { onConflict: "task_id" },
    );

    if (error) throw error;

    // Notify validator about new assignment
    await supabase.from("notifications").insert({
      user_id: validator.id,
      type: "validation_needed",
      title: "New task assigned to you",
      message: `@${
        owner.username
      } assigned you as validator for task #${taskId}: "${taskName || "Task"}"`,
      task_id: Number(taskId),
    });

    // Email validator
    const vEmail = await getClerkEmail(validator.clerk_id);
    if (vEmail) {
      await sendEmail({
        to: vEmail,
        subject: `[TaskStaker] You've been assigned to validate a task`,
        html: `<div style="font-family:sans-serif;max-width:500px">
          <h2 style="color:#FF3B30">New validation assignment</h2>
          <p>Hi @${validator.username},</p>
          <p>@${owner.username} has assigned you as validator for:</p>
          <div style="background:#1B1B1B;color:#fff;padding:16px;border-radius:8px;border-left:4px solid #FF3B30">
            <strong>Task #${taskId}:</strong> ${taskName || ""}
          </div>
          <p>Log in to TaskStaker to monitor and validate this task when proof is submitted.</p>
          <a href="${
            process.env.FRONTEND_URL || "http://localhost:5173"
          }/dashboard"
             style="display:inline-block;background:#FF3B30;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px">
            View Task
          </a>
        </div>`,
      });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Assign validator error:", err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to assign validator" });
  }
});

/**
 * POST /api/tasks/submit-proof
 * Body: { taskId, proofUrl, taskName }
 *
 * 1. Notify validator in Supabase + email
 * 2. Relay submitProof on-chain
 *    → If relayer fails with CALL_EXCEPTION (old contract), signal needsWallet=true
 *      so frontend can fall back to calling submitProof from user's own wallet
 */
router.post("/submit-proof", requireAuthentication, async (req, res) => {
  try {
    const clerkId = getUserId(req);
    const { taskId, proofUrl, taskName } = req.body;

    if (taskId === undefined || !proofUrl) {
      return res
        .status(400)
        .json({ error: "taskId and proofUrl are required" });
    }

    await requireTaskAccess(clerkId, taskId, true);

    // Parallel: owner lookup + assignment lookup
    let [{ data: owner }, { data: assignment }] = await Promise.all([
      supabase
        .from("users")
        .select("id, username, wallet_address")
        .eq("clerk_id", clerkId)
        .single(),
      supabase
        .from("task_validators")
        .select("validator_user_id, validator_username, owner_user_id")
        .eq("task_id", Number(taskId))
        .single(),
    ]);
    if (!owner) return res.status(404).json({ error: "User not found" });

    // If task_validators row is missing, try to reconstruct from the validation_needed
    // notification that wallet.js sent at task creation time (even if the upsert failed).
    if (!assignment) {
      const { data: notif } = await supabase
        .from("notifications")
        .select("user_id")
        .eq("task_id", Number(taskId))
        .eq("type", "validation_needed")
        .single();
      if (notif) {
        const { data: validatorUser } = await supabase
          .from("users")
          .select("id, username")
          .eq("id", notif.user_id)
          .single();
        if (validatorUser) {
          await supabase.from("task_validators").upsert(
            {
              task_id: Number(taskId),
              validator_user_id: validatorUser.id,
              owner_user_id: owner.id,
              task_name: taskName || "",
              owner_username: owner.username,
              validator_username: validatorUser.username,
            },
            { onConflict: "task_id" },
          );
          assignment = {
            validator_user_id: validatorUser.id,
            validator_username: validatorUser.username,
            owner_user_id: owner.id,
          };
        }
      }
    }

    // Single on-chain read for both auth + preflight checks
    const abi = require("../../abi/TaskStakerV2.json").abi;
    const provider = new ethers.providers.JsonRpcProvider(
      process.env.SEPOLIA_RPC_URL,
    );
    const readContract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      abi,
      provider,
    );

    let onChainTask;
    try {
      onChainTask = await readContract.getTask(Number(taskId));
    } catch {
      return res.status(400).json({ error: "Task not found on-chain" });
    }

    // Authorization check: only task owner may submit proof.
    if (assignment) {
      if (assignment.owner_user_id !== owner.id) {
        return res
          .status(403)
          .json({ error: "Only the task owner can submit proof" });
      }
    } else {
      const onChainOwner = onChainTask.user.toLowerCase();
      const linkedWallet = owner.wallet_address
        ? owner.wallet_address.toLowerCase()
        : "";
      const embeddedWallet = getEmbeddedWallet(clerkId).address.toLowerCase();
      if (onChainOwner !== linkedWallet && onChainOwner !== embeddedWallet) {
        return res
          .status(403)
          .json({ error: "Only the task owner can submit proof" });
      }
    }

    // Preflight checks using the already-fetched task
    if (onChainTask.completed) {
      return res.status(200).json({
        success: true,
        alreadySubmitted: true,
        message: "Proof already submitted",
      });
    }

    const nowTs = Math.floor(Date.now() / 1000);
    if (nowTs > onChainTask.deadline.toNumber()) {
      return res
        .status(400)
        .json({ error: "Deadline passed. Proof can no longer be submitted." });
    }

    // Submit proof on-chain.
    // For embedded-wallet tasks: use the embedded wallet directly — it is always
    // authorized as task.user, so it never depends on the relayer address being correct.
    // For external-wallet tasks: use the relayer (the relayer must be authorized on-chain).
    const embeddedWallet = getEmbeddedWalletWithProvider(
      clerkId,
      process.env.SEPOLIA_RPC_URL,
    );
    const taskOwnedByEmbedded =
      onChainTask.user.toLowerCase() === embeddedWallet.address.toLowerCase();

    try {
      if (taskOwnedByEmbedded) {
        // Primary path for embedded-wallet tasks: sign as task.user (always authorized)
        const embeddedContract = new ethers.Contract(
          process.env.CONTRACT_ADDRESS,
          abi,
          embeddedWallet,
        );
        const proofGas = await embeddedContract.estimateGas
          .submitProof(Number(taskId), proofUrl)
          .then((g) => g.mul(120).div(100))
          .catch(() => ethers.BigNumber.from(400000));
        const tx = await embeddedContract.submitProof(
          Number(taskId),
          proofUrl,
          { gasLimit: proofGas },
        );
        tx.wait().catch((err) =>
          console.error(`Embedded submitProof failed [${tx.hash}]:`, err.message),
        );
      } else {
        // External-wallet task: use the relayer (fire-and-forget)
        await relaySubmitProof(Number(taskId), proofUrl);
      }
    } catch (submitErr) {
      console.error("submitProof failed:", submitErr.message);
      return res.status(500).json({
        error: "Proof submission failed on-chain: " + submitErr.message,
      });
    }

    // Respond immediately — tx is broadcast, confirmation happens on-chain
    res.json({ success: true, message: "Proof submitted successfully" });

    // Queue the advisory AI report. Never blocks or fails proof submission.
    Promise.resolve()
      .then(() => requestReport({ taskId: Number(taskId), taskName: taskName || onChainTask.name, proofUrl }))
      .catch((err) => console.error("AI report queue error:", err.message));

    // Notify validator in background (after response is sent)
    if (assignment) {
      Promise.resolve()
        .then(async () => {
          const { data: validatorUser } = await supabase
            .from("users")
            .select("clerk_id")
            .eq("id", assignment.validator_user_id)
            .single();

          await supabase.from("notifications").insert({
            user_id: assignment.validator_user_id,
            type: "proof_submitted",
            title: "Proof submitted — action required",
            message: `@${owner.username} submitted proof for task #${taskId} "${
              taskName || "Task"
            }". Review and validate.`,
            task_id: Number(taskId),
          });

          if (validatorUser) {
            const vEmail = await getClerkEmail(validatorUser.clerk_id);
            if (vEmail) {
              const { subject, html } = proofSubmittedEmail(
                taskName || `#${taskId}`,
                taskId,
                assignment.validator_username,
              );
              await sendEmail({ to: vEmail, subject, html });
            }
          }
        })
        .catch((err) =>
          console.error("Notification error (submit-proof):", err.message),
        );
    }
  } catch (err) {
    console.error("Submit proof error:", err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to submit proof" });
  }
});

/**
 * POST /api/tasks/validate
 * Body: { taskId, taskName }
 *
 * Works for both new tasks (tracked in task_validators) and legacy tasks
 * (validator address stored on-chain). In both cases the backend relayer
 * calls validateTask on-chain — the validator never needs MetaMask.
 */
router.post("/validate", requireAuthentication, async (req, res) => {
  try {
    const clerkId = getUserId(req);
    const { taskId, taskName } = req.body;

    if (taskId === undefined) {
      return res.status(400).json({ error: "taskId is required" });
    }

    const access = await requireTaskAccess(clerkId, taskId);
    const callerWallets = [access.user.wallet_address, getEmbeddedWallet(clerkId).address]
      .filter(Boolean).map(address => address.toLowerCase());
    if (access.isOwner || callerWallets.includes(access.task.user.toLowerCase())) {
      return res.status(403).json({ error: "You cannot validate your own task. An independent person must review your proof." });
    }

    // Parallel: caller lookup + assignment lookup
    let [{ data: callerUser }, { data: assignment }] = await Promise.all([
      supabase
        .from("users")
        .select("id, username, clerk_id, wallet_address")
        .eq("clerk_id", clerkId)
        .single(),
      supabase
        .from("task_validators")
        .select("owner_user_id, owner_username, task_name, validator_user_id")
        .eq("task_id", Number(taskId))
        .single(),
    ]);
    if (!callerUser) return res.status(404).json({ error: "User not found" });
    callerUser.wallet_address = verifiedAddress(clerkId, callerUser.wallet_address);

    // If task_validators row is missing, check whether the caller received a
    // validation_needed notification for this task (sent at creation time in wallet.js).
    // submit-proof normally recreates this row before validate is ever called, but this
    // acts as a final safety net.
    if (!assignment) {
      const { data: notif } = await supabase
        .from("notifications")
        .select("id")
        .eq("task_id", Number(taskId))
        .eq("type", "validation_needed")
        .eq("user_id", callerUser.id)
        .single();
      if (notif) {
        await supabase.from("task_validators").upsert(
          {
            task_id: Number(taskId),
            validator_user_id: callerUser.id,
            owner_user_id: null,
            task_name: taskName || `Task #${taskId}`,
            owner_username: null,
            validator_username: callerUser.username,
          },
          { onConflict: "task_id" },
        );
        assignment = {
          validator_user_id: callerUser.id,
          owner_user_id: null,
          owner_username: null,
          task_name: taskName || `Task #${taskId}`,
        };
      }
    }

    let ownerUserId = null;
    let ownerUsername = null;
    let resolvedName = taskName || `Task #${taskId}`;

    // --- Path 1: New task tracked in task_validators ---

    if (assignment) {
      if (assignment.validator_user_id !== callerUser.id) {
        return res
          .status(403)
          .json({ error: "You are not the assigned validator for this task" });
      }
      ownerUserId = assignment.owner_user_id;
      ownerUsername = assignment.owner_username;
      resolvedName = taskName || assignment.task_name || resolvedName;
    } else {
      // --- Path 2: Legacy task — verify via on-chain validator address ---
      if (!callerUser.wallet_address) {
        return res.status(403).json({
          error:
            "This task was created before our database tracking. Connect a wallet that matches the on-chain validator address to validate it.",
        });
      }

      const { ethers } = require("ethers");
      const abi = require("../../abi/TaskStakerV2.json").abi;
      const provider = new ethers.providers.JsonRpcProvider(
        process.env.SEPOLIA_RPC_URL,
      );
      const readContract = new ethers.Contract(
        process.env.CONTRACT_ADDRESS,
        abi,
        provider,
      );

      let onChainTask;
      try {
        onChainTask = await readContract.getTask(Number(taskId));
      } catch (e) {
        return res.status(400).json({ error: "Task not found on-chain" });
      }

      const onChainValidator = onChainTask.validator.toLowerCase();
      const callerWallet = callerUser.wallet_address.toLowerCase();

      if (onChainValidator !== callerWallet) {
        return res.status(403).json({
          error: `You are not the on-chain validator for this task. Expected wallet: ${onChainTask.validator.slice(
            0,
            8,
          )}...`,
        });
      }

      // Try to find owner in Supabase by wallet address
      const ownerAddr = onChainTask.user.toLowerCase();
      const { data: ownerUser } = await supabase
        .from("users")
        .select("id, username")
        .eq("wallet_address", ownerAddr)
        .single();
      if (ownerUser) {
        ownerUserId = ownerUser.id;
        ownerUsername = ownerUser.username;
      }
    }

    // A task the validator rejected can no longer be approved.
    try {
      const review = await getReviewState(Number(taskId), access.task.proofUrl);
      if (review.status === "rejected") {
        return res.status(409).json({ error: "This task was rejected. It can no longer be validated." });
      }
    } catch (err) {
      console.warn("review state check failed:", err.message);
    }

    // Relay validateTask on-chain (fire-and-forget — returns after tx broadcast)
    try {
      await relayValidateTask(Number(taskId));
    } catch (err) {
      console.error("Relay validateTask failed:", err.message);
      return res
        .status(500)
        .json({ error: "Failed to validate on-chain: " + err.message });
    }

    // Respond immediately — tx is broadcast
    res.json({ success: true, message: "Task validated successfully" });

    // Notify owner in background (after response is sent)
    if (ownerUserId) {
      Promise.resolve()
        .then(async () => {
          await supabase.from("notifications").insert({
            user_id: ownerUserId,
            type: "task_validated",
            title: "Task validated — claim your stake!",
            message: `@${callerUser.username} validated your task #${taskId} "${resolvedName}". You can now claim your ETH.`,
            task_id: Number(taskId),
          });

          const { data: ownerClerk } = await supabase
            .from("users")
            .select("clerk_id")
            .eq("id", ownerUserId)
            .single();

          if (ownerClerk) {
            const oEmail = await getClerkEmail(ownerClerk.clerk_id);
            if (oEmail) {
              const { subject, html } = taskValidatedEmail(
                resolvedName,
                taskId,
                ownerUsername,
              );
              await sendEmail({ to: oEmail, subject, html });
            }
          }
        })
        .catch((err) =>
          console.error("Notification error (validate):", err.message),
        );
    }
  } catch (err) {
    console.error("Validate task error:", err);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to validate task" });
  }
});

// ---------------------------------------------------------------------------
// Proof review flow (off-chain, see services/reviewState.js)
// ---------------------------------------------------------------------------

async function notifyUser(userId, payload) {
  if (!userId) return;
  try {
    await supabase.from("notifications").insert({ user_id: userId, ...payload });
  } catch (err) {
    console.error("Notification error (review):", err.message);
  }
}

function reviewView(access, review) {
  const settled = access.task.validated || access.task.claimed;
  const open = access.task.completed && !settled && review.status !== "rejected";
  return {
    ...review,
    canResubmit: access.isOwner && open,
    canRequestProof: access.isValidator && open && review.status !== "needs_new_proof",
    canReject: access.isValidator && open && review.canReject,
  };
}

// Review state for a task: proofs so far, whether a new proof was requested, rejected or not.
router.get("/review/:taskId", requireAuthentication, async (req, res) => {
  try {
    const access = await requireTaskAccess(getUserId(req), req.params.taskId);
    const review = await getReviewState(Number(req.params.taskId), access.task.proofUrl);
    res.set("Cache-Control", "private, no-store");
    res.json({ review: reviewView(access, review) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to load review state" });
  }
});

// Owner uploads another proof after the first one (the contract only stores the first).
router.post("/resubmit-proof", requireAuthentication, async (req, res) => {
  try {
    const { taskId, proofUrl } = req.body;
    if (taskId === undefined || !proofUrl) return res.status(400).json({ error: "taskId and proofUrl are required" });
    if (!isOurStorageUrl(proofUrl)) return res.status(400).json({ error: "The proof must be uploaded through TaskStaker." });
    const access = await requireTaskAccess(getUserId(req), taskId, true);
    if (!access.task.completed) return res.status(400).json({ error: "Submit your first proof before sending another." });
    if (access.task.validated || access.task.claimed) return res.status(400).json({ error: "This task is already settled." });
    const review = await getReviewState(Number(taskId), access.task.proofUrl);
    if (review.status === "rejected") return res.status(409).json({ error: "This task was rejected by the validator." });
    if (review.proofs.some((p) => p.url === proofUrl)) return res.json({ success: true, alreadySubmitted: true });

    await addAttempt(Number(taskId), proofUrl);
    res.json({ success: true, proofCount: review.proofCount + 1 });

    Promise.resolve()
      .then(() => requestReport({ taskId: Number(taskId), taskName: access.task.name, proofUrl }))
      .catch((err) => console.error("AI report queue error:", err.message));
    const { data: owner } = await supabase.from("users").select("username").eq("id", access.user.id).maybeSingle();
    await notifyUser(access.assignment?.validator_user_id, {
      type: "proof_submitted",
      title: "New proof submitted",
      message: `@${owner?.username || "The owner"} sent proof #${review.proofCount + 1} for task #${taskId}. Review it and validate.`,
      task_id: Number(taskId),
    });
  } catch (err) {
    console.error("Resubmit proof error:", err.message);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to submit proof" });
  }
});

// Validator asks the owner for a better proof.
router.post("/request-proof", requireAuthentication, async (req, res) => {
  try {
    const { taskId, note } = req.body;
    if (taskId === undefined) return res.status(400).json({ error: "taskId is required" });
    const access = await requireTaskAccess(getUserId(req), taskId);
    if (!access.isValidator || access.isOwner) return res.status(403).json({ error: "Only the assigned validator can do this." });
    if (!access.task.completed || access.task.validated || access.task.claimed) {
      return res.status(400).json({ error: "This task is not waiting for review." });
    }
    const review = await getReviewState(Number(taskId), access.task.proofUrl);
    if (review.status === "rejected") return res.status(409).json({ error: "This task was rejected." });
    await addDecision(Number(taskId), "needs_new_proof", note);
    res.json({ success: true });
    await notifyUser(access.assignment?.owner_user_id, {
      type: "new_proof_requested",
      title: "Validator asked for a new proof",
      message: `The proof for task #${taskId} "${access.task.name}" was not enough. Upload a clearer one.`,
      task_id: Number(taskId),
    });
  } catch (err) {
    console.error("Request proof error:", err.message);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to request a new proof" });
  }
});

// Validator rejects the task. Only after the owner has sent at least 3 proofs.
router.post("/reject", requireAuthentication, async (req, res) => {
  try {
    const { taskId, note } = req.body;
    if (taskId === undefined) return res.status(400).json({ error: "taskId is required" });
    const access = await requireTaskAccess(getUserId(req), taskId);
    if (!access.isValidator || access.isOwner) return res.status(403).json({ error: "Only the assigned validator can reject." });
    if (!access.task.completed || access.task.validated || access.task.claimed) {
      return res.status(400).json({ error: "This task is not waiting for review." });
    }
    const review = await getReviewState(Number(taskId), access.task.proofUrl);
    if (review.status === "rejected") return res.json({ success: true, alreadyRejected: true });
    if (!review.canReject) {
      return res.status(400).json({ error: `You can reject after the owner has sent ${review.rejectAfter} proofs (${review.proofCount} so far).` });
    }
    await addDecision(Number(taskId), "rejected", note);
    res.json({ success: true });
    await notifyUser(access.assignment?.owner_user_id, {
      type: "task_rejected",
      title: "Task rejected",
      message: `The validator rejected task #${taskId} "${access.task.name}" after ${review.proofCount} proofs.`,
      task_id: Number(taskId),
    });
  } catch (err) {
    console.error("Reject task error:", err.message);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to reject the task" });
  }
});

// Owner acknowledges a missed deadline. forfeitStake can be called by anyone,
// so the backend relayer sends it: no wallet connection is needed.
router.post("/forfeit", requireAuthentication, async (req, res) => {
  try {
    const { taskId } = req.body;
    if (taskId === undefined) return res.status(400).json({ error: "taskId is required" });
    const access = await requireTaskAccess(getUserId(req), taskId, true);
    if (access.task.claimed) return res.json({ success: true, alreadySettled: true });
    if (access.task.completed) return res.status(400).json({ error: "Proof was submitted for this task, so it cannot be forfeited." });
    if (Math.floor(Date.now() / 1000) <= access.task.deadline.toNumber()) {
      return res.status(400).json({ error: "The deadline has not passed yet." });
    }
    const { txHash } = await relayForfeitStake(Number(taskId));
    res.json({ success: true, txHash });
  } catch (err) {
    console.error("Forfeit error:", err.message);
    res.status(err.status || 500).json({ error: err.status ? err.message : "Failed to apply the penalty" });
  }
});

/**
 * GET /api/tasks/assignments?taskIds=0,1,2,3
 * Returns validator and owner usernames for given task IDs.
 */
router.get("/assignments", requireAuthentication, async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  try {
    const { user } = await accountContext(getUserId(req));
    const { taskIds } = req.query;
    if (!taskIds) return res.json({ assignments: {} });

    const ids = taskIds
      .split(",")
      .map(Number)
      .filter((n) => !isNaN(n));
    if (!ids.length) return res.json({ assignments: {} });

    const { data, error } = await supabase
      .from("task_validators")
      .select(
        "task_id, validator_username, owner_username, validator_user_id, owner_user_id",
      )
      .in("task_id", ids)
      .or(`owner_user_id.eq.${user.id},validator_user_id.eq.${user.id}`);

    if (error) throw error;

    const assignments = {};
    (data || []).forEach((row) => {
      assignments[row.task_id] = {
        validatorUsername: row.validator_username,
        ownerUsername: row.owner_username,
        validatorUserId: row.validator_user_id,
        ownerUserId: row.owner_user_id,
      };
    });

    res.json({ assignments });
  } catch (err) {
    console.error("Get assignments error:", err);
    res.status(500).json({ error: "Failed to get assignments" });
  }
});

/**
 * GET /api/tasks/original-stakes?taskIds=0,1,2
 * Returns the original stake amounts for claimed/forfeited tasks by querying
 * FundsClaimed and StakeForfeited events. The contract zeroes task.stake on settle
 * so the only source of truth is the event log.
 */
router.get("/original-stakes", async (req, res) => {
  try {
    const { taskIds } = req.query;
    if (!taskIds) return res.json({ stakes: {} });

    const ids = taskIds
      .split(",")
      .map(Number)
      .filter((n) => !isNaN(n));
    if (!ids.length) return res.json({ stakes: {} });

    const abi = require("../../abi/TaskStakerV2.json").abi;
    // Use a public RPC for event log queries — Alchemy free tier only allows 10-block ranges
    const PUBLIC_RPC = "https://ethereum-sepolia-rpc.publicnode.com";
    const provider = new ethers.providers.JsonRpcProvider(PUBLIC_RPC);
    const readContract = new ethers.Contract(
      process.env.CONTRACT_ADDRESS,
      abi,
      provider,
    );

    // Query both settled event types in parallel
    const [claimedEvts, forfeitedEvts] = await Promise.all([
      readContract.queryFilter(readContract.filters.FundsClaimed()),
      readContract.queryFilter(readContract.filters.StakeForfeited()),
    ]);

    const stakes = {};
    const idSet = new Set(ids);
    [...claimedEvts, ...forfeitedEvts].forEach((e) => {
      const id = e.args.taskId.toNumber();
      if (idSet.has(id) && !stakes[id]) {
        stakes[id] = ethers.utils.formatEther(e.args.amount);
      }
    });

    res.json({ stakes });
  } catch (err) {
    console.error("Get original stakes error:", err.message);
    res.status(500).json({ error: "Failed to get original stakes" });
  }
});

module.exports = router;
