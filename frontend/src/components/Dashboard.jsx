import { useState, useCallback, useEffect } from "react";
import {
  initWeb3,
  getNetwork,
  switchToSepolia,
  isChainSupported,
  getWalletSummary,
  configureSepoliaChain,
} from "../utils/web3";
import { useAuth } from "@clerk/clerk-react";
import { linkWallet } from "../utils/api";
import CreateTask from "./CreateTask";
import TaskList from "./TaskList";

export default function Dashboard({
  userProfile,
  onWalletStateChange,
  onProfileRefresh,
  onDerivedCompletedTasks,
  walletState,
}) {
  const { getToken } = useAuth();
  const [mobileView, setMobileView] = useState("tasks");
  const [walletReady, setWalletReady] = useState(false);
  const [taskCreateTick, setTaskCreateTick] = useState(0);

  // Sync walletReady with external wallet connections made via WalletPanel
  useEffect(() => {
    setWalletReady(!!walletState?.connected);
  }, [walletState?.connected]);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletError, setWalletError] = useState("");
  const [network, setNetwork] = useState(null);

  const connectWallet = useCallback(async () => {
    setWalletLoading(true);
    setWalletError("");
    try {
      const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
      if (!contractAddress)
        throw new Error("Contract address not configured in .env");

      try {
        await configureSepoliaChain(true);
      } catch {
        /* non-blocking */
      }
      try {
        await switchToSepolia();
      } catch {
        /* non-blocking */
      }

      const { userAddress } = await initWeb3(contractAddress);

      // Connecting proves control even when this address was saved before
      // account-isolation checks were added.
      const token = await getToken();
      await linkWallet(token, userAddress);

      const net = await getNetwork();
      setNetwork(net);

      const summary = await getWalletSummary();
      onWalletStateChange({
        connected: true,
        address: summary.address,
        networkName: net?.name || "Unknown",
        chainId: net?.chainId || null,
        balanceEth: summary.balanceEth,
      });
      setWalletReady(true);
    } catch (err) {
      const message = err?.message || "Failed to connect wallet";
      if (
        message.toLowerCase().includes("rpc endpoint returned too many errors")
      ) {
        try {
          await configureSepoliaChain(true);
          await switchToSepolia();
        } catch {
          /* non-blocking */
        }
        setWalletError(
          "Sepolia RPC is overloaded. Switched to backup — click Connect Wallet once more.",
        );
      } else {
        setWalletError(message);
      }
      onWalletStateChange((prev) => ({ ...prev, connected: false }));
    } finally {
      setWalletLoading(false);
    }
  }, [getToken, userProfile, onWalletStateChange]);

  const wrongNetwork = network && !isChainSupported(network.chainId);

  return (
    <div className="space-y-4">
      {wrongNetwork && (
        <div className="glass-card border-error/25 p-4 flex items-center gap-3 text-on-error-container">
          <span className="material-symbols-outlined text-error">warning</span>
          <div className="flex-1">
            <p className="text-sm font-medium">
              Wrong network ({network.name})
            </p>
            <p className="text-xs mt-0.5 text-on-surface-variant">
              Switch to Sepolia testnet
            </p>
          </div>
          <button
            onClick={switchToSepolia}
            className="font-label font-bold bg-error/10 hover:bg-error/20 text-error px-3 py-1.5 rounded-lg transition-colors uppercase tracking-wider text-xs"
          >
            Switch
          </button>
        </div>
      )}

      <div className="lg:hidden space-y-4">
        <div><p className="text-xs text-primary font-label">SEPOLIA TESTNET</p><h1 className="text-2xl font-headline font-bold mt-1">Your commitments</h1><p className="text-sm text-on-surface-variant mt-1">Set a goal. Ask someone you trust to review it.</p></div>
        <div className="grid grid-cols-2 gap-2 glass-card p-1" role="tablist" aria-label="Task views">
          <button role="tab" aria-selected={mobileView === "tasks"} onClick={() => setMobileView("tasks")} className={`rounded-xl py-3 text-sm font-bold ${mobileView === "tasks" ? "bg-white/10 text-white" : "text-on-surface-variant"}`}>My activity</button>
          <button role="tab" aria-selected={mobileView === "create"} onClick={() => setMobileView("create")} className={`rounded-xl py-3 text-sm font-bold ${mobileView === "create" ? "btn-primary" : "text-on-surface-variant"}`}>+ New task</button>
        </div>
      </div>
      {/* Side-by-side on md+ screens */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <div className={mobileView === "create" ? "min-w-0" : "hidden lg:block min-w-0"}><CreateTask
          userProfile={userProfile}
          walletReady={walletReady}
          walletLoading={walletLoading}
          walletError={walletError}
          onConnectWallet={connectWallet}
          onTaskCreated={() => { setTaskCreateTick((t) => t + 1); }}
        /></div>
        <div className={mobileView === "tasks" ? "min-w-0" : "hidden lg:block min-w-0"}><TaskList
          userProfile={userProfile}
          walletReady={walletReady}
          onTaskClaimed={onProfileRefresh}
          onDerivedCompletedTasks={onDerivedCompletedTasks}
          taskCreateTick={taskCreateTick}
        /></div>
      </div>
    </div>
  );
}
