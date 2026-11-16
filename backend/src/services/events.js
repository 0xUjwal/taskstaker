const { ethers } = require("ethers");
const supabase = require("./supabase");
const {
  sendEmail,
  deadlineApproachingEmail,
  deadlineMissedEmail,
} = require("./email");
const abi = require("../../abi/TaskStakerV2.json").abi;

let provider = null;
let contract = null;

function initEventListener() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!rpcUrl || !contractAddress) {
    console.warn("Event listener: Missing SEPOLIA_RPC_URL or CONTRACT_ADDRESS. Skipping.");
    return;
  }

  provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  contract = new ethers.Contract(contractAddress, abi, provider);

  // Listen for ProofSubmitted -> notify validator
  contract.on("ProofSubmitted", async (taskId, proofUrl) => {
    try {
      const task = await contract.getTask(taskId);
      const validatorAddr = task.validator.toLowerCase();

      const { data: validator } = await supabase
        .from("users")
        .select("id, username")
        .eq("wallet_address", validatorAddr)
        .single();

      if (validator) {
        await supabase.from("notifications").insert({
          user_id: validator.id,
          type: "proof_submitted",
          title: "Proof submitted for review",
          message: `Task #${taskId} "${task.name}" has submitted proof. Review and validate it.`,
          task_id: taskId.toNumber(),
        });
      }
    } catch (err) {
      console.error("ProofSubmitted event handler error:", err.message);
    }
  });

  // Listen for TaskValidated -> notify task owner
  contract.on("TaskValidated", async (taskId, validatorAddr) => {
    try {
      const task = await contract.getTask(taskId);
      const ownerAddr = task.user.toLowerCase();

      const { data: owner } = await supabase
        .from("users")
        .select("id, username")
        .eq("wallet_address", ownerAddr)
        .single();

      if (owner) {
        await supabase.from("notifications").insert({
          user_id: owner.id,
          type: "task_validated",
          title: "Task validated!",
          message: `Your task #${taskId} "${task.name}" has been validated. You can now claim your stake.`,
          task_id: taskId.toNumber(),
        });
      }
    } catch (err) {
      console.error("TaskValidated event handler error:", err.message);
    }
  });

  // Listen for TaskCreated -> notify validator
  contract.on("TaskCreated", async (taskId, user, validator, name, stake, deadline, token) => {
    try {
      const validatorAddr = validator.toLowerCase();

      const { data: validatorUser } = await supabase
        .from("users")
        .select("id, username, clerk_id")
        .eq("wallet_address", validatorAddr)
        .single();

      if (validatorUser) {
        const stakeEth = ethers.utils.formatEther(stake);
        await supabase.from("notifications").insert({
          user_id: validatorUser.id,
          type: "validation_needed",
          title: "New task assigned to you",
          message: `You've been assigned as validator for task #${taskId} "${name}" (${stakeEth} ETH staked).`,
          task_id: taskId.toNumber(),
        });
      }
    } catch (err) {
      console.error("TaskCreated event handler error:", err.message);
    }
  });

  // Listen for FundsClaimed -> sync completed_tasks count in Supabase + notify user
  contract.on("FundsClaimed", async (taskId, user, amount) => {
    try {
      const userAddr = user.toLowerCase();

      const { data: userData } = await supabase
        .from("users")
        .select("id, username, completed_tasks")
        .eq("wallet_address", userAddr)
        .single();

      if (userData) {
        const newCount = (userData.completed_tasks || 0) + 1;
        await supabase
          .from("users")
          .update({ completed_tasks: newCount })
          .eq("id", userData.id);

        const amountEth = ethers.utils.formatEther(amount);
        await supabase.from("notifications").insert({
          user_id: userData.id,
          type: "funds_claimed",
          title: "Stake claimed!",
          message: `You've claimed ${amountEth} ETH from task #${taskId}. Task #${newCount} complete!`,
          task_id: taskId.toNumber(),
        });

        console.log(`Updated completed_tasks for ${userData.username}: ${newCount}`);
      }
    } catch (err) {
      console.error("FundsClaimed event handler error:", err.message);
    }
  });

  console.log("Contract event listener started");
}

