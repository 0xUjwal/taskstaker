import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { registerUser, linkWallet } from "../utils/api";
import { initWeb3 } from "../utils/web3";

export default function UsernameSetup({ onComplete }) {
  const { getToken } = useAuth();
  const [step, setStep] = useState("username"); // "username" | "wallet"
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(null);

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const token = await getToken();
      const data = await registerUser(token, username);
      setProfile(data.user);
      setStep("wallet");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnectWallet() {
    setError("");
    setLoading(true);

    try {
      const contractAddress = import.meta.env.VITE_CONTRACT_ADDRESS;
      if (!contractAddress) throw new Error("Contract address not configured");

      const { userAddress } = await initWeb3(contractAddress);
      const token = await getToken();
      await linkWallet(token, userAddress);

      onComplete({ ...profile, wallet_address: userAddress });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body flex flex-col items-center justify-center px-4 relative">
      {/* Background */}
      <div className="fixed inset-0 node-bg -z-10 opacity-25" />
      <div className="aurora-orb w-[420px] h-[420px] bg-primary/[0.30] top-[15%] left-[18%] animate-aurora-1" />
      <div className="aurora-orb w-[380px] h-[380px] bg-accent/[0.22] bottom-[15%] right-[18%] animate-aurora-2" />

      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <span className="text-3xl font-black gradient-text-primary font-headline tracking-tighter uppercase">
          TaskStaker
        </span>
      </div>

      {/* Card */}
      <div className="glass-card p-8 w-full max-w-md relative overflow-hidden animate-fade-up">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />

        {step === "username" ? (
          <>
            <h2 className="text-xl font-headline font-bold text-on-surface mb-2">Choose your username</h2>
            <p className="text-sm text-on-surface-variant mb-6">
              This is how other users will find you as a validator.
            </p>

            <form onSubmit={handleRegister}>
              <div className="mb-5">
                <label className="block font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">
                  Username
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. ujwal_dev"
                  className="w-full glass-input p-3.5 font-body"
                  minLength={3}
                  maxLength={20}
                  pattern="[a-zA-Z0-9_]+"
                  required
                />
                <p className="text-[10px] text-outline mt-1.5 font-label">3-20 characters. Letters, numbers, underscores only.</p>
              </div>

              {error && (
                <div className="bg-error-container/20 border border-error/20 text-on-error-container p-3 rounded-xl mb-4 text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || username.length < 3}
                className="w-full btn-primary font-headline font-bold px-6 py-3.5 rounded-xl"
              >
                {loading ? "Creating..." : "Create Username"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="text-xl font-headline font-bold text-on-surface mb-2">Connect your wallet</h2>
            <p className="text-sm text-on-surface-variant mb-2">
              Welcome, <span className="font-bold text-primary">@{profile?.username}</span>!
            </p>
            <p className="text-sm text-on-surface-variant mb-6">
              Your unique ID: <span className="font-mono font-bold text-secondary">{profile?.unique_id}</span>
            </p>

            {error && (
              <div className="bg-error-container/20 border border-error/20 text-on-error-container p-3 rounded-xl mb-4 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={handleConnectWallet}
              disabled={loading}
              className="w-full btn-primary font-headline font-bold px-6 py-3.5 rounded-xl flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 rounded-full border-2 border-on-primary-container/30 border-t-on-primary-container animate-spin" />
              ) : (
                <>
                  <span className="material-symbols-outlined">link</span>
                  Connect MetaMask Wallet
                </>
              )}
            </button>

            <p className="text-[10px] text-outline mt-3 text-center font-label uppercase tracking-widest">
              Make sure you're on Sepolia testnet
            </p>
          </>
        )}
      </div>
    </div>
  );
}
