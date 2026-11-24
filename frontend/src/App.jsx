import { Routes, Route, Navigate } from "react-router-dom";
import { SignedIn, SignedOut, SignOutButton, useUser } from "@clerk/clerk-react";
import Landing from "./components/Landing";
import Dashboard from "./components/Dashboard";
import Leaderboard from "./components/Leaderboard";
import Profile from "./components/Profile";
import Layout from "./components/Layout";
import UsernameSetup from "./components/UsernameSetup";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAuth } from "@clerk/clerk-react";
import { getMe } from "./utils/api";
import { loadAccountProfile } from "./utils/profileLoading.mjs";
import { disconnectWallet } from "./utils/web3";

function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <>
            <SignedOut>
              <Landing />
            </SignedOut>
            <SignedIn>
              <AuthenticatedApp />
            </SignedIn>
          </>
        }
      />
      <Route
        path="/dashboard"
        element={
          <SignedIn>
            <AuthenticatedApp />
          </SignedIn>
        }
      />
      <Route
        path="/leaderboard"
        element={
          <SignedIn>
            <AuthenticatedApp page="leaderboard" />
          </SignedIn>
        }
      />
      <Route
        path="/profile"
        element={
          <SignedIn>
            <AuthenticatedApp page="profile" />
          </SignedIn>
        }
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function AuthenticatedApp({ page }) {
  const { userId } = useAuth();
  // Remount all account-owned state, including tasks, wallet and async requests,
  // when Clerk switches accounts without a full browser reload.
  return userId ? <AccountApp key={userId} page={page} /> : null;
}

function AccountApp({ page }) {
  const { getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [retryTick, setRetryTick] = useState(0);
  const [walletState, setWalletState] = useState({
    connected: false,
    address: "",
    networkName: "",
    chainId: null,
    balanceEth: "0.0000",
  });
  const [derivedCompletedTasks, setDerivedCompletedTasks] = useState(0);
  // Ratchet: completed_tasks can only ever increase — prevents leaderboard flicker
  // when interval polls return mid-load with a lower derived count
  const maxCompletedRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setProfileError("");
    loadAccountProfile(getToken, getMe, { signal: controller.signal })
      .then(({ profile, needsSetup }) => {
        if (controller.signal.aborted) return;
        setUserProfile(profile);
        setNeedsSetup(needsSetup);
      })
      .catch(error => {
        if (!controller.signal.aborted) setProfileError(error.status === 401
          ? "Your session could not be verified. Please retry or sign in again."
          : "We couldn't reach your account. The server may be waking up. Retry to load your existing profile before setting up a username.");
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [clerkUser?.id, getToken, retryTick]);

  const refreshProfile = useCallback(async () => {
    const baseline = userProfile?.completed_tasks || 0;

    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const token = await getToken();
        const data = await getMe(token);
        setUserProfile(data.user);

        if ((data?.user?.completed_tasks || 0) > baseline) {
          return;
        }
      } catch {
        // best-effort retry
      }

      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }, [getToken, userProfile?.completed_tasks]);

  const effectiveProfile = useMemo(() => {
    if (!userProfile) return userProfile;
    const fromDb = userProfile.completed_tasks || 0;
    const candidate = Math.max(fromDb, derivedCompletedTasks, maxCompletedRef.current);
    maxCompletedRef.current = candidate; // ratchet: never let it drop
    if (candidate === fromDb) return userProfile; // same value — return original to preserve identity
    return { ...userProfile, completed_tasks: candidate };
  }, [userProfile, derivedCompletedTasks]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full crimson-gradient animate-pulse shadow-[0_0_20px_rgba(255,59,48,0.4)]" />
          <span className="text-on-surface-variant text-sm font-label uppercase tracking-widest">
            Connecting to your account...
          </span>
          <p className="text-sm text-on-surface-variant text-center px-6 max-w-sm">The server may take a moment to wake up. Your account will load automatically.</p>
        </div>
      </div>
    );
  }

  if (profileError) {
    return <div className="min-h-screen flex items-center justify-center p-5">
      <section role="alert" className="glass-card p-6 max-w-md space-y-4">
        <h1 className="text-xl font-bold">Let's reconnect your account</h1>
        <p className="text-sm text-on-surface-variant">{profileError}</p>
        <button className="btn-primary px-5 py-3 rounded-xl" onClick={() => setRetryTick(t => t + 1)}>Retry loading account</button>
        <SignOutButton><button className="block text-sm underline">Sign out and try again</button></SignOutButton>
      </section>
    </div>;
  }

  if (needsSetup) {
    return (
      <UsernameSetup
        onComplete={(profile) => {
          setUserProfile(profile);
          setNeedsSetup(false);
        }}
      />
    );
  }

  async function handleWalletDisconnect() {
    await disconnectWallet();
    setWalletState({
      connected: false,
      address: userProfile?.wallet_address || "",
      networkName: "",
      chainId: null,
      balanceEth: "0.0000",
    });
  }

  function handleExternalWalletChange(wallet) {
    if (wallet) {
      setWalletState({
        connected: true,
        address: wallet.address,
        networkName: "Sepolia",
        chainId: 11155111,
        balanceEth: wallet.balanceEth,
      });
    } else {
      handleWalletDisconnect();
    }
  }

  return (
    <Layout
      userProfile={effectiveProfile}
      walletState={walletState}
      onWalletDisconnect={handleWalletDisconnect}
      onExternalWalletChange={handleExternalWalletChange}
    >
      {page === "leaderboard" ? (
        <Leaderboard userProfile={effectiveProfile} />
      ) : page === "profile" ? (
        <Profile userProfile={effectiveProfile} walletState={walletState} onProfileChange={setUserProfile} />
      ) : (
        <Dashboard
          userProfile={effectiveProfile}
          onWalletStateChange={setWalletState}
          onProfileRefresh={refreshProfile}
          onDerivedCompletedTasks={setDerivedCompletedTasks}
          walletState={walletState}
        />
      )}
    </Layout>
  );
}

export default App;
