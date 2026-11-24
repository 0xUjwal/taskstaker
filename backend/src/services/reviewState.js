/**
 * Off-chain review state for a task's proofs.
 *
 * The contract accepts one proof per task and has no reject action, so extra
 * proofs, "ask for a new proof" and "reject" live here. Rows are stored in the
 * existing ai_analyses table with their own `kind`, so no new table is needed
 * and the AI report code (which only reads kind = proof_analysis) is unaffected.
 *
 *   kind proof_attempt   { proof_url }              extra proof after the on-chain one
 *   kind review_decision { decision, note }         needs_new_proof | rejected
 */
const supabase = require("./supabase");

const REJECT_AFTER_PROOFS = 3;

/** Pure: derive the review state from the on-chain proof and the stored rows (oldest first). */
function deriveReview(onChainProofUrl, rows) {
  const proofs = [];
  const add = (url, at) => {
    if (url && !proofs.some((p) => p.url === url)) proofs.push({ url, at: at || null });
  };
  add(onChainProofUrl, null);
  let lastAttemptIdx = -1;
  (rows || []).forEach((row, i) => {
    if (row.analysis?.kind === "proof_attempt") {
      add(row.analysis.proof_url, row.created_at);
      lastAttemptIdx = i;
    }
  });
  let decision = null;
  (rows || []).forEach((row, i) => {
    const a = row.analysis;
    if (a?.kind !== "review_decision") return;
    if (a.decision === "rejected") decision = { decision: "rejected", note: a.note || "", at: row.created_at };
    else if (a.decision === "needs_new_proof" && i > lastAttemptIdx && decision?.decision !== "rejected") {
      decision = { decision: "needs_new_proof", note: a.note || "", at: row.created_at };
    }
  });
  const count = proofs.length;
  return {
    proofCount: count,
    rejectAfter: REJECT_AFTER_PROOFS,
    proofs,
    currentProofUrl: proofs.length ? proofs[proofs.length - 1].url : "",
    status: decision?.decision || "under_review",
    note: decision?.note || "",
    canReject: count >= REJECT_AFTER_PROOFS && decision?.decision !== "rejected",
  };
}

async function loadRows(taskId) {
  const { data, error } = await supabase
    .from("ai_analyses")
    .select("analysis, created_at")
    .eq("task_id", Number(taskId))
    .order("created_at", { ascending: true })
    .limit(200);
  if (error) throw error;
  return data || [];
}

async function getReviewState(taskId, onChainProofUrl) {
  return deriveReview(onChainProofUrl, await loadRows(taskId));
}

async function addRow(taskId, analysis) {
  const { error } = await supabase.from("ai_analyses").insert({ task_id: Number(taskId), analysis });
  if (error) throw error;
}

const addAttempt = (taskId, proofUrl) =>
  addRow(taskId, { version: 2, kind: "proof_attempt", proof_url: proofUrl });
const addDecision = (taskId, decision, note) =>
  addRow(taskId, { version: 2, kind: "review_decision", decision, note: String(note || "").slice(0, 300) });

module.exports = { deriveReview, getReviewState, addAttempt, addDecision, REJECT_AFTER_PROOFS };
