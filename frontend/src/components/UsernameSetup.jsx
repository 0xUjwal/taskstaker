import { useState } from "react";
import { useAuth } from "@clerk/clerk-react";
import { registerUser } from "../utils/api";

export default function UsernameSetup({ onComplete }) {
  const { getToken } = useAuth();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const token = await getToken();
      const data = await registerUser(token, username.trim());
      onComplete(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface text-on-surface font-body flex flex-col items-center justify-center px-4 py-8 relative">
      <div className="fixed inset-0 node-bg -z-10 opacity-25" />
      <div className="text-3xl font-black gradient-text-primary font-headline tracking-tighter mb-8">TaskStaker</div>
      <section className="glass-card p-5 sm:p-8 w-full max-w-md">
        <h1 className="text-xl font-headline font-bold mb-2">Choose your username</h1>
        <p className="text-sm text-on-surface-variant mb-6">This is how people you know can find you as a validator. You only need to set it once.</p>
        <form onSubmit={handleRegister}>
          <label htmlFor="setup-username" className="block font-label text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-2">Username</label>
          <input id="setup-username" type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. ujwal_dev" className="w-full glass-input p-3.5 font-body" minLength={3} maxLength={20} pattern="[a-zA-Z0-9_]+" autoCapitalize="none" autoCorrect="off" autoComplete="username" required />
          <p className="text-xs text-on-surface-variant mt-2 mb-5">3-20 characters. Letters, numbers and underscores only.</p>
          {error && <p role="alert" className="bg-error-container/20 border border-error/20 text-on-error-container p-3 rounded-xl mb-4 text-sm">{error}</p>}
          <button type="submit" disabled={loading || username.trim().length < 3} className="w-full btn-primary font-headline font-bold px-6 py-3.5 rounded-xl">{loading ? "Creating..." : "Create Username"}</button>
          <p className="mt-4 text-xs text-on-surface-variant text-center">No wallet extension needed. Your account wallet is ready in the app.</p>
        </form>
      </section>
    </div>
  );
}
