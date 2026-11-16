const express = require("express");
const { requireAuthentication, getUserId } = require("../middleware/auth");
const supabase = require("../services/supabase");

const router = express.Router();

// Register username after Clerk login
router.post("/register", requireAuthentication, async (req, res) => {
  try {
    const clerkId = getUserId(req);
    const { username } = req.body;

    if (!username || username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: "Username must be 3-20 characters" });
    }

    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
      return res.status(400).json({ error: "Username can only contain letters, numbers, and underscores" });
    }

    // Check if user already registered
    const { data: existing } = await supabase
      .from("users")
      .select("id")
      .eq("clerk_id", clerkId)
      .single();

    if (existing) {
      return res.status(400).json({ error: "User already registered" });
    }

    // Check username uniqueness
    const { data: taken } = await supabase
      .from("users")
      .select("id")
      .eq("username", username.toLowerCase())
      .single();

    if (taken) {
      return res.status(409).json({ error: "Username already taken" });
    }

    // Generate unique 5-digit ID
    const uniqueId = String(Math.floor(10000 + Math.random() * 90000));

    const { data, error } = await supabase.from("users").insert({
      clerk_id: clerkId,
      username: username.toLowerCase(),
      unique_id: uniqueId,
      completed_tasks: 0,
    }).select().single();

    if (error) throw error;

    res.json({ user: data });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Failed to register user" });
  }
});

// Link wallet address to user
router.post("/link-wallet", requireAuthentication, async (req, res) => {
  try {
    const clerkId = getUserId(req);
    const { walletAddress } = req.body;

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    const { data, error } = await supabase
      .from("users")
      .update({ wallet_address: walletAddress.toLowerCase() })
      .eq("clerk_id", clerkId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "User not found. Register first." });

    res.json({ user: data });
  } catch (err) {
    console.error("Link wallet error:", err);
    res.status(500).json({ error: "Failed to link wallet" });
  }
});

// Resolve username to wallet address
router.get("/resolve/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const { data, error } = await supabase
      .from("users")
      .select("username, unique_id, wallet_address")
      .or(`username.eq.${username.toLowerCase()},unique_id.eq.${username}`)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "User not found" });
    }

    // walletAddress may be null — validators don't need wallets
    res.json({
      username: data.username,
      uniqueId: data.unique_id,
      walletAddress: data.wallet_address || null,
    });
  } catch (err) {
    console.error("Resolve error:", err);
    res.status(500).json({ error: "Failed to resolve user" });
  }
});

// Get current user profile
router.get("/me", requireAuthentication, async (req, res) => {
  try {
    const clerkId = getUserId(req);

    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("clerk_id", clerkId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: "User not registered" });
    }

    res.json({ user: data });
  } catch (err) {
    console.error("Get me error:", err);
    res.status(500).json({ error: "Failed to get user" });
  }
});

module.exports = router;
