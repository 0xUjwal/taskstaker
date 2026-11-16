const express = require("express");
const { requireAuthentication, getUserId } = require("../middleware/auth");
const supabase = require("../services/supabase");

const router = express.Router();

// Get notifications for the current user
router.get("/", requireAuthentication, async (req, res) => {
  try {
    const clerkId = getUserId(req);

    // Get user id from clerk_id
    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkId)
      .single();

    if (!user) return res.status(404).json({ error: "User not found" });

    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({ notifications: data || [] });
  } catch (err) {
    console.error("Get notifications error:", err);
    res.status(500).json({ error: "Failed to get notifications" });
  }
});

// Get unread count
router.get("/unread-count", requireAuthentication, async (req, res) => {
  try {
    const clerkId = getUserId(req);

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkId)
      .single();

    if (!user) return res.status(404).json({ error: "User not found" });

    const { count, error } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false);

    if (error) throw error;

    res.json({ count: count || 0 });
  } catch (err) {
    console.error("Unread count error:", err);
    res.status(500).json({ error: "Failed to get unread count" });
  }
});

// Mark notification as read
router.patch("/:id/read", requireAuthentication, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ error: "Failed to mark notification" });
  }
});

// Mark all as read
router.patch("/read-all", requireAuthentication, async (req, res) => {
  try {
    const clerkId = getUserId(req);

    const { data: user } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkId)
      .single();

    if (!user) return res.status(404).json({ error: "User not found" });

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    if (error) throw error;

    res.json({ success: true });
  } catch (err) {
    console.error("Mark all read error:", err);
    res.status(500).json({ error: "Failed to mark all as read" });
  }
});

module.exports = router;
