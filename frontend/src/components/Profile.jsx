import { useState, useEffect } from "react";
import { useAuth } from "@clerk/clerk-react";
import { getEmbeddedWalletInfo, changeUsername } from "../utils/api";

const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

export default function Profile({ userProfile, walletState, onProfileChange }) {
  const { getToken } = useAuth();
  const [embedded, setEmbedded] = useState(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  // The account's own (embedded) wallet is the default. MetaMask is optional.
  useEffect(() => {
    let alive = true;
    getToken()
      .then((t) => getEmbeddedWalletInfo(t))
      .then((info) => alive && setEmbedded(info))
      .catch(() => {});
    return () => { alive = false; };
  }, [getToken]);

  const external = walletState?.connected ? walletState : null;
  const walletAddress = external?.address || embedded?.address || "Loading...";
  const network = external ? external.networkName || "Sepolia" : "Sepolia (embedded wallet)";
  const rawBalance = external ? external.balanceEth : embedded?.balanceEth;
  const balance = rawBalance === undefined || rawBalance === null ? undefined : Number(rawBalance).toFixed(4);

  function startEdit() {
    setDraft(userProfile?.username || "");
    setError("");
    setSaved(false);
    setEditing(true);
  }

  async function save() {
    const name = draft.trim().toLowerCase().replace(/^@/, "");
    if (!USERNAME_RE.test(name)) {
      setError("Use 3-20 letters, numbers or underscores.");
      return;
    }
    if (name === userProfile?.username) { setEditing(false); return; }
    setSaving(true);
    setError("");
    try {
      const token = await getToken();
      const { user } = await changeUsername(token, name);
      onProfileChange?.(user);
      setEditing(false);
      setSaved(true);
    } catch (err) {
      setError(err.message || "Could not change the username");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="glass-card p-6">
        <h2 className="font-headline font-bold text-xl text-on-surface mb-4">Profile</h2>

        <div className="grid sm:grid-cols-2 gap-3">
          <div className="rounded-xl bg-white/[0.04] p-3 border border-white/[0.07]">
            <p className="text-[10px] uppercase tracking-widest font-label text-on-surface-variant">Username</p>
            {editing ? (
              <div className="mt-1 space-y-2">
                <div className="flex gap-2">
                  <input
                    aria-label="New username"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && save()}
                    maxLength={21}
                    autoFocus
                    className="flex-1 min-w-0 glass-input px-3 py-2 text-sm font-body"
                  />
                  <button onClick={save} disabled={saving} className="btn-primary px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider disabled:opacity-50">
                    {saving ? "Saving..." : "Save"}
                  </button>
                  <button onClick={() => setEditing(false)} disabled={saving} className="px-2 text-outline hover:text-on-surface text-sm" aria-label="Cancel">✕</button>
                </div>
                {error && <p role="alert" className="text-xs text-error font-label">{error}</p>}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2 mt-1">
                <p className="text-sm font-bold text-on-surface font-headline">@{userProfile?.username || "-"}</p>
                <button onClick={startEdit} className="text-[11px] font-label font-bold text-primary hover:text-primary-dim uppercase tracking-wider">
                  Change
                </button>
              </div>
            )}
            {saved && !editing && <p className="text-[11px] text-tertiary font-label mt-1">Username updated.</p>}
          </div>
          <InfoCard label="User ID" value={String(userProfile?.unique_id || "-")} />
          <InfoCard label="Wallet" value={walletAddress} mono />
          <InfoCard label="Network" value={network} />
          <InfoCard label="Balance" value={balance === undefined ? "Loading..." : `${balance} ETH`} />
          <InfoCard label="Completed Tasks" value={String(userProfile?.completed_tasks || 0)} />
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
