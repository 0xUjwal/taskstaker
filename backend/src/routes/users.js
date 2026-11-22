const express = require("express");
const { requireAuthentication, getUserId } = require("../middleware/auth");
const supabase = require("../services/supabase");

const { createChallenge, verifyChallenge, createWalletProof } = require('../services/walletLinkProof');
const router = express.Router();

// Register username after Clerk login
router.post("/register", requireAuthentication, async (req, res) => {
  try {
    const clerkId = getUserId(req);
    const { username } = req.body;

    // Repeated setup requests are safe and never rename an existing account.
    const { data: existing, error: lookupError } = await supabase.from("users")
      .select("*").eq("clerk_id", clerkId).maybeSingle();
    if (lookupError) throw lookupError;
    if (existing) return res.json({ user: existing, existing: true });

    if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({ error: "Username must be 3-20 letters, numbers or underscores" });
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

// A connected wallet address alone is not proof that the account controls it.
router.get('/wallet-challenge', requireAuthentication, (req, res) => {
  try {
    res.json(createChallenge(getUserId(req), req.query.walletAddress));
  } catch {
    res.status(400).json({ error: 'Invalid wallet address' });
  }
});

// Link wallet address to user
router.post("/link-wallet", requireAuthentication, async (req, res) => {
  try {
    const clerkId = getUserId(req);
    const { walletAddress, signature, challengeId } = req.body;

    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return res.status(400).json({ error: "Invalid wallet address" });
    }

    if (!verifyChallenge(clerkId, walletAddress, challengeId, signature)) {
      return res.status(403).json({ error: 'Sign the wallet link request to prove you control this address.' });
    }
    const { data: linked, error: lookupError } = await supabase.from('users')
      .select('id').eq('wallet_address', walletAddress.toLowerCase()).neq('clerk_id', clerkId).limit(1);
    if (lookupError) throw lookupError;
    if (linked?.length) return res.status(409).json({ error: 'This wallet is already linked to another TaskStaker account.' });

    const { data, error } = await supabase
      .from("users")
      .update({ wallet_address: walletAddress.toLowerCase() })
      .eq("clerk_id", clerkId)
      .select()
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: "User not found. Register first." });

    const walletProof = createWalletProof(clerkId, walletAddress);
    res.json({ user: data, walletProof });
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

// Get current user profile. Only a successful empty lookup means setup is needed.
router.get("/me", requireAuthentication, async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  try {
    const { data, error } = await supabase.from("users").select("*")
      .eq("clerk_id", getUserId(req)).maybeSingle();
    if (error) throw error;
    if (!data) return res.status(404).json({ error: "User not registered", code: "PROFILE_NOT_FOUND" });
    res.json({ user: data });
  } catch (err) {
    console.error("Get me error:", err.message);
    res.status(503).json({ error: "Unable to load your profile. Please retry.", code: "PROFILE_UNAVAILABLE" });
  }
});

module.exports = router;
