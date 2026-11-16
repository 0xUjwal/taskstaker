import { useState } from "react";
import HamburgerMenu from "./HamburgerMenu";
import NotificationBell from "./NotificationBell";
import WalletPanel from "./WalletPanel";

export default function Layout({
  userProfile,
  walletState,
  onWalletDisconnect,
  onExternalWalletChange,
  children,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);

  function handleExternalWalletChange(wallet) {
    onExternalWalletChange?.(wallet);
    if (!wallet) onWalletDisconnect?.();
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body">
      {/* Ambient aurora background */}
      <div className="fixed inset-0 node-bg -z-10 opacity-25" />
      <div className="aurora-orb w-[480px] h-[480px] bg-primary/[0.26] top-[-8%] right-[-6%] animate-aurora-1" />
      <div className="aurora-orb w-[420px] h-[420px] bg-accent/[0.20] bottom-[-10%] left-[-8%] animate-aurora-2" />
      <div className="aurora-orb w-[360px] h-[360px] bg-info/[0.13] top-[45%] left-[35%] animate-aurora-3" />

      {/* Top Nav Bar */}
      <header className="fixed top-0 w-full z-50 bg-surface/60 backdrop-blur-2xl">
        <div className="w-full px-4 md:px-6 h-14 md:h-16 flex items-center gap-0">
          {/* Left section — hamburger */}
          <div className="flex items-center gap-1 pr-4 border-r border-white/10 h-9">
            <button
              onClick={() => setMenuOpen(true)}
              className="p-2 hover:bg-white/5 rounded-lg transition-colors"
              title="Menu"
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                className="text-on-surface-variant"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </button>
          </div>

          {/* Logo */}
          <span className="text-base font-bold tracking-tighter gradient-text-primary font-headline px-4">
            TaskStaker
          </span>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right section — notifications + address + username */}
          <div className="flex items-center gap-2 pl-4 border-l border-white/[0.08] h-9">
            <NotificationBell userId={userProfile?.id} />

            {/* Wallet button — directly after notifications */}
            <button
              onClick={() => setWalletOpen(true)}
              className="relative p-2 hover:bg-white/5 rounded-lg transition-colors group"
              title="Wallet"
            >
              <span className="material-symbols-outlined text-on-surface-variant text-[20px] group-hover:text-on-surface transition-colors">
                account_balance_wallet
              </span>
              {walletState?.connected ? (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-primary" />
              ) : userProfile ? (
                <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-tertiary" />
              ) : null}
            </button>

            {walletState?.connected && walletState?.address && (
              <button
                onClick={() => setWalletOpen(true)}
                className="text-[10px] font-mono text-primary bg-primary/10 px-2.5 py-1.5 rounded-lg border border-primary/20 items-center gap-1.5 hidden sm:flex hover:bg-primary/20 transition-colors"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />
                {walletState.address.slice(0, 6)}...
                {walletState.address.slice(-4)}
              </button>
            )}
            <div className="text-xs font-label text-on-surface/90 bg-white/[0.06] backdrop-blur-md px-2.5 py-1.5 rounded-lg border border-white/10 uppercase tracking-wider">
              @{userProfile?.username}
            </div>
          </div>
        </div>

        {/* Full-width separator */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      </header>

      {/* Hamburger Menu */}
      <HamburgerMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        userProfile={userProfile}
      />

      {/* Wallet Panel drawer */}
      <WalletPanel
        open={walletOpen}
        onClose={() => setWalletOpen(false)}
        userProfile={userProfile}
        onExternalWalletChange={handleExternalWalletChange}
      />

      {/* Main Content */}
      <main className="w-full px-4 md:px-6 pt-20 md:pt-24 pb-12">
        {children}
      </main>
    </div>
  );
}
