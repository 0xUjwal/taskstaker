import { useState, useEffect } from "react";
import { contract, parseEther } from "../utils/web3";
import {
  resolveUser,
  getEthPrice,
  getConfig,
  assignValidator,
  createTaskEmbedded,
  getEmbeddedWalletInfo,
} from "../utils/api";
import { useAuth } from "@clerk/clerk-react";

export default function CreateTask({
  userProfile,
  walletReady,
  walletLoading,
  walletError,
  onConnectWallet,
  onTaskCreated,
}) {
  const { getToken } = useAuth();
  const [name, setName] = useState("");
  const [hours, setHours] = useState("");
  const [stakeUsd, setStakeUsd] = useState("");
  const [stakeEth, setStakeEth] = useState("");
  const [ethPrice, setEthPrice] = useState(null);
  const [relayerAddress, setRelayerAddress] = useState("");
  const [embeddedWallet, setEmbeddedWallet] = useState(null); // { address, balanceEth }
  const [walletMode, setWalletMode] = useState("embedded"); // "embedded" | "metamask"
  const [validatorInput, setValidatorInput] = useState("");
  const [validatorResolved, setValidatorResolved] = useState(null);
  const [validatorError, setValidatorError] = useState("");
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    async function init() {
      const token = await getToken().catch(() => null);
      const [priceData, configData, walletInfo] = await Promise.all([
        getEthPrice().catch(() => null),
        getConfig().catch(() => null),
        token ? getEmbeddedWalletInfo(token).catch(() => null) : null,
      ]);
      if (priceData?.usd) setEthPrice(priceData.usd);
      if (configData?.relayerAddress)
        setRelayerAddress(configData.relayerAddress);
      if (walletInfo) setEmbeddedWallet(walletInfo);
    }
    init();
  }, [getToken]);

  function handleUsdChange(val) {
    setStakeUsd(val);
    if (ethPrice && val && !isNaN(parseFloat(val))) {
      setStakeEth((parseFloat(val) / ethPrice).toFixed(6));
    } else {
      setStakeEth("");
    }
  }

  function handleEthChange(val) {
    setStakeEth(val);
    if (ethPrice && val && !isNaN(parseFloat(val))) {
      setStakeUsd((parseFloat(val) * ethPrice).toFixed(2));
    } else {
      setStakeUsd("");
    }
  }

  async function handleResolveValidator() {
    if (!validatorInput.trim()) return;
    setResolving(true);
    setValidatorError("");
    setValidatorResolved(null);
    try {
      const data = await resolveUser(validatorInput.trim());
      // Note: walletAddress may be null — validators don't need wallets
      setValidatorResolved(data);
    } catch (err) {
      setValidatorError(err.message);
    } finally {
      setResolving(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess(null);

    const hoursNum = parseInt(hours);
    if (isNaN(hoursNum) || hoursNum < 1) {
      setError("Minimum deadline is 1 hour");
      return;
    }

    const ethVal = parseFloat(stakeEth);
    if (isNaN(ethVal) || ethVal <= 0) {
      setError("Stake amount must be greater than 0");
      return;
    }

    if (!validatorResolved) {
      setError("Please enter and verify a validator username");
      return;
    }

    if (!relayerAddress) {
      setError("Backend config not loaded. Is the backend running?");
      return;
    }

    setLoading(true);
    const taskName = name;
    const taskValidator = validatorResolved.username;

    try {
      // --- Path 1: Embedded wallet (no MetaMask needed) ---
      if (walletMode === "embedded") {
        if (!embeddedWallet) {
          setError("Embedded wallet not loaded. Refresh and try again.");
          setLoading(false);
          return;
        }
        if (embeddedWallet.balanceEth < ethVal + 0.001) {
          setError(
            `Insufficient balance. Your embedded wallet has ${embeddedWallet.balanceEth.toFixed(
              4,
            )} ETH. Need ${ethVal} ETH + gas. Get free Sepolia ETH from the wallet panel.`,
          );
          setLoading(false);
          return;
        }

        const token = await getToken();
        const result = await createTaskEmbedded(token, {
          taskName,
          hours: hoursNum,
          stakeEth,
          validatorUsername: taskValidator,
        });

        setSuccess({
          taskId: "pending",
          name: taskName,
          hours: hoursNum,
          stakeEth,
          stakeUsd,
          txHash: result.txHash,
          confirming: true,
          mode: "embedded",
        });
        resetForm();
        setLoading(false);

        // Kick off task list polling — tx is pending, will land in ~12-25s
        onTaskCreated?.();
        pollForConfirmation(result.txHash, taskName);
        return;
      }

      // --- Path 2: MetaMask / external wallet ---
      if (!walletReady) {
        await onConnectWallet();
        setLoading(false);
        return;
      }

      const capturedStakeEth = stakeEth; // capture before resetForm clears state
      const tx = await contract.createTask(taskName, hoursNum, relayerAddress, {
        value: parseEther(stakeEth),
      });

      setSuccess({
        taskId: "pending",
        name: taskName,
        hours: hoursNum,
        stakeEth,
        stakeUsd,
        txHash: tx.hash,
        confirming: true,
        mode: "metamask",
      });
      resetForm();
      setLoading(false);

      tx.wait()
        .then(async (receipt) => {
          const event = receipt.events?.find(
            (ev) => ev.event === "TaskCreated",
          );
          const taskId = event?.args?.taskId?.toString();
          setSuccess((prev) =>
            prev ? { ...prev, taskId, confirming: false } : prev,
          );

          // Task is confirmed on-chain — trigger immediate list refresh
          onTaskCreated?.();

          if (taskId !== undefined) {
            const token = await getToken();
            await assignValidator(token, {
              taskId,
              validatorUsername: taskValidator,
              taskName,
              stakeEth: capturedStakeEth,
            }).catch((err) =>
              console.warn("assign-validator failed:", err.message),
            );
          }
        })
        .catch((err) => {
          console.error("Tx confirmation failed:", err.message);
          setSuccess((prev) =>
            prev ? { ...prev, confirming: false, failed: true } : prev,
          );
        });
    } catch (err) {
      const message = err.reason || err.message || "Transaction failed";
      if (
        message.toLowerCase().includes("rpc endpoint returned too many errors")
      ) {
        setError(
          "Sepolia RPC is overloaded. Re-open wallet network settings and retry.",
        );
      } else {
        setError(message);
      }
      setLoading(false);
    }
  }

  function resetForm() {
    setName("");
    setHours("");
    setStakeUsd("");
    setStakeEth("");
    setValidatorInput("");
    setValidatorResolved(null);
  }

  function pollForConfirmation(txHash, taskName) {
    // Just clear the confirming state after ~20s (embedded wallet confirms async on server)
    setTimeout(() => {
      setSuccess((prev) => (prev ? { ...prev, confirming: false } : prev));
    }, 20000);
  }

  if (success) {
    return (
      <div className="glass-card p-6 relative overflow-hidden animate-fade-up">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-tertiary to-transparent opacity-50" />
        <div className="flex items-center gap-2 mb-3">
          {success.confirming ? (
            <>
              <div className="w-4 h-4 rounded-full border-2 border-tertiary/30 border-t-tertiary animate-spin flex-shrink-0" />
              <h3 className="font-headline font-bold text-tertiary">
                Confirming on chain…
              </h3>
            </>
          ) : success.failed ? (
            <>
              <span
                className="material-symbols-outlined text-error"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                error
              </span>
              <h3 className="font-headline font-bold text-error">
                Confirmation failed
              </h3>
            </>
          ) : (
            <>
              <span
                className="material-symbols-outlined text-tertiary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
              <h3 className="font-headline font-bold text-tertiary">
                Task Deployed
              </h3>
            </>
          )}
        </div>
        <div className="text-sm text-on-surface-variant space-y-1">
          <p>
            <span className="text-on-surface">
              {success.confirming ? "Task #pending" : `Task #${success.taskId}`}
              :
            </span>{" "}
            {success.name}
          </p>
          <p>
            Deadline:{" "}
            <span className="text-on-surface">{success.hours} hours</span>
          </p>
          <p>
            Staked:{" "}
            {success.stakeUsd && (
              <span className="text-primary font-bold">
                ${parseFloat(success.stakeUsd).toFixed(2)}
              </span>
            )}
            <span className="text-on-surface-variant text-xs ml-1">
              ({parseFloat(success.stakeEth).toFixed(6)} ETH)
            </span>
          </p>
          <p>
            Validator:{" "}
            <span className="text-on-surface">
              @{validatorInput || "assigned"}
            </span>
          </p>
          {success.txHash && (
            <p className="text-[10px] font-mono text-outline break-all pt-1">
              tx: {success.txHash}
            </p>
          )}
        </div>
        {!success.confirming && (
          <button
            onClick={() => setSuccess(null)}
            className="mt-4 text-sm text-primary hover:text-primary-dim font-label font-bold uppercase tracking-wider transition-colors"
          >
            Create another task →
          </button>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="glass-card p-6 space-y-5 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />

      <div className="relative z-10 space-y-5">
        <h3 className="font-headline font-bold text-lg flex items-center gap-2">
          <span className="material-symbols-outlined text-primary">
            add_task
          </span>
          New Staked Task
        </h3>

        {/* Task Name */}
        <div className="space-y-1.5">
          <label className="block font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Task Identity
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full glass-input p-3.5 font-body text-sm"
            placeholder="e.g. Ship landing page redesign"
            required
          />
        </div>

        {/* Deadline */}
        <div className="space-y-1.5">
          <label className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant flex items-center gap-2">
            Resolution Deadline (hours)
            <span className="relative group">
              <span className="material-symbols-outlined text-error text-sm cursor-help">
                info
              </span>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 glass-strong text-on-surface text-[11px] px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center leading-snug">
                If the deadline is much shorter than needed, just do it yourself
                without TaskStaker
              </span>
            </span>
          </label>
          <input
            type="number"
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            min="1"
            className="w-full glass-input p-3.5 font-body text-sm"
            placeholder="Minimum 1 hour"
            required
          />
        </div>

        {/* Stake — USD primary, ETH secondary */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
              Staking Allocation
            </label>
            {ethPrice && (
              <span className="text-white/60 text-[10px] font-label">
                1 ETH ≈ ${ethPrice.toLocaleString()}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/70 text-sm font-bold">
                $
              </span>
              <input
                type="number"
                value={stakeUsd}
                onChange={(e) => handleUsdChange(e.target.value)}
                step="0.01"
                min="0.01"
                className="w-full glass-input pl-7 pr-3.5 py-3.5 font-body text-sm"
                placeholder="10.00"
              />
            </div>
            <div className="relative">
              <input
                type="number"
                value={stakeEth}
                onChange={(e) => handleEthChange(e.target.value)}
                step="0.000001"
                min="0.000001"
                className="w-full glass-input px-3.5 py-3.5 font-body text-sm"
                placeholder="0.003"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/60 text-xs font-label">
                ETH
              </span>
            </div>
          </div>
          {!ethPrice && (
            <p className="text-[10px] text-outline font-label">
              Live ETH price unavailable — enter ETH directly
            </p>
          )}
        </div>

        {/* Wallet mode selector */}
        <div className="space-y-1.5">
          <label className="block font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Pay With
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setWalletMode("embedded")}
              className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                walletMode === "embedded"
                  ? "border-primary/50 bg-primary/10 text-on-surface shadow-glow-primary"
                  : "border-white/10 bg-white/[0.03] text-on-surface-variant hover:border-white/20 hover:bg-white/[0.06]"
              }`}
            >
              <span
                className="material-symbols-outlined text-base text-tertiary"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                shield_lock
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold font-headline truncate">
                  My Wallet
                </p>
                <p className="text-[10px] font-label text-on-surface-variant truncate">
                  {embeddedWallet
                    ? `${embeddedWallet.balanceEth.toFixed(4)} ETH`
                    : "No MetaMask needed"}
                </p>
              </div>
              {walletMode === "embedded" && (
                <span
                  className="material-symbols-outlined text-primary text-sm ml-auto flex-shrink-0"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  radio_button_checked
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setWalletMode("metamask")}
              className={`flex items-center gap-2 p-3 rounded-lg border text-left transition-all ${
                walletMode === "metamask"
                  ? "border-primary/50 bg-primary/10 text-on-surface shadow-glow-primary"
                  : "border-white/10 bg-white/[0.03] text-on-surface-variant hover:border-white/20 hover:bg-white/[0.06]"
              }`}
            >
              <span
                className="material-symbols-outlined text-base text-outline"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                extension
              </span>
              <div className="min-w-0">
                <p className="text-xs font-bold font-headline truncate">
                  MetaMask
                </p>
                <p className="text-[10px] font-label text-on-surface-variant truncate">
                  {walletReady ? "Connected" : "Click to connect"}
                </p>
              </div>
              {walletMode === "metamask" && (
                <span
                  className="material-symbols-outlined text-primary text-sm ml-auto flex-shrink-0"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  radio_button_checked
                </span>
              )}
            </button>
          </div>
          {walletMode === "embedded" && !embeddedWallet?.balanceEth && (
            <p className="text-[10px] text-primary font-label">
              Wallet loaded from your account. Fund it via the wallet panel
              (wallet icon in header).
            </p>
          )}
        </div>

        {/* Validator */}
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant">
            Validator (username or ID)
            <span className="relative group">
              <span className="material-symbols-outlined text-error text-sm cursor-help">
                info
              </span>
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 glass-strong text-on-surface text-[11px] px-3 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 text-center leading-snug">
                Pick someone genuinely independent — a person who will assess
                your work honestly and hold you accountable. Choosing a
                validator who'll approve anything defeats the entire purpose of
                staking.
              </span>
            </span>
          </label>
          <p className="text-[10px] text-on-surface-variant/70 font-label">
            Validators don't need a wallet — anyone with a TaskStaker account
            can validate
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={validatorInput}
              onChange={(e) => {
                setValidatorInput(e.target.value);
                setValidatorResolved(null);
                setValidatorError("");
              }}
              className="flex-1 glass-input p-3.5 font-body text-sm"
              placeholder="@username or 12345"
              required
            />
            <button
              type="button"
              onClick={handleResolveValidator}
              disabled={resolving || !validatorInput.trim()}
              className="px-4 py-3 btn-ghost text-xs font-label font-bold rounded-lg uppercase tracking-wider"
            >
              {resolving ? (
                <div className="w-4 h-4 rounded-full border-2 border-outline/30 border-t-primary animate-spin" />
              ) : (
                "Verify"
              )}
            </button>
          </div>
          {validatorResolved && (
            <p className="text-xs text-tertiary flex items-center gap-1 font-label">
              <span
                className="material-symbols-outlined text-sm"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                verified
              </span>
              @{validatorResolved.username} verified — no wallet required
            </p>
          )}
          {validatorError && (
            <p className="text-xs text-error">{validatorError}</p>
          )}
        </div>

        {walletError && (
          <div className="bg-error-container/20 border border-error/20 text-on-error-container p-3 rounded-lg text-sm">
            {walletError}
          </div>
        )}
        {error && (
          <div className="bg-error-container/20 border border-error/20 text-on-error-container p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !validatorResolved || (!stakeEth && !stakeUsd)}
          className="w-full btn-primary font-headline font-bold text-sm py-4 rounded-xl flex items-center justify-center gap-2 uppercase tracking-wider"
        >
          {loading ? (
            <div className="w-5 h-5 rounded-full border-2 border-on-primary-container/30 border-t-on-primary-container animate-spin" />
          ) : (
            <>
              <span
                className="material-symbols-outlined"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                bolt
              </span>
              {walletMode === "embedded"
                ? "Stake & Deploy (No MetaMask)"
                : "Stake & Deploy via MetaMask"}
            </>
          )}
        </button>
      </div>
    </form>
  );
}
