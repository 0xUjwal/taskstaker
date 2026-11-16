import { useNavigate } from "react-router-dom";
import { SignOutButton } from "@clerk/clerk-react";

export default function HamburgerMenu({ open, onClose, userProfile }) {
  const navigate = useNavigate();
  const completedTasks = userProfile?.completed_tasks || 0;
  const leaderboardLocked = completedTasks < 5;

  function handleNav(path) {
    navigate(path);
    onClose();
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed top-0 left-0 h-full w-72 glass-strong border-r border-white/10 z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-outline-variant/10">
          <div>
            <p className="font-headline font-bold text-on-surface text-sm">@{userProfile?.username}</p>
            <p className="text-[10px] text-on-surface-variant font-label uppercase tracking-widest mt-0.5">
              ID: {userProfile?.unique_id}
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-surface-variant/50 rounded-lg transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant text-lg">close</span>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          <MenuItem
            icon="dashboard"
            label="Dashboard"
            onClick={() => handleNav("/dashboard")}
          />

          <button
            onClick={() => !leaderboardLocked && handleNav("/leaderboard")}
            className={`w-full flex items-center gap-3 p-4 rounded-lg text-left transition-all font-label uppercase tracking-[0.05em] text-xs ${
              leaderboardLocked
                ? "text-outline cursor-not-allowed"
                : "text-on-surface-variant hover:bg-white/[0.06] hover:translate-x-1"
            }`}
          >
            <span className="material-symbols-outlined text-lg">
              {leaderboardLocked ? "lock" : "emoji_events"}
            </span>
            <span className="font-bold">Leaderboard</span>
            {leaderboardLocked && (
              <span className="ml-auto text-[10px] bg-surface-container-highest text-on-surface px-2 py-0.5 rounded-full border border-outline-variant/20 font-bold">
                {5 - completedTasks} more tasks
              </span>
            )}
          </button>

          <MenuItem icon="person" label="Profile" onClick={() => handleNav("/profile")} />
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-outline-variant/10">
          <div className="text-xs text-on-surface-variant mb-3 px-3 font-label">
            Tasks completed: <span className="font-bold text-primary">{completedTasks}</span>
          </div>
          <SignOutButton>
            <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-error hover:bg-error/10 transition-colors font-label uppercase tracking-[0.05em] text-xs">
              <span className="material-symbols-outlined text-lg">logout</span>
              <span className="font-bold">Sign Out</span>
            </button>
          </SignOutButton>
        </div>
      </div>
    </>
  );
}

function MenuItem({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 rounded-lg text-on-surface-variant hover:bg-white/[0.06] hover:text-on-surface transition-all hover:translate-x-1 font-label uppercase tracking-[0.05em] text-xs"
    >
      <span className="material-symbols-outlined text-lg">{icon}</span>
      <span className="font-bold">{label}</span>
    </button>
  );
}
