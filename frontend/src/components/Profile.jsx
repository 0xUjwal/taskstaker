export default function Profile({ userProfile, walletState }) {
  return (
    <div className="space-y-4">
      <div className="glass-card p-6">
        <h2 className="font-headline font-bold text-xl text-on-surface mb-4">Profile</h2>

        <div className="grid sm:grid-cols-2 gap-3">
          <InfoCard label="Username" value={`@${userProfile?.username || "-"}`} />
          <InfoCard label="User ID" value={String(userProfile?.unique_id || "-")} />
          <InfoCard
            label="Wallet"
            value={walletState?.address || userProfile?.wallet_address || "Not connected"}
            mono
          />
          <InfoCard
            label="Network"
            value={walletState?.networkName || "Not connected"}
          />
          <InfoCard
            label="Balance"
            value={`${walletState?.balanceEth || "0.0000"} ETH`}
          />
          <InfoCard
            label="Completed Tasks"
            value={String(userProfile?.completed_tasks || 0)}
          />
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, mono = false }) {
  return (
    <div className="rounded-xl bg-white/[0.04] p-3 border border-white/[0.07]">
      <p className="text-[10px] uppercase tracking-widest font-label text-on-surface-variant">{label}</p>
      <p className={`text-sm mt-1 font-bold text-on-surface ${mono ? "font-mono break-all" : "font-headline"}`}>
        {value}
      </p>
    </div>
  );
}
