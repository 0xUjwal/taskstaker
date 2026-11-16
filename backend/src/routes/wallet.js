/**
 * Wallet routes — embedded custodial wallet + multi-chain balances.
 *
 * GET  /api/wallet/info              — embedded wallet address + Sepolia ETH balance
 * GET  /api/wallet/balances          — ETH + ERC-20 balances across chains
 * POST /api/wallet/create-task       — create task using embedded wallet (no MetaMask popup)
 * POST /api/wallet/claim             — claim funds using embedded wallet
 */

const express = require("express");
const { ethers } = require("ethers");
const { requireAuthentication, getUserId } = require("../middleware/auth");
const {
  getEmbeddedWallet,
  getEmbeddedWalletWithProvider,
} = require("../services/embeddedWallet");
const supabase = require("../services/supabase");

const router = express.Router();

const CHAIN_RPCS = {
  sepolia:
    process.env.SEPOLIA_RPC_URL ||
    "https://ethereum-sepolia-rpc.publicnode.com",
  base: process.env.BASE_RPC_URL || "https://mainnet.base.org",
  polygon: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
};

const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// Token addresses per chain
const TOKENS = {
  base: [
    {
      symbol: "USDC",
      address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      decimals: 6,
    },
    {
      symbol: "USDT",
      address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2",
      decimals: 6,
    },
  ],
  polygon: [
    {
      symbol: "USDC",
      address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
      decimals: 6,
    },
    {
      symbol: "USDT",
      address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
      decimals: 6,
    },
  ],
  sepolia: [],
};

async function getChainBalances(address, chainKey) {
  try {
    const rpcUrl = CHAIN_RPCS[chainKey];
    if (!rpcUrl) return null;

    const provider = new ethers.providers.JsonRpcProvider(rpcUrl);
    const nativeBalanceWei = await provider.getBalance(address);
    const nativeBalance = parseFloat(
      ethers.utils.formatEther(nativeBalanceWei),
    );

    const tokenBalances = [];
    for (const token of TOKENS[chainKey] || []) {
      try {
        const contract = new ethers.Contract(
          token.address,
          ERC20_ABI,
          provider,
        );
        const raw = await contract.balanceOf(address);
        const formatted = parseFloat(
          ethers.utils.formatUnits(raw, token.decimals),
        );
        tokenBalances.push({
          symbol: token.symbol,
          balance: formatted,
          address: token.address,
        });
      } catch {
        tokenBalances.push({
          symbol: token.symbol,
          balance: 0,
          address: token.address,
        });
      }
    }

    return { nativeBalance, tokens: tokenBalances };
  } catch {
    return null;
  }
}

/**
 * GET /api/wallet/info
 * Returns embedded wallet address and Sepolia ETH balance.
 */
router.get("/info", requireAuthentication, async (req, res) => {
  try {
    const clerkId = getUserId(req);
    const wallet = getEmbeddedWallet(clerkId);
    const address = wallet.address;

    const provider = new ethers.providers.JsonRpcProvider(CHAIN_RPCS.sepolia);
    const balanceWei = await provider
      .getBalance(address)
      .catch(() => ethers.BigNumber.from(0));
    const balanceEth = parseFloat(ethers.utils.formatEther(balanceWei));

    res.json({ address, balanceEth });
  } catch (err) {
    console.error("Wallet info error:", err);
    res.status(500).json({ error: "Failed to get wallet info" });
  }
});

/**
 * GET /api/wallet/balances?chains=sepolia,base,polygon
 * Returns ETH + ERC-20 balances for the embedded wallet across requested chains.
 */
router.get("/balances", requireAuthentication, async (req, res) => {
  try {
    const clerkId = getUserId(req);
    const wallet = getEmbeddedWallet(clerkId);
    const address = wallet.address;

    const requestedChains = (req.query.chains || "sepolia")
      .split(",")
      .filter((c) => CHAIN_RPCS[c]);

    const results = await Promise.all(
      requestedChains.map(async (chainKey) => {
        const data = await getChainBalances(address, chainKey);
        return [chainKey, data];
      }),
    );

    const balances = Object.fromEntries(results.filter(([, v]) => v !== null));
    res.json({ address, balances });
  } catch (err) {
    console.error("Wallet balances error:", err);
    res.status(500).json({ error: "Failed to get balances" });
  }
});

/**
 * POST /api/wallet/create-task
 * Creates a task on-chain using the user's embedded wallet.
 * Body: { taskName, hours, stakeEth, validatorUsername }
 *
 * No MetaMask popup — the backend signs with the embedded wallet key.
 */
