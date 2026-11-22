const { ethers } = require('ethers');
const supabase = require('./supabase');
const { verifiedAddress } = require('./walletLinkProof');
const { getEmbeddedWallet } = require('./embeddedWallet');

// An assignment belongs to accounts, not to whichever wallet is connected in
// the browser. Never let a shared/stale wallet override an account assignment.
function taskRoles(task, assignment, user, embeddedAddress, relayerAddress) {
  const wallets = new Set([embeddedAddress, user.wallet_address].filter(Boolean).map(a => a.toLowerCase()));
  const isLegacyTask = task.validator.toLowerCase() !== (relayerAddress || '').toLowerCase();
  const isOwner = assignment?.owner_user_id
    ? assignment.owner_user_id === user.id
    : wallets.has(task.user.toLowerCase());
  const isValidator = !isOwner && (assignment
    ? assignment.validator_user_id === user.id
    : isLegacyTask && wallets.has(task.validator.toLowerCase()));
  return { isOwner, isValidator, isLegacyTask, isLegacyValidator: !assignment && isValidator };
}

function readContract() {
  return new ethers.Contract(process.env.CONTRACT_ADDRESS,
    require('../../abi/TaskStakerV2.json').abi,
    new ethers.providers.JsonRpcProvider(process.env.SEPOLIA_RPC_URL));
}

async function accountContext(clerkId) {
  const { data: user, error } = await supabase.from('users')
    .select('id, wallet_address').eq('clerk_id', clerkId).single();
  if (error || !user) throw Object.assign(new Error('User not registered'), { status: 404 });
  // Old saved addresses are unverified. Never infer legacy task ownership from
  // them until this account has proved control of that exact wallet.
  return { user: { ...user, wallet_address: verifiedAddress(clerkId, user.wallet_address) },
    embeddedAddress: getEmbeddedWallet(clerkId).address };
}

async function requireTaskAccess(clerkId, taskId, ownerOnly = false) {
  if (!Number.isSafeInteger(Number(taskId)) || Number(taskId) < 0) {
    throw Object.assign(new Error('Invalid task ID'), { status: 400 });
  }
  const [{ user, embeddedAddress }, { data: assignment, error }] = await Promise.all([
    accountContext(clerkId),
    supabase.from('task_validators').select('*').eq('task_id', Number(taskId)).maybeSingle(),
  ]);
  if (error) throw error;
  const task = await readContract().getTask(Number(taskId));
  const roles = taskRoles(task, assignment, user, embeddedAddress, process.env.RELAYER_ADDRESS);
  if (!roles.isOwner && (ownerOnly || !roles.isValidator)) {
    throw Object.assign(new Error('Task not found'), { status: 404 });
  }
  return { task, assignment, user, ...roles };
}

module.exports = { taskRoles, readContract, accountContext, requireTaskAccess };
