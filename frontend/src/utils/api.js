import { signer } from './web3';
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

function walletProofKey(token) {
  try {
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return `ts_verified_wallet:${JSON.parse(atob(payload)).sub}`;
  } catch { return null; }
}

async function fetchApi(path, options = {}) {
  let walletProof;
  try {
    const token = options.headers?.Authorization?.replace(/^Bearer /, '');
    const key = token && walletProofKey(token);
    walletProof = key && localStorage.getItem(key);
  } catch {}
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      ...(walletProof ? { 'X-TaskStaker-Wallet-Proof': walletProof } : {}),
      ...(options.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(err.error || `Request failed: ${res.status}`);
  }

  return res.json();
}

export function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

// Users
export const registerUser = (token, username) =>
  fetchApi("/api/users/register", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ username }),
  });

export async function linkWallet(token, walletAddress) {
  if (!signer) throw new Error('Connect your wallet first.');
  const challenge = await fetchApi(`/api/users/wallet-challenge?walletAddress=${encodeURIComponent(walletAddress)}`, {
    headers: authHeaders(token),
  });
  const signature = await signer.signMessage(challenge.message);
  const result = await fetchApi('/api/users/link-wallet', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ walletAddress, signature, challengeId: challenge.challengeId }),
  });
  try {
    const key = walletProofKey(token);
    if (key && result.walletProof) localStorage.setItem(key, result.walletProof);
  } catch {}
  return result;
}

export const resolveUser = (username) =>
  fetchApi(`/api/users/resolve/${username}`);

export const getMe = (token) =>
  fetchApi("/api/users/me", { headers: authHeaders(token) });

// AI
export async function analyzeProof(
  token,
  { taskDescription, proofText, taskId, proofUrl, file },
) {
  const formData = new FormData();
  formData.append("taskDescription", taskDescription);
  if (proofText) formData.append("proofText", proofText);
  if (taskId !== undefined) formData.append("taskId", String(taskId));
  if (proofUrl) formData.append("proofUrl", proofUrl);
  if (file) formData.append("file", file);

  return fetchApi("/api/ai/analyze", {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });
}

export async function chatWithAI(token, { messages, taskDescription, file }) {
  const formData = new FormData();
  formData.append("messages", JSON.stringify(messages));
  formData.append("taskDescription", taskDescription);
  if (file) formData.append("file", file);

  return fetchApi("/api/ai/chat", {
    method: "POST",
    headers: authHeaders(token),
    body: formData,
  });
}

export const getAnalysis = (token, taskId) => fetchApi(`/api/ai/analysis/${taskId}`, { headers: authHeaders(token) });

// Notifications
export const getNotifications = (token) =>
  fetchApi("/api/notifications", { headers: authHeaders(token) });

export const getUnreadCount = (token) =>
  fetchApi("/api/notifications/unread-count", { headers: authHeaders(token) });

export const markRead = (token, id) =>
  fetchApi(`/api/notifications/${id}/read`, {
    method: "PATCH",
    headers: authHeaders(token),
  });

export const markAllRead = (token) =>
  fetchApi("/api/notifications/read-all", {
    method: "PATCH",
    headers: authHeaders(token),
  });

// Leaderboard
export const getLeaderboard = () => fetchApi("/api/leaderboard");

// Tasks (off-chain proof submission / validation)
export const submitProofOffChain = (token, payload) =>
  fetchApi("/api/tasks/submit-proof", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

export const validateTaskOffChain = (token, payload) =>
  fetchApi("/api/tasks/validate", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

export const assignValidator = (token, payload) =>
  fetchApi("/api/tasks/assign-validator", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

export const getMyTasks = (token) =>
  fetchApi('/api/tasks/mine', { headers: authHeaders(token), cache: 'no-store' });

export const getTaskAssignments = (token, taskIds) =>
  fetchApi(`/api/tasks/assignments?taskIds=${taskIds.join(",")}`, { headers: authHeaders(token) });

export const getOriginalStakes = (taskIds) =>
  fetchApi(`/api/tasks/original-stakes?taskIds=${taskIds.join(",")}`);


// Backend config (includes relayer address)
export const getConfig = () => fetchApi("/api/config");

// ETH/USD price
export const getEthPrice = () => fetchApi("/api/price/eth");

// Embedded wallet
export const getEmbeddedWalletInfo = (token) =>
  fetchApi("/api/wallet/info", { headers: authHeaders(token) });

export const getWalletBalances = (token, chains) =>
  fetchApi(`/api/wallet/balances?chains=${chains.join(",")}`, {
    headers: authHeaders(token),
  });

export const createTaskEmbedded = (token, payload) =>
  fetchApi("/api/wallet/create-task", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });

export const claimFundsEmbedded = (token, payload) =>
  fetchApi("/api/wallet/claim", {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify(payload),
  });
