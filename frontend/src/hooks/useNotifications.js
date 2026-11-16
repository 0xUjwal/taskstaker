import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/clerk-react";
import { supabase } from "../utils/supabase";
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

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!supabase || !userId) return;

    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new, ...prev]);
          setUnreadCount((prev) => prev + 1);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

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
