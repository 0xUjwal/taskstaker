// scripts/deploy.js
async function main() {
  console.log("Starting deployment...");

  const signers = await ethers.getSigners();
  if (!signers.length) {
    throw new Error(
      "No deployer account available. Set PRIVATE_KEY in contract/.env to a funded Sepolia wallet and run the deploy again."
    );
  }

  const [deployer] = signers;
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await deployer.getBalance()).toString());

  // The relayer is the backend server wallet address.
  // Set RELAYER_ADDRESS in contract/.env, or fall back to deployer for local dev.
  const relayerAddress = process.env.RELAYER_ADDRESS || deployer.address;
  console.log("Relayer address:", relayerAddress);

  const TaskStaker = await ethers.getContractFactory("TaskStakerV2");
  const taskStaker = await TaskStaker.deploy(relayerAddress);

  await taskStaker.deployed();

  console.log("TaskStakerV2 deployed to:", taskStaker.address);
  console.log("\nCopy these to your frontend and backend .env files:");
  console.log(`VITE_CONTRACT_ADDRESS=${taskStaker.address}`);
  console.log(`CONTRACT_ADDRESS=${taskStaker.address}`);
  console.log(`RELAYER_ADDRESS=${relayerAddress}`);
  console.log("\nABI location: artifacts/contracts/TaskStakerV2.sol/TaskStakerV2.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
