const sepoliaPrimaryRpc = import.meta.env.VITE_SEPOLIA_RPC_URL || "https://ethereum-sepolia-rpc.publicnode.com";
const sepoliaFallbackRpc = import.meta.env.VITE_SEPOLIA_FALLBACK_RPC_URL || "https://rpc.sepolia.org";

export const CHAINS = {
  sepolia: {
    chainId: 11155111,
    chainIdHex: "0xaa36a7",
    name: "Sepolia",
    shortName: "Sepolia",
    currency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
    rpcUrl: sepoliaPrimaryRpc,
    rpcUrls: [sepoliaPrimaryRpc, sepoliaFallbackRpc],
    explorer: "https://sepolia.etherscan.io",
    color: "#627EEA",
    isTestnet: true,
  },
  base: {
    chainId: 8453,
    chainIdHex: "0x2105",
    name: "Base",
    shortName: "Base",
    currency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrl: "https://mainnet.base.org",
    rpcUrls: ["https://mainnet.base.org", "https://base.llamarpc.com"],
    explorer: "https://basescan.org",
    color: "#0052FF",
    isTestnet: false,
  },
  polygon: {
    chainId: 137,
    chainIdHex: "0x89",
    name: "Polygon",
    shortName: "Polygon",
    currency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
    rpcUrl: "https://polygon-rpc.com",
    rpcUrls: ["https://polygon-rpc.com", "https://rpc-mainnet.matic.quiknode.pro"],
    explorer: "https://polygonscan.com",
    color: "#8247E5",
    isTestnet: false,
  },
  hardhat: {
    chainId: 31337,
    chainIdHex: "0x7a69",
    name: "Hardhat Local",
    shortName: "Local",
    currency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrl: "http://127.0.0.1:8545",
    rpcUrls: ["http://127.0.0.1:8545"],
    explorer: "",
    color: "#888",
    isTestnet: true,
  },
};

// ERC-20 token addresses per chain
export const TOKENS = {
  base: {
    USDC: { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    USDT: { address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
  },
  polygon: {
    USDC: { address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", decimals: 6 },
    USDT: { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
  },
  sepolia: {
    // No standard stablecoins on Sepolia testnet
  },
};

// Minimal ERC-20 ABI for balance checks
export const ERC20_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
];

// Chains shown in the wallet panel (excludes local dev)
export const WALLET_CHAINS = ["sepolia", "base", "polygon"];

// Supported chains for staking (contract only on Sepolia)
export const SUPPORTED_CHAIN_IDS = [11155111, 31337];

export const DEFAULT_CHAIN = CHAINS.sepolia;
