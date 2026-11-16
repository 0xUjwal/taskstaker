import { ethers } from "ethers";
import TaskStakerAbi from "../abis/TaskStakerV2.json";
import { CHAINS, SUPPORTED_CHAIN_IDS, DEFAULT_CHAIN } from "../config/chains";

export let provider;
export let signer;
export let contract;
export let userAddress;

/** Read-only provider/contract — no wallet needed for task list loading */
export function getReadOnlyContract() {
  const address = import.meta.env.VITE_CONTRACT_ADDRESS;
  if (!address) return null;
  const chain = DEFAULT_CHAIN;
  const rpcUrl = chain.rpcUrls?.[0] || chain.rpcUrl;
  const readProvider = new ethers.providers.JsonRpcProvider(rpcUrl);
  return new ethers.Contract(address, TaskStakerAbi.abi, readProvider);
}
let hasAttachedWalletListeners = false;

export async function initWeb3(contractAddress) {
  if (typeof window.ethereum === "undefined") {
    throw new Error("Please install MetaMask to use this dApp");
  }

  await window.ethereum.request({ method: "eth_requestAccounts" });

  provider = new ethers.providers.Web3Provider(window.ethereum);
  signer = provider.getSigner();
  userAddress = await signer.getAddress();

  contract = new ethers.Contract(contractAddress, TaskStakerAbi.abi, signer);

  if (!hasAttachedWalletListeners) {
    window.ethereum.on("accountsChanged", (accounts) => {
      if (accounts.length === 0) return;
      window.location.reload();
    });

    window.ethereum.on("chainChanged", () => {
      window.location.reload();
    });

    hasAttachedWalletListeners = true;
  }

  return { provider, signer, contract, userAddress };
}

export async function getNetwork() {
  if (!provider) throw new Error("Provider not initialized");
  return await provider.getNetwork();
}

export async function switchToSepolia() {
  const chain = DEFAULT_CHAIN;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: chain.chainIdHex }],
    });
  } catch (err) {
    // Chain not added yet — add it
    if (err.code === 4902) {
      await configureSepoliaChain();
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chain.chainIdHex }],
      });
    }
  }
}

function getRpcUrls(preferFallback = false) {
  const chain = DEFAULT_CHAIN;
  const urls = chain.rpcUrls || [chain.rpcUrl];
  if (!preferFallback || urls.length < 2) {
    return urls;
  }

  const [first, ...rest] = urls;
  return [...rest, first];
}

export async function configureSepoliaChain(preferFallback = false) {
  const chain = DEFAULT_CHAIN;
  await window.ethereum.request({
    method: "wallet_addEthereumChain",
    params: [{
      chainId: chain.chainIdHex,
      chainName: chain.name,
      nativeCurrency: chain.currency,
      rpcUrls: getRpcUrls(preferFallback),
      blockExplorerUrls: chain.explorer ? [chain.explorer] : [],
    }],
  });
}

export async function getWalletSummary() {
  if (!provider || !signer) {
    throw new Error("Provider not initialized");
  }

  const [network, address, balanceWei] = await Promise.all([
    provider.getNetwork(),
    signer.getAddress(),
    provider.getBalance(await signer.getAddress()),
  ]);

  return {
    address,
    network,
    balanceEth: Number(ethers.utils.formatEther(balanceWei)).toFixed(4),
  };
}

export async function disconnectWallet() {
  provider = undefined;
  signer = undefined;
  contract = undefined;
  userAddress = undefined;

  if (window.ethereum?.request) {
    try {
      await window.ethereum.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // Some wallets don't support revoke permissions; clearing local state is enough.
    }
  }
}

export function isChainSupported(chainId) {
  return SUPPORTED_CHAIN_IDS.includes(chainId);
}

export function formatEther(wei) {
  return ethers.utils.formatEther(wei);
}

export function parseEther(ether) {
  return ethers.utils.parseEther(ether.toString());
}

export function formatTimestamp(timestamp) {
  return new Date(timestamp * 1000).toLocaleString();
}
