import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { getEmbeddedWalletInfo, getWalletBalances } from "../utils/api";
import {
  initWeb3,
  disconnectWallet,
  getWalletSummary,
  switchToSepolia,
  configureSepoliaChain,
  isChainSupported,
} from "../utils/web3";
import { CHAINS, WALLET_CHAINS } from "../config/chains";

const CHAIN_META = {
  sepolia: {
    label: "Sepolia",
    icon: "🔵",
    color: "#627EEA",
    isTestnet: true,
    faucet: "https://cloud.google.com/application/web3/faucet/ethereum/sepolia",
  },
  base: { label: "Base", icon: "🔷", color: "#0052FF", isTestnet: false },
  polygon: { label: "Polygon", icon: "🟣", color: "#8247E5", isTestnet: false },
};

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1 text-[10px] font-label font-bold text-on-surface-variant hover:text-on-surface transition-colors uppercase tracking-wider"
    >
      <span className="material-symbols-outlined text-sm">
        {copied ? "check" : "content_copy"}
      </span>
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function TokenRow({ symbol, balance, isNative }) {
  const icons = { ETH: "⟠", MATIC: "⬡", USDC: "$", USDT: "₮" };
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-full bg-surface-container-highest flex items-center justify-center text-sm font-bold">
          {icons[symbol] || symbol[0]}
        </div>
        <div>
          <p className="text-sm font-bold text-on-surface font-headline">
            {symbol}
          </p>
          <p className="text-[10px] text-on-surface-variant font-label uppercase tracking-widest">
            {isNative ? "Native" : "Token"}
          </p>
        </div>
      </div>
      <p
        className={`text-sm font-bold font-headline ${
          balance > 0 ? "text-on-surface" : "text-outline"
        }`}
      >
        {balance > 0 ? balance.toFixed(balance < 0.001 ? 8 : 4) : "0.00"}
      </p>
    </div>
  );
}

