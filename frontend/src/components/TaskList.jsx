import { useState, useEffect, useCallback, useRef } from "react";
import {
  contract,
} from "../utils/web3";
import { uploadFile } from "../utils/storage";
import { useAuth } from "@clerk/clerk-react";
import { formatDistanceToNow, format } from "date-fns";
import {
  submitProofOffChain,
  validateTaskOffChain,
  getEthPrice,
  getMyTasks,
  getEmbeddedWalletInfo,
  claimFundsEmbedded,
} from "../utils/api";
import AIChatbot from "./AIChatbot";
import ProofReport from "./ProofReport";

function StakeDisplay({ ethAmount, ethPrice }) {
  const eth = parseFloat(ethAmount);
  if (isNaN(eth) || eth === 0) {
    return <span className="text-outline text-sm">—</span>;
  }
  return (
    <span className="leading-tight">
      {ethPrice ? (
        <>
          <span className="text-white font-bold text-base">
            ${(eth * ethPrice).toFixed(2)}
          </span>
          <span className="text-white/50 text-[11px] ml-1.5 font-label block">
            {eth.toFixed(4)} ETH
          </span>
        </>
      ) : (
        <span className="text-white font-bold">{eth.toFixed(4)} ETH</span>
      )}
    </span>
  );
}

export default function TaskList({
  userProfile,
  walletReady,
  onTaskClaimed,
  onDerivedCompletedTasks,
  taskCreateTick,
}) {
  const { getToken } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const inFlightRef = useRef(false);
  const [filter, setFilter] = useState("all");
  const [actionStates, setActionStates] = useState({});
  const [chatTask, setChatTask] = useState(null);
  const [ethPrice, setEthPrice] = useState(null);
  const [assignments, setAssignments] = useState({});
  const [embeddedAddress, setEmbeddedAddress] = useState("");
  const loadGenRef = useRef(0); // increments each loadTasks call; guards stale assignment updates

  useEffect(() => {
    getEthPrice()
      .then((d) => setEthPrice(d.usd))
      .catch(() => {});
    // Load embedded wallet address for claim routing
    getToken()
      .then((token) => getEmbeddedWalletInfo(token))
      .then((info) => {
        if (info?.address) setEmbeddedAddress(info.address.toLowerCase());
      })
      .catch(() => {});
  }, [getToken]);

  // Extract primitives so loadTasks doesn't re-fire when effectiveProfile wraps a new object
  const myUserId = userProfile?.id ?? null;

  const loadTasks = useCallback(async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    const gen = ++loadGenRef.current;
    try {
      setLoading(true);
      const token = await getToken();
      const { tasks: tasksData, assignments: ownAssignments } = await getMyTasks(token);
      if (gen !== loadGenRef.current) return;
      setLoadError("");
      setAssignments(ownAssignments || {});

      // Cache non-zero stakes to localStorage — contract zeroes task.stake on claim/forfeit.
      // This lets us restore the original amount for settled tasks without any RPC event queries.
      const STAKE_CACHE_KEY = `ts_task_stakes:${import.meta.env.VITE_CONTRACT_ADDRESS}:${myUserId}`;
      let stakeCache = {};
      try {
        stakeCache = JSON.parse(localStorage.getItem(STAKE_CACHE_KEY) || "{}");
      } catch {}

      let cacheUpdated = false;
      tasksData.forEach((t) => {
        const eth = parseFloat(t.stake);
        if (!t.claimed && eth > 0) {
          // Save stake while task is active
          if (stakeCache[t.id] !== t.stake) {
            stakeCache[t.id] = t.stake;
            cacheUpdated = true;
          }
        } else if (t.claimed && eth === 0 && stakeCache[t.id]) {
          // Restore original stake for settled task
          t.stake = stakeCache[t.id];
        }
      });
      if (cacheUpdated) {
        try {
          localStorage.setItem(STAKE_CACHE_KEY, JSON.stringify(stakeCache));
        } catch {}
      }

      const reversed = tasksData;
      setTasks(reversed);
      const immediateCompleted = reversed.filter(
        (t) => t.isOwner && t.claimed && t.validated,
      ).length;
      onDerivedCompletedTasks?.(immediateCompleted);

    } catch (err) {
      console.error("Error loading tasks:", err);
      if (gen === loadGenRef.current) {
        setTasks([]); setAssignments({});
        setLoadError("Couldn't load your tasks. Please refresh to try again.");
      }
    } finally {
      inFlightRef.current = false;
      if (gen === loadGenRef.current) setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getToken, myUserId, onDerivedCompletedTasks]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Auto-refresh every 7s so task states (proof submitted, validated, etc.) stay current
  useEffect(() => {
    const interval = setInterval(() => {
      loadTasks();
    }, 7000);
    return () => clearInterval(interval);
  // loadTasks is stable; re-registering only when it changes is correct
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadTasks]);

  // After a task is created, poll until the new task appears on-chain.
  // Embedded wallet path: tx is pending (~12-25s to confirm); MetaMask path: already confirmed.
  // Either way: immediate refresh + retry every 5s for up to 30s to catch the new task.
  const taskCreateTickRef = useRef(0);
  useEffect(() => {
    if (taskCreateTick === 0 || taskCreateTick === taskCreateTickRef.current)
      return;
    taskCreateTickRef.current = taskCreateTick;

    loadTasks(); // immediate attempt

    let tries = 0;
    const poll = setInterval(() => {
      tries++;
      loadTasks();
      if (tries >= 6) clearInterval(poll); // 6 × 5s = 30s total
    }, 5000);

    return () => clearInterval(poll);
  // loadTasks is stable (useCallback with primitive deps)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskCreateTick]);

  const updateActionState = (id, updates) =>
    setActionStates((prev) => ({ ...prev, [id]: { ...prev[id], ...updates } }));

  // Off-chain proof upload — relayer submits on-chain, with fallback to user wallet for old contracts
  const handleUploadProof = async (task, file) => {
    if (!file) return;
    try {
      updateActionState(task.id, {
        loading: true,
        statusText: "Uploading file...",
        error: "",
      });
      const token = await getToken();
      const result = await uploadFile(file, token);

      updateActionState(task.id, { statusText: "Submitting proof..." });
      const response = await submitProofOffChain(token, {
        taskId: task.id,
        proofUrl: result.url,
        taskName: task.name,
      });

      if (response.needsWallet) {
        updateActionState(task.id, {
          error:
            "Proof upload needs owner signature for this external-wallet task. For gasless proof uploads, create tasks using the embedded wallet mode.",
          loading: false,
        });
        return;
      }

      updateActionState(task.id, { loading: false, showUploader: false });
      loadTasks();
    } catch (err) {
      console.error(err);
      const raw = err.message || "Failed to submit proof";
      let friendly = raw;

      if (
        raw.includes("CALL_EXCEPTION") ||
        raw.toLowerCase().includes("reverted on-chain")
      ) {
        friendly =
          "Proof transaction was reverted. If status already shows Proof Submitted, refresh tasks and continue.";
      }

      updateActionState(task.id, { error: friendly, loading: false, showUploader: false });
    }
  };

  // Validate — always goes through backend relayer (works for both new and legacy tasks)
  // Backend verifies auth via task_validators table OR on-chain validator address
  const handleValidate = async (task) => {
    try {
      updateActionState(task.id, {
        loading: true,
        statusText: "Validating...",
      });
      const token = await getToken();
      await validateTaskOffChain(token, {
        taskId: task.id,
        taskName: task.name,
      });
      updateActionState(task.id, { loading: false });
      loadTasks();
    } catch (err) {
      updateActionState(task.id, {
        error: err.message || "Validation failed",
        loading: false,
      });
    }
  };

  const handleClaim = async (task) => {
    const taskId = task.id;
    const taskOwnerAddr = task.user.toLowerCase();
    // Use embedded wallet claim if task was created with the embedded wallet
    const useEmbedded = embeddedAddress && taskOwnerAddr === embeddedAddress;

    if (!useEmbedded && (!walletReady || !contract)) {
      updateActionState(taskId, {
        error:
          "Connect MetaMask to claim — this task was created with an external wallet.",
      });
      return;
    }

    try {
      updateActionState(taskId, {
        loading: true,
        statusText: "Claiming funds...",
      });

      if (useEmbedded) {
        const token = await getToken();
        await claimFundsEmbedded(token, { taskId });
        updateActionState(taskId, { loading: false });
        // Wait a moment for backend to confirm, then refresh
        setTimeout(() => {
          loadTasks();
          onTaskClaimed?.();
        }, 3000);
        return;
      }

      // MetaMask path — delay profile refresh so backend event listener has time to update completed_tasks
      const tx = await contract.claimFunds(taskId);
      await tx.wait();
      updateActionState(taskId, { loading: false });
      loadTasks();
      setTimeout(() => onTaskClaimed?.(), 2500);
    } catch (err) {
      updateActionState(taskId, {
        error: err.reason || err.message,
        loading: false,
      });
    }
  };

  const handleForfeit = async (taskId) => {
    if (!walletReady || !contract) {
      updateActionState(taskId, {
        error: "Connect your wallet to acknowledge penalty",
      });
      return;
    }
    try {
      updateActionState(taskId, { loading: true, statusText: "Processing..." });
      const tx = await contract.forfeitStake(taskId);
      await tx.wait();
      updateActionState(taskId, { loading: false });
      loadTasks();
    } catch (err) {
      updateActionState(taskId, {
        error: err.reason || err.message,
        loading: false,
      });
    }
  };

  const filteredTasks = tasks.filter((t) => {
    const tIsOwner = t.isOwner;
    const tIsValidator = t.isValidator;
    if (!tIsOwner && !tIsValidator) return false;

    if (filter === "mine") return tIsOwner;
    if (filter === "validate") return tIsValidator;
    if (filter === "actionable") {
      const needsProof = tIsOwner && !t.completed && Date.now() <= t.deadline;
      const needsValidation = tIsValidator && t.completed && !t.validated;
      const needsClaim = tIsOwner && t.validated && !t.claimed;
      const needsForfeit =
        tIsOwner && !t.completed && Date.now() > t.deadline && !t.claimed;
      return needsProof || needsValidation || needsClaim || needsForfeit;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Filter Bar */}
      <div className="flex items-start gap-2 glass-card p-2 sm:p-3">
        <div className="grid grid-cols-2 sm:flex flex-1 min-w-0 gap-1.5">
          {[
            { key: "all", label: "My activity" },
            { key: "mine", label: "My Tasks" },
            { key: "validate", label: "To Validate" },
            { key: "actionable", label: "Actionable" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-label font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                filter === f.key
                  ? "bg-primary/15 text-primary border border-primary/25 shadow-glow-primary"
                  : "text-on-surface-variant hover:bg-white/5"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <button
          onClick={loadTasks} aria-label="Refresh tasks"
          className="p-1.5 hover:bg-surface-variant/50 rounded-lg transition-colors"
        >
          <span
            className={`material-symbols-outlined text-on-surface-variant text-lg ${
              loading ? "animate-spin" : ""
            }`}
          >
            refresh
          </span>
        </button>
      </div>

      {loadError && <p role="alert" className="glass-card p-4 text-primary text-sm">{loadError}</p>}
      {loadError ? null : loading && tasks.length === 0 ? (
        <div className="text-center py-16 text-on-surface-variant">
          <div className="mx-auto w-10 h-10 rounded-full crimson-gradient animate-pulse shadow-[0_0_20px_rgba(255,59,48,0.4)] mb-4" />
          <span className="text-sm font-label uppercase tracking-widest">
            Loading tasks...
          </span>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="glass-card p-10 text-center">
          <span className="material-symbols-outlined text-outline text-4xl mb-2 block">
            inbox
          </span>
          <p className="text-sm text-on-surface-variant">No tasks found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map((task) => {
            const now = Date.now();
            const isExpired = now > task.deadline;
            const state = actionStates[task.id] || {};
            const assignment = assignments[task.id];
            const isOwner = task.isOwner;
            const validatorUsername =
              assignment?.validatorUsername ||
              (task.isLegacyTask &&
              task.validator !== "0x0000000000000000000000000000000000000000"
                ? `${task.validator.slice(0, 6)}...${task.validator.slice(-4)}`
                : null);
            const ownerUsername = assignment?.ownerUsername;

            const isAssignedValidator = task.isValidator;

            let statusColor = "text-primary bg-primary/10 border-primary/20";
            let statusLabel = formatDistanceToNow(task.deadline, {
              addSuffix: true,
            });
            let borderColor = "border-l-primary";

            if (task.claimed && task.validated) {
              statusColor = "text-tertiary bg-tertiary/10 border-tertiary/20";
              statusLabel = "Completed";
              borderColor = "border-l-tertiary";
            } else if (task.claimed) {
              statusColor = "text-zinc-100 bg-zinc-900/90 border-zinc-700/70";
              statusLabel = "Forfeited";
              borderColor = "border-l-zinc-700";
            } else if (task.validated) {
              statusColor = "text-tertiary bg-tertiary/10 border-tertiary/20";
              statusLabel = "Validated — Claim Ready";
              borderColor = "border-l-tertiary";
            } else if (task.completed) {
              statusColor = "text-info bg-info/10 border-info/20";
              statusLabel = "Proof Submitted";
              borderColor = "border-l-info";
            } else if (isExpired) {
              statusColor = "text-error bg-error/10 border-error/20";
              statusLabel = "Missed Deadline";
              borderColor = "border-l-error";
            }

            return (
              <div
                key={task.id}
                className={`glass-card glass-card-hover overflow-hidden border-l-4 ${borderColor} animate-fade-up`}
              >
                {/* Header row */}
                <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`inline-flex items-center gap-1.5 text-[10px] font-label font-bold px-2 py-0.5 rounded-full border uppercase tracking-widest ${statusColor}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
                      {statusLabel}
                    </span>
                    {isOwner && (
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded border border-primary/20 font-label uppercase tracking-wider">
                        Yours
                      </span>
                    )}
                    {isAssignedValidator && (
                      <span className="text-[10px] font-bold text-info bg-info/10 px-1.5 py-0.5 rounded border border-info/20 font-label uppercase tracking-wider">
                        Validator
                      </span>
                    )}
                    {task.isLegacyTask && (
                      <span className="text-[10px] font-bold text-outline bg-surface-container-highest px-1.5 py-0.5 rounded border border-outline/20 font-label uppercase tracking-wider">
                        Legacy
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-outline font-mono flex-shrink-0">
                    #{task.id}
                  </span>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                  {/* Task name — prominent box with icon */}
                  <div className="flex items-center gap-2.5 bg-white/5 border border-white/10 rounded-lg px-3.5 py-2.5">
                    <span
                      className="material-symbols-outlined text-primary flex-shrink-0"
                      style={{
                        fontSize: "18px",
                        fontVariationSettings: "'FILL' 1",
                      }}
                    >
                      task_alt
                    </span>
                    <h4 className="font-headline font-bold text-white leading-snug">
                      {task.name}
                    </h4>
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2.5">
                      <span className="text-on-surface-variant font-label uppercase tracking-widest text-[10px]">
                        Stake
                      </span>
                      <div className="mt-0.5">
                        <StakeDisplay ethAmount={task.stake} ethPrice={ethPrice} />
                      </div>
                      {task.claimed && (
                        <span className={`text-[10px] font-label font-bold uppercase tracking-wider mt-1 block ${
                          task.validated ? "text-green-400" : "text-error/70"
                        }`}>
                          {task.validated ? "✓ Claimed" : "✗ Forfeited"}
                        </span>
                      )}
                    </div>
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2.5">
                      <span className="text-on-surface-variant font-label uppercase tracking-widest text-[10px]">
                        Deadline
                      </span>
                      <p className="font-headline font-bold text-white mt-0.5 text-sm">
                        {format(task.deadline, "MMM d, HH:mm")}
                      </p>
                    </div>
                  </div>

                  {/* Validator / owner info */}
                  <div className="flex gap-4 text-[11px] font-label flex-wrap">
                    {assignment?.ownerUserId && assignment.ownerUserId === assignment.validatorUserId && (
                      <p className="text-xs text-warning mt-2">Historical self-assignment. New tasks require a different reviewer.</p>
                    )}
                    {validatorUsername && (
                      <span className="text-on-surface-variant">
                        Validator:{" "}
                        <span className="text-white/80 font-bold">
                          {validatorUsername.startsWith("0x")
                            ? validatorUsername
                            : `@${validatorUsername}`}
                        </span>
                      </span>
                    )}
                    {ownerUsername && !isOwner && (
                      <span className="text-on-surface-variant">
                        Owner:{" "}
                        <span className="text-white/80 font-bold">
                          @{ownerUsername}
                        </span>
                      </span>
                    )}
                  </div>

                  {/* Proof link */}
                  {task.proofUrl && (
                    <div className="flex items-center justify-between bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2">
                      <span className="text-[10px] font-label font-bold text-on-surface-variant uppercase tracking-widest flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-sm text-tertiary">
                          attach_file
                        </span>
                        Proof Attached
                      </span>
                      <a
                        href={task.proofUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs font-label font-bold text-primary hover:text-primary-dim transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">
                          open_in_new
                        </span>
                        View
                      </a>
                    </div>
                  )}

                  {/* AI advisory report: validator and owner, once proof exists */}
                  {task.completed && task.proofUrl && (isAssignedValidator || isOwner) && (
                    <ProofReport
                      taskId={task.id}
                      getToken={getToken}
                      defaultOpen={isAssignedValidator && !task.validated}
                    />
                  )}

                  {/* Validator side: waiting for proof */}
                  {isAssignedValidator && !task.completed && !task.claimed && (
                    <div className={`flex items-center gap-2 rounded-lg px-3 py-2.5 border ${
                      isExpired
                        ? "bg-error/5 border-error/20"
                        : "bg-white/[0.03] border-white/5"
                    }`}>
                      <span className="material-symbols-outlined text-on-surface-variant text-base">
                        {isExpired ? "timer_off" : "hourglass_top"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] text-on-surface-variant font-label">
                          {isExpired
                            ? "Deadline passed — proof was not submitted"
                            : `Waiting for${ownerUsername ? ` @${ownerUsername}` : " task owner"} to submit proof`}
                        </span>
                        {!isExpired && (
                          <p className="text-[10px] text-outline mt-0.5 font-label">
                            Validate button appears once proof is confirmed on-chain (~15s after upload)
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="px-4 py-3 bg-black/20 border-t border-white/[0.06]">
                  {state.loading ? (
                    <div className="flex items-center justify-center gap-2 text-primary text-sm font-label py-1">
                      <span className="material-symbols-outlined text-lg animate-spin">
                        progress_activity
                      </span>
                      {state.statusText || "Processing..."}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {state.error && (
                        <div className="flex items-start gap-2 bg-error/5 border border-error/20 rounded-lg px-3 py-2">
                          <span className="material-symbols-outlined text-error text-sm flex-shrink-0 mt-0.5">
                            error_outline
                          </span>
                          <p className="text-xs text-error font-label leading-snug">
                            {state.error}
                          </p>
                        </div>
                      )}

                      {/* Owner: submit proof */}
                      {isOwner &&
                        !task.completed &&
                        !isExpired &&
                        (state.showUploader ? (
                          <div className="flex bg-black/30 rounded-lg overflow-hidden border border-primary/20">
                            <input
                              type="file"
                              id={`file-${task.id}`}
                              className="sr-only"
                              aria-label={`Upload proof for task ${task.id}`}
                              onChange={(e) =>
                                handleUploadProof(task, e.target.files[0])
                              }
                            />
                            <label
                              htmlFor={`file-${task.id}`}
                              className="flex-1 text-center py-2.5 text-xs font-label font-bold text-primary hover:bg-primary/5 cursor-pointer flex items-center justify-center gap-1.5 uppercase tracking-wider"
                            >
                              <span className="material-symbols-outlined text-sm">
                                cloud_upload
                              </span>
                              Select & Upload File
                            </label>
                            <button
                              onClick={() =>
                                updateActionState(task.id, {
                                  showUploader: false,
                                })
                              }
                              className="px-3 border-l border-outline-variant/20 text-outline hover:text-on-surface transition-colors text-sm"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              onClick={() =>
                                updateActionState(task.id, {
                                  showUploader: true,
                                })
                              }
                              className="flex-1 flex items-center justify-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-label font-bold py-2.5 rounded-lg transition-colors border border-primary/20 uppercase tracking-wider"
                            >
                              <span className="material-symbols-outlined text-sm">
                                cloud_upload
                              </span>
                              Submit Proof
                            </button>
                            <button
                              onClick={() => setChatTask(task)}
                              className="flex items-center gap-1.5 bg-surface-container-highest hover:bg-surface-bright text-on-surface-variant text-xs font-label font-bold py-2.5 px-3 rounded-lg transition-colors border border-outline-variant/20"
                              title="AI Analysis"
                            >
                              <span className="material-symbols-outlined text-sm">
                                auto_awesome
                              </span>
                            </button>
                          </div>
                        ))}

                      {/* Validator: validate */}
                      {isAssignedValidator &&
                        task.completed &&
                        !task.validated && (
                          <div className="space-y-1.5">
                          <p className="text-[10px] text-tertiary font-label flex items-center gap-1">
                            <span className="material-symbols-outlined text-xs">check_circle</span>
                            Proof confirmed on-chain — ready to validate
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleValidate(task)}
                              className="flex-1 flex items-center justify-center gap-1.5 bg-tertiary/10 hover:bg-tertiary/20 text-tertiary text-xs font-label font-bold py-2.5 rounded-lg transition-colors border border-tertiary/25 hover:shadow-glow-tertiary uppercase tracking-wider"
                            >
                              <span className="material-symbols-outlined text-sm">
                                verified_user
                              </span>
                              Validate Task
                            </button>
                            <button
                              onClick={() => setChatTask(task)}
                              className="flex items-center gap-1.5 bg-surface-container-highest hover:bg-surface-bright text-on-surface-variant text-xs font-label font-bold py-2.5 px-3 rounded-lg transition-colors border border-outline-variant/20"
                              title="AI Analysis"
                            >
                              <span className="material-symbols-outlined text-sm">
                                auto_awesome
                              </span>
                            </button>
                          </div>
                          </div>
                        )}

                      {/* Owner: claim */}
                      {isOwner && task.validated && !task.claimed && (
                        <button
                          onClick={() => handleClaim(task)}
                          className="w-full flex items-center justify-center gap-1.5 btn-primary text-xs font-label font-bold py-3 rounded-lg uppercase tracking-wider"
                        >
                          <span className="material-symbols-outlined text-sm">
                            payments
                          </span>
                          {embeddedAddress &&
                          task.user.toLowerCase() === embeddedAddress
                            ? "Claim Stake"
                            : walletReady
                            ? "Claim via MetaMask"
                            : "Connect MetaMask to Claim"}
                        </button>
                      )}

                      {/* Owner: forfeit */}
                      {isOwner &&
                        !task.completed &&
                        isExpired &&
                        !task.claimed && (
                          <button
                            onClick={() => handleForfeit(task.id)}
                            className="w-full flex items-center justify-center gap-1.5 bg-error/10 hover:bg-error/20 text-error text-xs font-label font-bold py-2.5 rounded-lg transition-colors border border-error/20 uppercase tracking-wider"
                          >
                            <span className="material-symbols-outlined text-sm">
                              gavel
                            </span>
                            Acknowledge Penalty
                          </button>
                        )}

                      {/* Settled */}
                      {task.claimed && (
                        <p className="text-center text-xs font-label text-outline flex items-center justify-center gap-1.5 uppercase tracking-widest py-1">
                          <span
                            className="material-symbols-outlined text-sm"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            check_circle
                          </span>
                          Stake settled
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {chatTask && (
        <AIChatbot task={chatTask} onClose={() => setChatTask(null)} />
      )}
    </div>
  );
}
