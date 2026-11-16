/**
 * Sets the relayer address on the deployed TaskStakerV2 contract.
 *
 * Run from the contract directory:
 *   node scripts/setRelayer.js
 *
 * Reads from:
 *   contract/.env  — PRIVATE_KEY (deployer/owner), SEPOLIA_RPC_URL, RELAYER_ADDRESS
 *   backend/.env   — CONTRACT_ADDRESS (if not in contract/.env)
 */

require("dotenv").config();
const { ethers } = require("ethers");
const path = require("path");

// Also load backend .env for CONTRACT_ADDRESS if not already set
if (!process.env.CONTRACT_ADDRESS) {
  require("dotenv").config({ path: path.join(__dirname, "../../backend/.env"), override: false });
}

async function main() {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const privateKey = process.env.PRIVATE_KEY;
  const contractAddress = process.env.CONTRACT_ADDRESS;
  const newRelayer = process.env.RELAYER_ADDRESS;

  if (!rpcUrl || !privateKey || !contractAddress || !newRelayer) {
    console.error("Missing required env vars. Need: SEPOLIA_RPC_URL, PRIVATE_KEY, CONTRACT_ADDRESS, RELAYER_ADDRESS");
    process.exit(1);
  }

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  const abi = [
    "function setRelayer(address _relayer) external",
    "function relayer() view returns (address)",
    "function owner() view returns (address)",
  ];
  const contract = new ethers.Contract(contractAddress, abi, wallet);

  const [currentRelayer, owner] = await Promise.all([contract.relayer(), contract.owner()]);

  console.log("Contract:       ", contractAddress);
  console.log("Deployer wallet:", wallet.address);
  console.log("Contract owner: ", owner);
  console.log("Current relayer:", currentRelayer);
  console.log("New relayer:    ", newRelayer);

  if (wallet.address.toLowerCase() !== owner.toLowerCase()) {
    console.error("\nERROR: Deployer wallet does not match contract owner. Cannot call setRelayer.");
    process.exit(1);
  }

  if (currentRelayer.toLowerCase() === newRelayer.toLowerCase()) {
    console.log("\nRelayer is already set correctly — no action needed.");
    return;
  }

  console.log("\nCalling setRelayer...");
  const tx = await contract.setRelayer(newRelayer, { gasLimit: 60000 });
  console.log("Tx sent:", tx.hash);
  await tx.wait();

  const updated = await contract.relayer();
  console.log("Done! Relayer updated to:", updated);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
