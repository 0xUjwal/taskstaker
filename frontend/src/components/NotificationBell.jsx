import { useState, useRef, useEffect } from "react";
import { useNotifications } from "../hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";

export default function NotificationBell({ userId }) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications(userId);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const typeIcons = {
    deadline_approaching: "schedule",
    proof_submitted: "upload_file",
    task_validated: "verified",
    validation_needed: "help",
  };

  const typeColors = {
    deadline_approaching: "text-error bg-error/10",
    proof_submitted: "text-primary bg-primary/10",
    task_validated: "text-tertiary bg-tertiary/10",
    validation_needed: "text-secondary bg-secondary/10",
  };

  return (
    <div className="relative" ref={ref}>
      <button aria-label="Notifications" aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="relative p-2 hover:bg-surface-variant/50 rounded-lg transition-colors"
      >
        <span className="material-symbols-outlined text-on-surface-variant text-xl">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-error text-on-error text-[10px] font-bold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notification-popover absolute right-0 top-full mt-2 w-80 glass-strong rounded-xl z-50 max-h-96 overflow-hidden flex flex-col animate-fade-up">
          <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/10">
            <h3 className="font-headline font-bold text-sm text-on-surface">Notifications</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] text-primary hover:text-primary-dim font-label font-bold flex items-center gap-1 uppercase tracking-wider transition-colors"
              >
                <span className="material-symbols-outlined text-sm">done_all</span>
                Mark all read
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="p-6 text-center text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-outline text-3xl block mb-2">notifications_off</span>
                No notifications yet
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`px-4 py-3 border-b border-outline-variant/5 cursor-pointer hover:bg-surface-variant/30 transition-colors ${
                    !n.read ? "bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    <span className={`material-symbols-outlined text-sm w-5 h-5 flex items-center justify-center rounded-full mt-0.5 ${typeColors[n.type] || "bg-surface-container-highest text-on-surface-variant"}`}>
                      {typeIcons[n.type] || "notifications"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-on-surface truncate">{n.title}</p>
                      <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-outline mt-1 font-label">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.read && (
                      <span className="w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0 shadow-[0_0_6px_rgba(255,59,48,0.5)]" />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
