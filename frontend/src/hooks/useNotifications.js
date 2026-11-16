import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { getNotifications, getUnreadCount, markRead, markAllRead } from "../utils/api";

export function useNotifications(userId) {
  const { getToken } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = await getToken();
      const data = await getNotifications(token);
      setNotifications(data.notifications);
      const countData = await getUnreadCount(token);
      setUnreadCount(countData.count);
    } catch (err) {
      console.error("Failed to fetch notifications:", err);
    }
  }, [getToken]);

  // Private tables are no longer exposed through anonymous Realtime. Fetch
  // with the current Clerk session and discard late results after a switch.
  useEffect(() => {
    if (!userId) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [userId, fetchNotifications]);

  const handleMarkRead = useCallback(async (id) => {
    try {
      const token = await getToken();
      await markRead(token, id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to mark read:", err);
    }
  }, [getToken]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      const token = await getToken();
      await markAllRead(token);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("Failed to mark all read:", err);
    }
  }, [getToken]);

  return {
    notifications,
    unreadCount,
    markRead: handleMarkRead,
    markAllRead: handleMarkAllRead,
    refresh: fetchNotifications,
  };
}
