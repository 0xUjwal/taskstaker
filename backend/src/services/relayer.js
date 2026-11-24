/**
 * Relayer service — the backend server wallet that calls submitProof and validateTask
 * on the smart contract on behalf of users, removing the need for them to sign those
 * specific transactions in MetaMask.
 *
 * The relayer address must match what was passed to the TaskStakerV2 constructor on deploy.
 * Set RELAYER_PRIVATE_KEY in backend/.env to the corresponding private key.
 */

const { ethers } = require("ethers");

let relayerContract = null;
let relayerWallet = null;

function getRelayerContract() {
  if (relayerContract) return relayerContract;

  const privateKey = process.env.RELAYER_PRIVATE_KEY;
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  const contractAddress = process.env.CONTRACT_ADDRESS;

  if (!privateKey || !rpcUrl || !contractAddress) {
    throw new Error(
      "Relayer not configured. Set RELAYER_PRIVATE_KEY, SEPOLIA_RPC_URL, and CONTRACT_ADDRESS in backend/.env",
    );
  }

  const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
  relayerWallet = new ethers.Wallet(privateKey, provider);

  const abi = require("../../abi/TaskStakerV2.json").abi;
  relayerContract = new ethers.Contract(contractAddress, abi, relayerWallet);

  console.log("Relayer wallet address:", relayerWallet.address);
  return relayerContract;
}

async function relaySubmitProof(taskId, proofUrl) {
  const c = getRelayerContract();
  const proofGas = await c.estimateGas
    .submitProof(taskId, proofUrl)
    .then((g) => g.mul(120).div(100))
    .catch(() => ethers.BigNumber.from(400000));
  const tx = await c.submitProof(taskId, proofUrl, { gasLimit: proofGas });
  // Fire-and-forget — don't block HTTP response on block confirmation
  tx.wait().catch((err) =>
    console.error(`submitProof tx failed [${tx.hash}]:`, err.message),
  );
  return { txHash: tx.hash };
}

async function relayValidateTask(taskId) {
  const c = getRelayerContract();
  const valGas = await c.estimateGas
    .validateTask(taskId)
    .then((g) => g.mul(120).div(100))
    .catch(() => ethers.BigNumber.from(300000));
  const tx = await c.validateTask(taskId, { gasLimit: valGas });
  // Fire-and-forget
  tx.wait().catch((err) =>
    console.error(`validateTask tx failed [${tx.hash}]:`, err.message),
  );
  return { txHash: tx.hash };
}

async function relayForfeitStake(taskId) {
  const c = getRelayerContract();
  const gas = await c.estimateGas
    .forfeitStake(taskId)
    .then((g) => g.mul(120).div(100));
  const tx = await c.forfeitStake(taskId, { gasLimit: gas });
  tx.wait().catch((err) =>
    console.error(`forfeitStake tx failed [${tx.hash}]:`, err.message),
  );
  return { txHash: tx.hash };
}

function getRelayerAddress() {
  getRelayerContract(); // ensure init
  return relayerWallet?.address;
}

module.exports = { relaySubmitProof, relayValidateTask, relayForfeitStake, getRelayerAddress };
