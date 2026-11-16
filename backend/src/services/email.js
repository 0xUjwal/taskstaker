/**
 * Email notification service.
 * Uses Resend (https://resend.com) if RESEND_API_KEY is configured.
 * Falls back to console logging if not set up.
 */

async function sendEmail({ to, subject, html }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[Email] No RESEND_API_KEY — would send to ${to}: ${subject}`);
    return;
  }

  const from = process.env.EMAIL_FROM || "TaskStaker <noreply@taskstaker.app>";
  console.log(`[Email] Sending to ${to} | from: ${from} | subject: ${subject}`);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(`[Email] Resend rejected (${res.status}):`, JSON.stringify(body));
    } else {
      console.log(`[Email] Sent OK — id: ${body.id}`);
    }
  } catch (err) {
    console.error("[Email] Network error:", err.message);
  }
}

function proofSubmittedEmail(taskName, taskId, validatorUsername) {
  return {
    subject: `[TaskStaker] Proof submitted for "${taskName}"`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto">
        <h2 style="color:#FF3B30">Proof submitted — action required</h2>
        <p>Hi ${validatorUsername},</p>
        <p>A task you're validating has submitted proof of completion:</p>
        <div style="background:#1B1B1B;color:#fff;padding:16px;border-radius:8px;border-left:4px solid #FF3B30">
          <strong>Task #${taskId}:</strong> ${taskName}
        </div>
        <p>Log in to TaskStaker to review the proof and validate or reject it.</p>
        <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/dashboard"
           style="display:inline-block;background:#FF3B30;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px">
          Review Proof
        </a>
        <p style="color:#666;font-size:12px;margin-top:24px">
          You're receiving this because you're assigned as a validator on TaskStaker.
        </p>
      </div>
    `,
  };
}

function taskValidatedEmail(taskName, taskId, ownerUsername) {
  return {
    subject: `[TaskStaker] Your task "${taskName}" was validated!`,
    html: `
      <div style="font-family:sans-serif;max-width:500px;margin:auto">
        <h2 style="color:#FF3B30">Task validated — claim your stake!</h2>
        <p>Hi ${ownerUsername},</p>
        <p>Great news! Your task has been validated:</p>
        <div style="background:#1B1B1B;color:#fff;padding:16px;border-radius:8px;border-left:4px solid #22c55e">
          <strong>Task #${taskId}:</strong> ${taskName}
        </div>
        <p>You can now claim your staked ETH back.</p>
        <a href="${process.env.FRONTEND_URL || "http://localhost:5173"}/dashboard"
           style="display:inline-block;background:#FF3B30;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px">
          Claim Stake
        </a>
      </div>
    `,
  };
}

function deadlineApproachingEmail(taskName, taskId, ownerUsername, minutesLeft) {
  const dashboardUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  return {
    subject: `[TaskStaker] Less than 1 hour left — "${taskName}"`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#111;color:#f5f5f5;border-radius:12px;overflow:hidden">
        <div style="background:linear-gradient(135deg,#FF3B30,#c0392b);padding:28px 32px">
          <h2 style="margin:0;font-size:22px;color:#fff;letter-spacing:-0.3px">
            ⏰ Your deadline is in ${minutesLeft} minutes
          </h2>
        </div>
        <div style="padding:28px 32px">
          <p style="margin:0 0 8px;color:#aaa;font-size:14px">Hi @${ownerUsername},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#ddd">
            Your staked task is about to expire. You have <strong style="color:#FF3B30">${minutesLeft} minutes</strong> to
            submit your proof of completion and get it validated — or your stake is forfeited.
          </p>

          <div style="background:#1e1e1e;border-left:4px solid #FF3B30;border-radius:6px;padding:16px 20px;margin-bottom:24px">
            <span style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888">Task #${taskId}</span>
            <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#fff">${taskName}</p>
          </div>

          <p style="margin:0 0 24px;font-size:14px;color:#aaa;line-height:1.6">
            Head to your dashboard now, upload your proof, and make sure your validator is ready to approve it.
            Every minute counts.
          </p>

          <a href="${dashboardUrl}/dashboard"
             style="display:inline-block;background:#FF3B30;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;letter-spacing:0.3px">
            Submit Proof Now →
          </a>

          <p style="margin:28px 0 0;color:#555;font-size:11px">
            You're receiving this because you have an active staked task on TaskStaker.
          </p>
        </div>
      </div>
    `,
  };
}

function deadlineMissedEmail(taskName, taskId, ownerUsername) {
  const dashboardUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  return {
    subject: `[TaskStaker] Your stake on "${taskName}" has been forfeited`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;background:#111;color:#f5f5f5;border-radius:12px;overflow:hidden">
        <div style="background:#1a1a1a;border-bottom:1px solid #2a2a2a;padding:28px 32px">
          <h2 style="margin:0;font-size:22px;color:#fff;letter-spacing:-0.3px">
            Deadline passed! Stake forfeited.
          </h2>
        </div>
        <div style="padding:28px 32px">
          <p style="margin:0 0 8px;color:#aaa;font-size:14px">Hi @${ownerUsername},</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#ddd">
            The deadline for your staked task has passed without a validated proof submission.
            Your stake has been forfeited as agreed when you created the task.
          </p>

          <div style="background:#1e1e1e;border-left:4px solid #555;border-radius:6px;padding:16px 20px;margin-bottom:24px">
            <span style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#888">Task #${taskId}</span>
            <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#fff">${taskName}</p>
          </div>

          <p style="margin:0 0 16px;font-size:14px;color:#aaa;line-height:1.6">
            This is how TaskStaker works, real commitments, real consequences. That's what makes the wins meaningful too.
          </p>
          <p style="margin:0 0 24px;font-size:14px;color:#aaa;line-height:1.6">
            Use this as a data point, not a defeat. Reflect on what got in the way, set a more realistic deadline next time,
            and come back stronger. Your next task is waiting.
          </p>

          <a href="${dashboardUrl}/dashboard"
             style="display:inline-block;background:#2a2a2a;color:#fff;padding:13px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;border:1px solid #444;letter-spacing:0.3px">
            Acknowledge &amp; Continue →
          </a>

          <p style="margin:28px 0 0;color:#555;font-size:11px">
            You're receiving this because you had an active staked task on TaskStaker.
          </p>
        </div>
      </div>
    `,
  };
}

module.exports = {
  sendEmail,
  proofSubmittedEmail,
  taskValidatedEmail,
  deadlineApproachingEmail,
  deadlineMissedEmail,
};