export default function WalletPanel({
  open,
  onClose,
  userProfile,
  onExternalWalletChange,
}) {
  const { getToken } = useAuth();
  const [activeTab, setActiveTab] = useState("embedded");
  const [activeChain, setActiveChain] = useState("sepolia");
  const [embeddedInfo, setEmbeddedInfo] = useState(null);
  const [balances, setBalances] = useState({});
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [externalWallet, setExternalWallet] = useState(null);
  const [connectingExternal, setConnectingExternal] = useState(false);
  const [externalError, setExternalError] = useState("");

  const loadEmbeddedInfo = useCallback(async () => {
    try {
      const token = await getToken();
      const info = await getEmbeddedWalletInfo(token);
      setEmbeddedInfo(info);
    } catch {}
  }, [getToken]);

  const loadBalances = useCallback(async () => {
    if (!embeddedInfo?.address) return;
    setLoadingBalances(true);
    try {
      const token = await getToken();
      const result = await getWalletBalances(token, WALLET_CHAINS);
      setBalances(result.balances || {});
    } catch {
    } finally {
      setLoadingBalances(false);
    }
  }, [getToken, embeddedInfo?.address]);

  useEffect(() => {
    if (open) {
      loadEmbeddedInfo();
    }
  }, [open, loadEmbeddedInfo]);

  useEffect(() => {
    if (embeddedInfo?.address) loadBalances();
  }, [embeddedInfo?.address, loadBalances]);

  async function handleConnectExternal() {
    setConnectingExternal(true);
    setExternalError("");
    try {
      try {
        await configureSepoliaChain(true);
      } catch {}
      try {
        await switchToSepolia();
      } catch {}
      const { userAddress } = await initWeb3(
        import.meta.env.VITE_CONTRACT_ADDRESS,
      );
      const summary = await getWalletSummary();
      const walletData = {
        address: userAddress,
        balanceEth: summary.balanceEth,
      };
      setExternalWallet(walletData);
      onExternalWalletChange?.(walletData);
    } catch (err) {
      setExternalError(err.message || "Failed to connect wallet");
    } finally {
      setConnectingExternal(false);
    }
  }

  async function handleDisconnectExternal() {
    await disconnectWallet();
    setExternalWallet(null);
    onExternalWalletChange?.(null);
  }

  if (!open) return null;

  const shortAddr = (addr) =>
    addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "";
  const chainData = balances[activeChain];
  const chainMeta = CHAIN_META[activeChain];
  const nativeSymbol = activeChain === "polygon" ? "MATIC" : "ETH";

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
        onClick={onClose}
      />

      {/* Panel — right-side drawer */}
      <div className="fixed top-0 right-0 h-full w-80 glass-strong border-l border-white/10 z-[80] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg crimson-gradient flex items-center justify-center">
              <span
                className="material-symbols-outlined text-white text-[16px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                account_balance_wallet
              </span>
            </div>
            <div>
              <p className="text-sm font-headline font-bold text-on-surface">
                Wallet
              </p>
              <p className="text-[10px] text-on-surface-variant font-label uppercase tracking-widest">
                @{userProfile?.username}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/8 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-on-surface-variant text-lg">
              close
            </span>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4 pt-3 pb-0 gap-1">
          {[
            { key: "embedded", label: "My Wallet", icon: "shield_lock" },
            { key: "external", label: "MetaMask", icon: "extension" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-t-lg text-xs font-label font-bold uppercase tracking-wider transition-all border-b-2 ${
                activeTab === tab.key
                  ? "text-primary border-primary bg-primary/5"
                  : "text-on-surface-variant border-transparent hover:text-on-surface"
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {tab.icon}
              </span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px bg-white/8 mx-4" />

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === "embedded" ? (
            <div className="p-4 space-y-4">
              {/* Embedded wallet info */}
              <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[10px] text-on-surface-variant font-label uppercase tracking-widest mb-1">
                      Your TaskStaker Wallet
                    </p>
                    <p className="text-base font-mono font-bold text-on-surface">
                      {embeddedInfo
                        ? shortAddr(embeddedInfo.address)
                        : "Loading..."}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {embeddedInfo && <CopyButton text={embeddedInfo.address} />}
                  </div>
                </div>

                {embeddedInfo && (
                  <>
                    {/* Full address (small) */}
                    <p className="text-[10px] font-mono text-on-surface-variant/60 break-all leading-relaxed">
                      {embeddedInfo.address}
                    </p>

                    {/* Sepolia balance prominent */}
                    <div className="flex items-baseline justify-between pt-1 border-t border-white/5">
                      <span className="text-[10px] text-on-surface-variant font-label uppercase tracking-widest">
                        Sepolia Balance
                      </span>
                      <div className="text-right">
                        <span className="text-lg font-headline font-bold text-on-surface">
                          {embeddedInfo.balanceEth.toFixed(4)}
                        </span>
                        <span className="text-xs text-on-surface-variant ml-1 font-label">
                          ETH
                        </span>
                      </div>
                    </div>

                    {/* Quick actions */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <a
                        href={`https://sepolia.etherscan.io/address/${embeddedInfo.address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 bg-surface-container-high hover:bg-surface-bright text-on-surface-variant hover:text-on-surface text-[11px] font-label font-bold py-2 rounded-lg transition-colors uppercase tracking-wider"
                      >
                        <span className="material-symbols-outlined text-sm">
                          open_in_new
                        </span>
                        Explorer
                      </a>
                      <a
                        href="https://cloud.google.com/application/web3/faucet/ethereum/sepolia"
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-label font-bold py-2 rounded-lg transition-colors uppercase tracking-wider border border-primary/20"
                      >
                        <span className="material-symbols-outlined text-sm">
                          water_drop
                        </span>
                        Get testnet ETH
                      </a>
                    </div>
                  </>
                )}
              </div>

              {/* Refresh */}
              <button
                onClick={loadBalances}
                disabled={loadingBalances}
                className="w-full flex items-center justify-center gap-1.5 text-xs text-on-surface-variant hover:text-on-surface font-label uppercase tracking-wider py-1.5 transition-colors"
              >
                <span
                  className={`material-symbols-outlined text-sm ${
                    loadingBalances ? "animate-spin" : ""
                  }`}
                >
                  sync
                </span>
                {loadingBalances ? "Refreshing..." : "Refresh Balances"}
              </button>

              {/* Chain selector */}
              <div>
                <p className="text-[10px] text-on-surface-variant font-label uppercase tracking-widest mb-2">
                  View on Network
                </p>
                <div className="flex gap-1.5">
                  {WALLET_CHAINS.map((key) => {
                    const meta = CHAIN_META[key];
                    return (
                      <button
                        key={key}
                        onClick={() => setActiveChain(key)}
                        className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] font-label font-bold uppercase tracking-wider transition-all border ${
                          activeChain === key
                            ? "bg-surface-container-high border-white/20 text-on-surface"
                            : "border-transparent text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                        }`}
                      >
                        <span className="text-base leading-none">
                          {meta.icon}
                        </span>
                        {meta.label}
                        {meta.isTestnet && (
                          <span className="text-[8px] text-primary font-bold leading-none">
                            testnet
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Balances for selected chain */}
              {embeddedInfo && (
                <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl overflow-hidden">
                  <div
                    className="px-4 py-2.5 flex items-center gap-2 border-b border-white/5"
                    style={{
                      borderTopColor: chainMeta.color + "40",
                      borderTopWidth: 2,
                    }}
                  >
                    <span className="text-base">{chainMeta.icon}</span>
                    <span className="text-xs font-headline font-bold text-on-surface">
                      {chainMeta.label}
                    </span>
                    {chainMeta.isTestnet && (
                      <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded font-label uppercase tracking-wider ml-auto">
                        testnet
                      </span>
                    )}
                  </div>

                  <div className="px-4">
                    {loadingBalances ? (
                      <div className="py-4 flex items-center justify-center gap-2 text-on-surface-variant">
                        <span className="material-symbols-outlined text-base animate-spin">
                          progress_activity
                        </span>
                        <span className="text-xs font-label">
                          Loading balances...
                        </span>
                      </div>
                    ) : chainData ? (
                      <>
                        <TokenRow
                          symbol={nativeSymbol}
                          balance={chainData.nativeBalance}
                          isNative
                        />
                        {(chainData.tokens || []).map((t) => (
                          <TokenRow
                            key={t.symbol}
                            symbol={t.symbol}
                            balance={t.balance}
                          />
                        ))}
                      </>
                    ) : (
                      <p className="py-4 text-center text-xs text-outline font-label">
                        Could not load {chainMeta.label} balances
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Info callout */}
              <div className="bg-black/25 rounded-xl p-3 border border-white/[0.06]">
                <p className="text-[10px] text-on-surface-variant font-label leading-relaxed">
                  <span className="text-primary font-bold">
                    Your embedded wallet
                  </span>{" "}
                  is created automatically when you sign in. Deposit Sepolia ETH
                  to this address to stake tasks — no browser extension needed.
                  This wallet is managed by TaskStaker for demo purposes.
                </p>
              </div>
            </div>
          ) : (
            /* External wallet tab */
            <div className="p-4 space-y-4">
              {externalWallet ? (
                <>
                  <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-4 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-2 h-2 rounded-full bg-tertiary animate-pulse" />
                      <p className="text-[10px] text-tertiary font-label uppercase tracking-widest font-bold">
                        Connected
                      </p>
                    </div>
                    <p className="text-base font-mono font-bold text-on-surface">
                      {shortAddr(externalWallet.address)}
                    </p>
                    <p className="text-[10px] font-mono text-on-surface-variant/60 break-all">
                      {externalWallet.address}
                    </p>
                    <div className="flex items-center justify-between pt-1 border-t border-white/5">
                      <span className="text-[10px] text-on-surface-variant font-label uppercase tracking-widest">
                        Sepolia Balance
                      </span>
                      <div className="text-right">
                        <span className="text-base font-headline font-bold text-on-surface">
                          {externalWallet.balanceEth}
                        </span>
                        <span className="text-xs text-on-surface-variant ml-1 font-label">
                          ETH
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <a
                        href={`https://sepolia.etherscan.io/address/${externalWallet.address}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 flex items-center justify-center gap-1.5 bg-surface-container-high hover:bg-surface-bright text-on-surface-variant text-[11px] font-label font-bold py-2 rounded-lg transition-colors uppercase tracking-wider"
                      >
                        <span className="material-symbols-outlined text-sm">
                          open_in_new
                        </span>
                        Explorer
                      </a>
                      <button
                        onClick={handleDisconnectExternal}
                        className="flex-1 flex items-center justify-center gap-1.5 bg-error/10 hover:bg-error/20 text-error text-[11px] font-label font-bold py-2 rounded-lg transition-colors border border-error/20 uppercase tracking-wider"
                      >
                        <span className="material-symbols-outlined text-sm">
                          link_off
                        </span>
                        Disconnect
                      </button>
                    </div>
                  </div>

                  <div className="bg-black/25 rounded-xl p-3 border border-white/[0.06]">
                    <p className="text-[10px] text-on-surface-variant font-label leading-relaxed">
                      <span className="text-on-surface font-bold">
                        External wallet connected.
                      </span>{" "}
                      You can use MetaMask to create tasks and claim funds
                      directly. Make sure you're on the Sepolia testnet.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-white/[0.04] border border-white/[0.07] rounded-xl p-5 flex flex-col items-center gap-3 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-surface-container-high flex items-center justify-center">
                      <span className="material-symbols-outlined text-2xl text-on-surface-variant">
                        extension
                      </span>
                    </div>
                    <div>
                      <p className="font-headline font-bold text-on-surface text-sm">
                        Connect Your Wallet
                      </p>
                      <p className="text-[11px] text-on-surface-variant font-label mt-1 leading-relaxed">
                        Use MetaMask or any injected wallet for full
                        self-custody control.
                      </p>
                    </div>

                    {externalError && (
                      <div className="w-full bg-error/5 border border-error/20 rounded-lg px-3 py-2 text-left">
                        <p className="text-xs text-error font-label">
                          {externalError}
                        </p>
                      </div>
                    )}

                    <button
                      onClick={handleConnectExternal}
                      disabled={connectingExternal}
                      className="w-full flex items-center justify-center gap-2 btn-primary font-headline font-bold text-sm py-3 rounded-xl uppercase tracking-wider"
                    >
                      {connectingExternal ? (
                        <div className="w-4 h-4 rounded-full border-2 border-on-primary-container/30 border-t-on-primary-container animate-spin" />
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-base">
                            link
                          </span>
                          Connect MetaMask
                        </>
                      )}
                    </button>
                  </div>

                  <div className="bg-black/25 rounded-xl p-3 border border-white/[0.06]">
                    <p className="text-[10px] text-on-surface-variant font-label leading-relaxed">
                      <span className="text-on-surface font-bold">
                        Don't have MetaMask?
                      </span>{" "}
                      Use your embedded wallet above — no extension required.
                      The embedded wallet works seamlessly for all TaskStaker
                      operations.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
