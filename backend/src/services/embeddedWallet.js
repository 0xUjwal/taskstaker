/**
 * Embedded Wallet Service
 *
 * Generates a deterministic custodial wallet for each user from their Clerk ID.
 * The backend holds the private key — suitable for testnet/demo use only.
 * Users can fund the address and the backend signs transactions on their behalf.
 *
 * Security: Never use this pattern for real funds on mainnet without HSM/MPC.
 */

const { ethers } = require("ethers");

const MASTER_SECRET = process.env.WALLET_MASTER_SECRET || "taskstaker-dev-secret-change-in-prod";

/**
 * Derive a deterministic wallet for a given Clerk user ID.
 * Same clerkId always produces the same wallet.
 */
function getEmbeddedWallet(clerkId) {
  const seed = ethers.utils.keccak256(
    ethers.utils.toUtf8Bytes(MASTER_SECRET + ":" + clerkId)
  );
  return new ethers.Wallet(seed);
}

/**
 * Get a funded wallet connected to the given RPC provider.
 */
function getEmbeddedWalletWithProvider(clerkId, rpcUrl) {
  const wallet = getEmbeddedWallet(clerkId);
  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  return wallet.connect(provider);
}

module.exports = { getEmbeddedWallet, getEmbeddedWalletWithProvider };
