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
