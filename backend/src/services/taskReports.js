/**
 * Task-level glue for proof analysis: fetch the stored proof, queue one
 * analysis at a time, and keep the latest report per task in ai_analyses.
 * Reports are advisory. Nothing here approves or rejects a task.
 */
const supabase = require("./supabase");
const { analyzeProofFile, enqueue, MAX_FILE_BYTES, SCORE_LABEL } = require("./proofAnalysis");

const PENDING_STALE_MS = 3 * 60 * 1000;
const FETCH_TIMEOUT_MS = 20000;

function isOurStorageUrl(url) {
  try {
    const u = new URL(url);
    const base = new URL(process.env.SUPABASE_URL);
    return u.protocol === "https:" && u.host === base.host && u.pathname.includes("/storage/v1/object/");
  } catch {
    return false;
  }
}

async function fetchProof(url) {
  if (!isOurStorageUrl(url)) return { error: "The proof is not stored in TaskStaker storage." };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal, redirect: "error" });
    if (!res.ok) return { error: "The proof file could not be downloaded." };
    const declared = Number(res.headers.get("content-length")) || 0;
    if (declared > MAX_FILE_BYTES) return { error: "The proof file is larger than 10 MB." };
    const buffer = Buffer.from(await res.arrayBuffer());
    const name = decodeURIComponent(new URL(url).pathname.split("/").pop() || "");
    return { file: { buffer, mime: res.headers.get("content-type") || "", name } };
  } catch {
    return { error: "The proof file could not be downloaded." };
  } finally {
    clearTimeout(timer);
  }
}

function unavailable(reason) {
  return {
    version: 2,
    kind: "proof_analysis",
    advisory: true,
    score_label: SCORE_LABEL,
    status: "unavailable",
    manual_review_required: true,
    reason: reason + " Please review the proof manually.",
    generated_at: new Date().toISOString(),
  };
}

async function latestRow(taskId) {
  const { data, error } = await supabase
    .from("ai_analyses")
    .select("id, analysis, created_at")
    .eq("task_id", Number(taskId))
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) throw error;
  // Older rows use the legacy chatbot shape. Only version 2 reports count here.
  return (data || []).find((r) => r.analysis && r.analysis.kind === "proof_analysis") || null;
}

/** Returns the latest report for a task: { status:'none' } when nothing exists. */
async function getReport(taskId) {
  const row = await latestRow(taskId);
  if (!row) return { status: "none" };
  const a = row.analysis;
  if (a.status === "pending" && Date.now() - new Date(row.created_at).getTime() > PENDING_STALE_MS) {
    return { ...unavailable("The analysis did not finish."), proof_url: a.proof_url };
  }
  return a;
}

/**
 * Queue an analysis for the task's current proof. Skips when the same proof
 * already has a pending or finished report, unless `force` is set and the
 * previous attempt did not complete.
 */
async function requestReport({ taskId, taskName, proofUrl, force = false }) {
  if (!proofUrl) return { status: "none" };
  let existing = null;
  try {
    existing = await latestRow(taskId);
  } catch (err) {
    console.warn("ai_analyses read failed:", err.message);
  }
  if (existing && existing.analysis.proof_url === proofUrl) {
    const a = existing.analysis;
    const fresh = Date.now() - new Date(existing.created_at).getTime() < PENDING_STALE_MS;
    if (a.status === "complete") return a;
    if (a.status === "pending" && fresh) return a;
    if (!force && a.status !== "pending") return a;
  }

  const pending = {
    version: 2,
    kind: "proof_analysis",
    advisory: true,
    score_label: SCORE_LABEL,
    status: "pending",
    proof_url: proofUrl,
    generated_at: new Date().toISOString(),
  };
  let rowId = null;
  try {
    const { data, error } = await supabase
      .from("ai_analyses")
      .insert({ task_id: Number(taskId), analysis: pending })
      .select("id")
      .single();
    if (error) throw error;
    rowId = data.id;
  } catch (err) {
    console.warn("ai_analyses insert failed:", err.message);
  }

  const finish = async (report) => {
    const final = { ...report, proof_url: proofUrl };
    if (rowId) {
      const { error } = await supabase.from("ai_analyses").update({ analysis: final }).eq("id", rowId);
      if (error) console.warn("ai_analyses update failed:", error.message);
    }
    return final;
  };

  enqueue(async () => {
    const fetched = await fetchProof(proofUrl);
    if (fetched.error) return finish(unavailable(fetched.error));
    const report = await analyzeProofFile({ taskName, file: fetched.file });
    return finish(report);
  }).catch(async (err) => {
    console.error("Proof analysis job failed:", err.message);
    await finish(unavailable("The analysis queue is busy."));
  });

  return pending;
}

module.exports = { getReport, requestReport, isOurStorageUrl, fetchProof };
