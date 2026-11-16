require("@nomiclabs/hardhat-waffle");
require("dotenv").config();

/** @type import('hardhat/config').HardhatUserConfig */
// Guard and normalize PRIVATE_KEY from .env to avoid Hardhat config errors
const rawKey = process.env.PRIVATE_KEY
  ? process.env.PRIVATE_KEY.trim()
  : undefined;
let accounts = [];
if (rawKey && rawKey !== "your_private_key_here") {
  // Accept both 0x-prefixed (66 chars) and non-prefixed (64 chars) hex keys
  if (rawKey.length === 66 || rawKey.length === 64) {
    accounts = [rawKey];
  } else {
    console.warn(
      "WARNING: PRIVATE_KEY is set but does not look like a valid 32-byte hex key. Ignoring it for network accounts.",
    );
  }
}

function resolveRpcUrl(envName, fallbackUrls) {
  const configuredUrl = process.env[envName] ? process.env[envName].trim() : "";
  if (configuredUrl) {
    return configuredUrl;
  }

  return fallbackUrls[0];
}

module.exports = {
  solidity: "0.8.19",
  networks: {
    localhost: {
      url: "http://127.0.0.1:8545",
    },
    mumbai: {
      url: process.env.MUMBAI_RPC_URL || "https://rpc-mumbai.maticvigil.com",
      accounts,
      chainId: 80001,
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-rpc.com",
      accounts,
      chainId: 137,
    },
    sepolia: {
      url: resolveRpcUrl("SEPOLIA_RPC_URL", [
        "https://ethereum-sepolia-rpc.publicnode.com",
        "https://rpc.sepolia.org",
      ]),
      accounts,
      chainId: 11155111,
    },
    base: {
      url: process.env.BASE_RPC_URL || "https://mainnet.base.org",
      accounts,
      chainId: 8453,
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts,
      chainId: 84532,
    },
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
