const { clerkMiddleware, requireAuth, getAuth } = require("@clerk/express");

// Initialize Clerk middleware
const clerk = clerkMiddleware();

// Require authenticated user
const requireAuthentication = requireAuth();

// Helper to get userId from request (handles both old and new Clerk API)
function getUserId(req) {
  if (typeof req.auth === "function") {
    const auth = req.auth();
    return auth.userId;
  }
  return req.auth?.userId;
}

module.exports = { clerk, requireAuthentication, getUserId };