router.post("/create-task", requireAuthentication, async (req, res) => {
  try {
    const clerkId = getUserId(req);
    const { taskName, hours, stakeEth, validatorUsername } = req.body;

    if (!taskName || !hours || !stakeEth || !validatorUsername) {
      return res
        .status(400)
        .json({
          error: "taskName, hours, stakeEth, validatorUsername required",
        });
    }

    const hoursNum = parseInt(hours);
    if (isNaN(hoursNum) || hoursNum < 1) {
      return res.status(400).json({ error: "Minimum deadline is 1 hour" });
    }

    const ethVal = parseFloat(stakeEth);
    if (isNaN(ethVal) || ethVal <= 0) {
      return res.status(400).json({ error: "Stake must be > 0" });
    }

    const relayerAddress = process.env.RELAYER_ADDRESS;
    const contractAddress = process.env.CONTRACT_ADDRESS;
    if (!relayerAddress || !contractAddress) {
      return res.status(500).json({ error: "Backend not fully configured" });
    }

    // Resolve validator + owner in parallel
    const [{ data: validator }, { data: owner }] = await Promise.all([
      supabase
        .from("users")
        .select("id, username")
        .or(
          `username.eq.${validatorUsername.toLowerCase()},unique_id.eq.${validatorUsername}`,
        )
        .single(),
      supabase
        .from("users")
        .select("id, username")
        .eq("clerk_id", clerkId)
        .single(),
    ]);
    if (!validator)
      return res.status(404).json({ error: "Validator not found" });
    if (!owner) return res.status(404).json({ error: "User not found" });

    // Sign + send with embedded wallet
    const wallet = getEmbeddedWalletWithProvider(clerkId, CHAIN_RPCS.sepolia);
    const balance = await wallet.getBalance();
    const stakeWei = ethers.utils.parseEther(stakeEth.toString());

    if (balance.lte(stakeWei)) {
      return res.status(400).json({
        error: `Insufficient balance. Wallet has ${parseFloat(
          ethers.utils.formatEther(balance),
        ).toFixed(4)} ETH, need ${ethVal} ETH + gas.`,
        balanceEth: parseFloat(ethers.utils.formatEther(balance)),
      });
    }

    const abi = require("../../abi/TaskStakerV2.json").abi;
    const contract = new ethers.Contract(contractAddress, abi, wallet);

    const tx = await contract.createTask(taskName, hoursNum, relayerAddress, {
      value: stakeWei,
      gasLimit: 250000,
    });

    // Respond immediately with txHash (optimistic)
    res.json({ success: true, txHash: tx.hash, status: "pending" });

    // Confirm in background + assign validator (retry upsert up to 3 times)
    tx.wait()
      .then(async (receipt) => {
        const event = receipt.events?.find((e) => e.event === "TaskCreated");
        const taskId = event?.args?.taskId?.toString();

        if (taskId !== undefined) {
          let upsertError;
          for (let attempt = 0; attempt < 3; attempt++) {
            const { error } = await supabase.from("task_validators").upsert(
              {
                task_id: Number(taskId),
                validator_user_id: validator.id,
                owner_user_id: owner.id,
                task_name: taskName,
                owner_username: owner.username,
                validator_username: validator.username,
                stake_eth: stakeEth.toString(),
              },
              { onConflict: "task_id" },
            );
            if (!error) { upsertError = null; break; }
            upsertError = error;
            if (attempt < 2) await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
          }
          if (upsertError) {
            console.error("task_validators upsert failed after retries:", upsertError.message);
          }

          await supabase.from("notifications").insert({
            user_id: validator.id,
            type: "validation_needed",
            title: "New task assigned to you",
            message: `@${owner.username} assigned you as validator for task #${taskId}: "${taskName}"`,
            task_id: Number(taskId),
          });
        }
      })
      .catch((err) =>
        console.error("Embedded create-task confirmation failed:", err.message),
      );
  } catch (err) {
    console.error("Embedded create-task error:", err);
    res
      .status(500)
      .json({ error: err.reason || err.message || "Failed to create task" });
  }
});

/**
 * POST /api/wallet/claim
 * Claims validated task funds using the user's embedded wallet.
 * Body: { taskId }
 */
router.post("/claim", requireAuthentication, async (req, res) => {
  try {
    const clerkId = getUserId(req);
    const { taskId } = req.body;

    if (taskId === undefined) {
      return res.status(400).json({ error: "taskId is required" });
    }

    const contractAddress = process.env.CONTRACT_ADDRESS;
    if (!contractAddress) {
      return res.status(500).json({ error: "Backend not fully configured" });
    }

    const wallet = getEmbeddedWalletWithProvider(clerkId, CHAIN_RPCS.sepolia);
    const abi = require("../../abi/TaskStakerV2.json").abi;
    const provider = new ethers.providers.JsonRpcProvider(CHAIN_RPCS.sepolia);
    const readContract = new ethers.Contract(contractAddress, abi, provider);

    // Verify this embedded wallet is the task owner
    const task = await readContract.getTask(Number(taskId));
    if (task.user.toLowerCase() !== wallet.address.toLowerCase()) {
      return res.status(403).json({
        error:
          "This task was not created with your embedded wallet. Use MetaMask to claim.",
      });
    }

    const contract = new ethers.Contract(contractAddress, abi, wallet);
    const tx = await contract.claimFunds(Number(taskId), { gasLimit: 100000 });

    res.json({ success: true, txHash: tx.hash, status: "pending" });

    tx.wait()
      .then(async (receipt) => {
        // Update completed_tasks in Supabase
        const { data: owner } = await supabase
          .from("users")
          .select("id, username, completed_tasks")
          .eq("clerk_id", clerkId)
          .single();

        if (owner) {
          const newCount = (owner.completed_tasks || 0) + 1;
          await supabase
            .from("users")
            .update({ completed_tasks: newCount })
            .eq("id", owner.id);
          await supabase.from("notifications").insert({
            user_id: owner.id,
            type: "funds_claimed",
            title: "Stake claimed!",
            message: `You've claimed your ETH from task #${taskId}. Task #${newCount} complete!`,
            task_id: Number(taskId),
          });
        }
      })
      .catch((err) =>
        console.error("Embedded claim confirmation failed:", err.message),
      );
  } catch (err) {
    console.error("Embedded claim error:", err);
    res
      .status(500)
      .json({ error: err.reason || err.message || "Failed to claim" });
  }
});

module.exports = router;
