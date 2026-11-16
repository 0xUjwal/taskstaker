const { randomUUID } = require('node:crypto');
const { ethers } = require('ethers');
const challenges = new Map();
const TTL = 5 * 60 * 1000;

function createChallenge(clerkId, address, now = Date.now()) {
  if (!ethers.utils.isAddress(address)) throw new Error('Invalid wallet address');
  for (const [id, item] of challenges) if (item.expiresAt <= now) challenges.delete(id);
  const challengeId = randomUUID();
  const walletAddress = address.toLowerCase();
  const expiresAt = now + TTL;
  const message = `TaskStaker wallet link\nAccount: ${clerkId}\nWallet: ${walletAddress}\nNonce: ${challengeId}\nExpires: ${new Date(expiresAt).toISOString()}\n\nThis signature links your wallet to this TaskStaker account. It does not authorize a transaction.`;
  challenges.set(challengeId, { clerkId, walletAddress, expiresAt, message });
  return { challengeId, message, expiresAt };
}

function verifyChallenge(clerkId, address, challengeId, signature, now = Date.now()) {
  const item = challenges.get(challengeId);
  if (!item || item.expiresAt <= now || item.clerkId !== clerkId || item.walletAddress !== address?.toLowerCase()) return false;
  try {
    if (ethers.utils.verifyMessage(item.message, signature).toLowerCase() !== item.walletAddress) return false;
  } catch { return false; }
  challenges.delete(challengeId); // One-time, account-bound proof.
  return true;
}
module.exports = { createChallenge, verifyChallenge };

// A signed account-bound receipt lets a verified link survive backend restarts
// without trusting the old database address field or requiring a schema change.
const verifiedLinks = new Map();
function proofKey() {
  if (!process.env.WALLET_MASTER_SECRET) throw new Error('Wallet proof signing is not configured');
  return process.env.WALLET_MASTER_SECRET;
}
function createWalletProof(clerkId, address, now = Date.now()) {
  const item = { clerkId, address: address.toLowerCase(), expiresAt: now + 30 * 24 * 60 * 60 * 1000 };
  const payload = Buffer.from(JSON.stringify(item)).toString('base64url');
  const mac = require('node:crypto').createHmac('sha256', proofKey()).update(payload).digest('base64url');
  verifiedLinks.set(clerkId, item);
  return `${payload}.${mac}`;
}
function restoreWalletProof(clerkId, proof, now = Date.now()) {
  try {
    if (typeof proof !== 'string' || proof.length > 4096) return false;
    const parts = proof.split('.'); if (parts.length !== 2) return false;
    const [payload, signature] = parts;
    const expected = require('node:crypto').createHmac('sha256', proofKey()).update(payload).digest();
    const actual = Buffer.from(signature, 'base64url');
    if (actual.length !== expected.length || !require('node:crypto').timingSafeEqual(actual, expected)) return false;
    const item = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (item.clerkId !== clerkId || !ethers.utils.isAddress(item.address) || !Number.isFinite(item.expiresAt) || item.expiresAt <= now) return false;
    verifiedLinks.set(clerkId, item);
    return true;
  } catch { return false; }
}
function verifiedAddress(clerkId, savedAddress, now = Date.now()) {
  const item = verifiedLinks.get(clerkId);
  return item && item.expiresAt > now && item.address === savedAddress?.toLowerCase() ? item.address : null;
}
module.exports = { createChallenge, verifyChallenge, createWalletProof, restoreWalletProof, verifiedAddress };
