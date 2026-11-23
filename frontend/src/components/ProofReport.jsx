import { useState, useEffect, useRef, useCallback } from "react";
import { getProofReport, rerunProofReport } from "../utils/api";

const POLL_MS = 4000;
const MAX_POLLS = 50; // about 3 minutes, then show the manual review message

const STATUS_STYLE = {
  supported: { icon: "check_circle", color: "text-tertiary", label: "Supported" },
  contradicted: { icon: "cancel", color: "text-error", label: "Contradicted" },
  unclear: { icon: "help", color: "text-yellow-400", label: "Unclear" },
};
const SEVERITY_STYLE = {
  high: "border-error/30 bg-error/10 text-error",
  medium: "border-yellow-400/30 bg-yellow-400/10 text-yellow-300",
  low: "border-white/10 bg-white/[0.04] text-on-surface-variant",
};

function scoreColor(score) {
  if (score >= 70) return "text-tertiary";
  if (score >= 40) return "text-yellow-400";
  return "text-error";
}

// Advisory AI report for a submitted proof. It never approves or rejects.
export default function ProofReport({ taskId, getToken, defaultOpen = true }) {
  const [report, setReport] = useState(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState(defaultOpen);
  const [retrying, setRetrying] = useState(false);
  const polls = useRef(0);
  const timer = useRef(null);
  const alive = useRef(true);
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const load = useCallback(async () => {
    try {
      const token = await getTokenRef.current();
      const { report: r } = await getProofReport(token, taskId);
      if (!alive.current) return;
      setError(false);
      setReport(r);
      const waiting = r?.status === "pending" || r?.status === "none";
      if (waiting && polls.current < MAX_POLLS) {
        polls.current += 1;
        timer.current = setTimeout(load, POLL_MS);
      }
    } catch {
      if (alive.current) setError(true);
    }
  }, [taskId]);

  useEffect(() => {
    alive.current = true;
    polls.current = 0;
    load();
    return () => {
      alive.current = false;
      clearTimeout(timer.current);
    };
  }, [load]);

  const retry = async () => {
    setRetrying(true);
    try {
      const token = await getTokenRef.current();
      const { report: r } = await rerunProofReport(token, taskId);
      polls.current = 0;
      setReport(r);
      setError(false);
      clearTimeout(timer.current);
      timer.current = setTimeout(load, POLL_MS);
    } catch {
      setError(true);
    } finally {
      setRetrying(false);
    }
  };

  const status = report?.status;
  const waiting = !error && (!report || status === "pending" || status === "none") && polls.current < MAX_POLLS;
  const needsManual = error || status === "unsupported" || status === "unavailable" || (!waiting && status !== "complete");

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.04]" data-testid="proof-report">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-left"
        aria-expanded={open}
      >
        <span className="text-[10px] font-label font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">auto_awesome</span>
          AI advisory report
        </span>
        <span className="flex items-center gap-2">
          {status === "complete" && (
            <span className={`text-sm font-bold ${scoreColor(report.evidence_support_score)}`}>
              {report.evidence_support_score}/100
            </span>
          )}
          <span className="material-symbols-outlined text-sm text-on-surface-variant">
            {open ? "expand_less" : "expand_more"}
          </span>
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2.5">
          <p className="text-[10px] text-outline font-label leading-snug">
            Advisory only. The AI cannot approve or reject. Check the original proof and decide yourself.
          </p>

          {waiting && (
            <div className="flex items-center gap-2 text-xs text-on-surface-variant font-label">
              <span className="material-symbols-outlined text-base animate-spin">progress_activity</span>
              Analyzing the proof...
            </div>
          )}

          {needsManual && (
            <div className="rounded-md border border-yellow-400/25 bg-yellow-400/5 px-3 py-2 space-y-1.5">
              <p className="text-xs text-yellow-200 font-label leading-snug">
                {error
                  ? "The AI report could not be loaded. Please review the proof manually."
                  : report?.reason || "AI analysis did not finish. Please review the proof manually."}
              </p>
              {status !== "unsupported" && (
                <button
                  type="button"
                  onClick={retry}
                  disabled={retrying}
                  className="text-[11px] font-label font-bold text-primary hover:text-primary-dim disabled:opacity-50"
                >
                  {retrying ? "Retrying..." : "Retry analysis"}
                </button>
              )}
            </div>
          )}

          {status === "complete" && (
            <>
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest">
                    Evidence support
                  </span>
                  <span className={`text-lg font-bold ${scoreColor(report.evidence_support_score)}`}>
                    {report.evidence_support_score}
                    <span className="text-xs text-outline">/100</span>
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden mt-1">
                  <div
                    className={`h-full ${report.evidence_support_score >= 70 ? "bg-tertiary" : report.evidence_support_score >= 40 ? "bg-yellow-400" : "bg-error"}`}
                    style={{ width: `${report.evidence_support_score}%` }}
                  />
                </div>
                <p className="text-[10px] text-outline font-label mt-1 leading-snug">
                  How well the proof supports the task. It does not show the proof is authentic.
                </p>
              </div>

              <p className="text-xs text-white/85 leading-snug">{report.validator_summary}</p>

              {report.criteria?.length > 0 && (
                <ul className="space-y-1.5">
                  {report.criteria.map((c, i) => {
                    const st = STATUS_STYLE[c.status] || STATUS_STYLE.unclear;
                    return (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <span className={`material-symbols-outlined text-base flex-shrink-0 ${st.color}`} title={st.label}>
                          {st.icon}
                        </span>
                        <span className="leading-snug">
                          <span className="text-white/90">{c.criterion}</span>
                          <span className={`ml-1 font-bold ${st.color}`}>({st.label})</span>
                          {c.evidence && <span className="block text-on-surface-variant">{c.evidence}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}

              {report.flags?.length > 0 && (
                <div className="space-y-1">
                  {report.flags.map((f, i) => (
                    <div key={i} className={`rounded-md border px-2 py-1.5 text-[11px] leading-snug ${SEVERITY_STYLE[f.severity] || SEVERITY_STYLE.low}`}>
                      <span className="font-bold uppercase mr-1">{f.severity}</span>
                      {f.reason}
                    </div>
                  ))}
                </div>
              )}

              {report.missing_evidence?.length > 0 && (
                <div>
                  <p className="text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest mb-0.5">
                    Missing evidence
                  </p>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-on-surface-variant">
                    {report.missing_evidence.map((m, i) => (
                      <li key={i}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
