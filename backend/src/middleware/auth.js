const { clerkMiddleware } = require("@clerk/express");

// Initialize Clerk middleware
const clerk = clerkMiddleware();

const { restoreWalletProof } = require('../services/walletLinkProof');

// Require authenticated user
function requireAuthentication(req, res, next) {
  res.set('Cache-Control', 'private, no-store');
  if (!getUserId(req)) return res.status(401).json({ error: 'Authentication required' });
  restoreWalletProof(getUserId(req), req.headers['x-taskstaker-wallet-proof']);
  next();
}

// Helper to get userId from request (handles both old and new Clerk API)
function getUserId(req) {
  if (typeof req.auth === "function") {
    const auth = req.auth();
    return auth.userId;
  }
  return req.auth?.userId;
}

module.exports = { clerk, requireAuthentication, getUserId };