/**
 * Resolve the task owner from Supabase.
 * Checks task_validators first (covers embedded wallet users), then falls back
 * to matching by on-chain wallet address.
 */
async function findTaskOwner(taskId, walletAddr) {
  // task_validators lookup — works for embedded wallet owners with no linked wallet_address
  const { data: assignment } = await supabase
    .from("task_validators")
    .select("owner_user_id")
    .eq("task_id", taskId)
    .single();

  if (assignment?.owner_user_id) {
    const { data: user } = await supabase
      .from("users")
      .select("id, username, clerk_id")
      .eq("id", assignment.owner_user_id)
      .single();
    if (user) return user;
  }

  // Fallback: linked MetaMask wallet address
  const { data: user } = await supabase
    .from("users")
    .select("id, username, clerk_id")
    .eq("wallet_address", walletAddr)
    .single();
  return user || null;
}

async function getOwnerEmail(clerkId) {
  try {
    const { clerkClient } = require("@clerk/express");
    const user = await clerkClient.users.getUser(clerkId);
    return user?.emailAddresses?.[0]?.emailAddress || null;
  } catch {
    return null;
  }
}

// Check for approaching/missed deadlines every 5 minutes
function startDeadlineChecker() {
  const intervalMs = 5 * 60 * 1000;

  async function runCheck() {
    if (!contract) return;

    try {
      const taskCount = await contract.getTaskCount();
      const now = Math.floor(Date.now() / 1000);
      const oneHour = 3600;

      for (let i = 0; i < taskCount.toNumber(); i++) {
        const task = await contract.getTask(i);

        // Skip tasks that are already settled
        if (task.claimed) continue;

        const deadline = task.deadline.toNumber();

        // ── 1-hour warning ─────────────────────────────────────────────────
        if (!task.completed && deadline > now && deadline - now <= oneHour) {
          const owner = await findTaskOwner(i, task.user.toLowerCase());
          if (!owner) continue;

          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", owner.id)
            .eq("task_id", i)
            .eq("type", "deadline_approaching")
            .single();

          if (!existing) {
            const minutesLeft = Math.max(1, Math.round((deadline - now) / 60));

            await supabase.from("notifications").insert({
              user_id: owner.id,
              type: "deadline_approaching",
              title: "Deadline approaching!",
              message: `Task #${i} "${task.name}" deadline in ${minutesLeft} minutes. Submit proof now!`,
              task_id: i,
            });

            const email = await getOwnerEmail(owner.clerk_id);
            if (email) {
              const { subject, html } = deadlineApproachingEmail(
                task.name,
                i,
                owner.username,
                minutesLeft,
              );
              await sendEmail({ to: email, subject, html });
              console.log(
                `Sent deadline-approaching email to ${owner.username} for task #${i}`,
              );
            }
          }
        }

        // ── Deadline missed ─────────────────────────────────────────────────
        if (!task.completed && deadline <= now) {
          const owner = await findTaskOwner(i, task.user.toLowerCase());
          if (!owner) continue;

          const { data: existing } = await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", owner.id)
            .eq("task_id", i)
            .eq("type", "deadline_missed")
            .single();

          if (!existing) {
            await supabase.from("notifications").insert({
              user_id: owner.id,
              type: "deadline_missed",
              title: "Deadline passed — stake forfeited",
              message: `Task #${i} "${task.name}" deadline has passed. Your staked ETH has been forfeited.`,
              task_id: i,
            });

            const email = await getOwnerEmail(owner.clerk_id);
            if (email) {
              const { subject, html } = deadlineMissedEmail(
                task.name,
                i,
                owner.username,
              );
              await sendEmail({ to: email, subject, html });
              console.log(
                `Sent deadline-missed email to ${owner.username} for task #${i}`,
              );
            }
          }
        }
      }
    } catch (err) {
      console.error("Deadline checker error:", err.message);
    }
  }

  // Run immediately on startup, then every 5 minutes
  runCheck();
  setInterval(runCheck, intervalMs);
  console.log("Deadline checker started (runs now + every 5 minutes)");

  // Expose for manual trigger (used by debug route)
  return runCheck;
}

module.exports = { initEventListener, startDeadlineChecker };
