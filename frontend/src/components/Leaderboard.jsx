import { useState, useEffect } from "react";
import { getLeaderboard } from "../utils/api";

export default function Leaderboard({ userProfile }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const completedTasks = userProfile?.completed_tasks || 0;
  const isLocked = completedTasks < 5;

  useEffect(() => {
    if (!isLocked) {
      getLeaderboard()
        .then((res) => setData(res.leaderboard))
        .catch(console.error)
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [isLocked]);

  if (isLocked) {
    return (
      <div className="glass-card p-8 text-center relative overflow-hidden">
        {/* Blurred fake data */}
        <div className="blur-sm pointer-events-none select-none mb-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex items-center gap-3 py-3 border-b border-outline-variant/10">
              <span className="w-8 h-8 bg-surface-container-highest rounded-full" />
              <div className="flex-1">
                <div className="h-3 bg-surface-container-highest rounded w-24 mb-1" />
                <div className="h-2 bg-surface-container-high rounded w-16" />
              </div>
              <div className="h-4 bg-surface-container-highest rounded w-8" />
            </div>
          ))}
        </div>

        {/* Lock overlay */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-surface/85 backdrop-blur-sm z-10">
          <div className="w-16 h-16 bg-surface-container-highest rounded-full flex items-center justify-center mb-4 border border-outline-variant/20">
            <span className="material-symbols-outlined text-on-surface-variant text-3xl">lock</span>
          </div>
          <h3 className="text-lg font-headline font-bold text-on-surface mb-1">Leaderboard Locked</h3>
          <p className="text-sm text-on-surface mb-3">
            Complete <span className="font-bold text-primary">{5 - completedTasks} more task{5 - completedTasks !== 1 ? "s" : ""}</span> to unlock
          </p>
          <div className="flex gap-1.5 mt-2">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full ${
                  i < completedTasks ? "bg-primary shadow-[0_0_6px_rgba(255,59,48,0.5)]" : "bg-surface-container-highest border border-outline-variant/20"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="w-10 h-10 rounded-full crimson-gradient animate-pulse shadow-[0_0_20px_rgba(255,59,48,0.4)] mx-auto mb-4" />
        <span className="text-sm font-label uppercase tracking-widest text-on-surface-variant">Loading...</span>
      </div>
    );
  }

  const rankIcons = {
    1: { icon: "emoji_events", color: "text-yellow-400" },
    2: { icon: "military_tech", color: "text-zinc-400" },
    3: { icon: "military_tech", color: "text-amber-600" },
  };

  return (
    <div className="glass-card overflow-hidden">
      <div className="px-5 py-4 border-b border-outline-variant/10 flex items-center gap-2">
        <span className="material-symbols-outlined text-yellow-400" style={{ fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
        <h2 className="font-headline font-bold text-on-surface">Leaderboard</h2>
      </div>

      {data.length === 0 ? (
        <div className="p-8 text-center text-sm text-on-surface-variant">
          No entries yet. Be the first!
        </div>
      ) : (
        <div>
          {data.map((entry) => {
            const rank = rankIcons[entry.rank];
            return (
              <div
                key={entry.rank}
                className={`flex items-center gap-3 px-5 py-4 border-b border-outline-variant/5 transition-colors ${
                  entry.username === userProfile?.username ? "bg-primary/[0.07]" : "hover:bg-white/[0.04]"
                }`}
              >
                <div className="w-8 h-8 flex items-center justify-center">
                  {rank ? (
                    <span className={`material-symbols-outlined ${rank.color}`} style={{ fontVariationSettings: "'FILL' 1" }}>
                      {rank.icon}
                    </span>
                  ) : (
                    <span className="text-xs font-label font-bold text-outline">{entry.rank}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-headline font-bold text-on-surface truncate">
                    @{entry.username}
                    {entry.username === userProfile?.username && (
                      <span className="ml-1.5 text-[10px] text-primary font-label">(YOU)</span>
                    )}
                  </p>
                  <p className="text-[10px] text-on-surface-variant font-label">ID: {entry.uniqueId}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-headline font-bold text-on-surface">{entry.completedTasks}</p>
                  <p className="text-[10px] text-on-surface-variant font-label uppercase tracking-widest">tasks</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
