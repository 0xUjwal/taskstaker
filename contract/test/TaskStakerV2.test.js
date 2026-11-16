const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("TaskStakerV2", function () {
  let owner, relayer, user, validator, outsider;
  let contract;

  const STAKE = ethers.utils.parseEther("0.01");

  async function increaseTime(seconds) {
    await ethers.provider.send("evm_increaseTime", [seconds]);
    await ethers.provider.send("evm_mine");
  }

  beforeEach(async function () {
    [owner, relayer, user, validator, outsider] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("TaskStakerV2");
    contract = await Factory.deploy(relayer.address);
    await contract.deployed();
  });

  async function createTask(hours = 24, signer = user, val = validator) {
    const tx = await contract
      .connect(signer)
      .createTask("Finish report", hours, val.address, { value: STAKE });
    return tx.wait();
  }

  describe("deployment", function () {
    it("sets owner and relayer", async function () {
      expect(await contract.owner()).to.equal(owner.address);
      expect(await contract.relayer()).to.equal(relayer.address);
    });

    it("owner can rotate relayer", async function () {
      await contract.setRelayer(outsider.address);
      expect(await contract.relayer()).to.equal(outsider.address);
    });

    it("non-owner cannot rotate relayer", async function () {
      await expect(
        contract.connect(user).setRelayer(outsider.address)
      ).to.be.revertedWith("Only owner");
    });
  });

  describe("createTask", function () {
    it("rejects zero stake", async function () {
      await expect(
        contract.connect(user).createTask("X", 24, validator.address)
      ).to.be.revertedWith("Must stake ETH");
    });

    it("rejects duration under 1 hour", async function () {
      await expect(
        contract
          .connect(user)
          .createTask("X", 0, validator.address, { value: STAKE })
      ).to.be.revertedWith("Minimum deadline is 1 hour");
    });

    it("rejects zero-address validator", async function () {
      await expect(
        contract
          .connect(user)
          .createTask("X", 24, ethers.constants.AddressZero, { value: STAKE })
      ).to.be.revertedWith("Invalid validator address");
    });

    it("rejects self-validation", async function () {
      await expect(
        contract
          .connect(user)
          .createTask("X", 24, user.address, { value: STAKE })
      ).to.be.revertedWith("Cannot validate your own task");
    });

    it("creates a task, stores stake, emits TaskCreated", async function () {
      const receipt = await createTask();
      expect(await contract.getTaskCount()).to.equal(1);

      const task = await contract.getTask(0);
      expect(task.user).to.equal(user.address);
      expect(task.validator).to.equal(validator.address);
      expect(task.name).to.equal("Finish report");
      expect(task.stake).to.equal(STAKE);
      expect(task.completed).to.equal(false);
      expect(task.validated).to.equal(false);
      expect(task.claimed).to.equal(false);
      expect(task.token).to.equal(ethers.constants.AddressZero);

      const event = receipt.events.find((e) => e.event === "TaskCreated");
      expect(event.args.taskId).to.equal(0);
      expect(event.args.user).to.equal(user.address);
      expect(event.args.stake).to.equal(STAKE);

      expect(await ethers.provider.getBalance(contract.address)).to.equal(
        STAKE
      );
    });
  });

  describe("submitProof", function () {
    beforeEach(createTask);

    it("task owner can submit proof", async function () {
      await expect(contract.connect(user).submitProof(0, "ipfs://proof"))
        .to.emit(contract, "ProofSubmitted")
        .withArgs(0, "ipfs://proof");
      const task = await contract.getTask(0);
      expect(task.completed).to.equal(true);
      expect(task.proofUrl).to.equal("ipfs://proof");
    });

    it("relayer can submit proof on behalf of the user", async function () {
      await expect(contract.connect(relayer).submitProof(0, "ipfs://proof"))
        .to.emit(contract, "ProofSubmitted")
        .withArgs(0, "ipfs://proof");
    });

    it("rejects proof from anyone else (including validator)", async function () {
      await expect(
        contract.connect(validator).submitProof(0, "ipfs://proof")
      ).to.be.revertedWith("Not authorized");
      await expect(
        contract.connect(outsider).submitProof(0, "ipfs://proof")
      ).to.be.revertedWith("Not authorized");
    });

    it("rejects double submission", async function () {
      await contract.connect(user).submitProof(0, "ipfs://proof");
      await expect(
        contract.connect(user).submitProof(0, "ipfs://proof2")
      ).to.be.revertedWith("Already completed");
    });

    it("rejects proof after deadline", async function () {
      await increaseTime(25 * 3600);
      await expect(
        contract.connect(user).submitProof(0, "ipfs://proof")
      ).to.be.revertedWith("Deadline passed");
    });

    it("rejects invalid task id", async function () {
      await expect(
        contract.connect(user).submitProof(99, "ipfs://proof")
      ).to.be.revertedWith("Invalid task ID");
    });
  });

  describe("validateTask", function () {
    beforeEach(async function () {
      await createTask();
      await contract.connect(relayer).submitProof(0, "ipfs://proof");
    });

    it("validator can validate", async function () {
      await expect(contract.connect(validator).validateTask(0))
        .to.emit(contract, "TaskValidated")
        .withArgs(0, validator.address);
      expect((await contract.getTask(0)).validated).to.equal(true);
    });

    it("relayer can validate on behalf of the validator", async function () {
      await contract.connect(relayer).validateTask(0);
      expect((await contract.getTask(0)).validated).to.equal(true);
    });

    it("rejects validation by task owner or outsider", async function () {
      await expect(contract.connect(user).validateTask(0)).to.be.revertedWith(
        "Not authorized"
      );
      await expect(
        contract.connect(outsider).validateTask(0)
      ).to.be.revertedWith("Not authorized");
    });

    it("rejects validation before proof is submitted", async function () {
      await createTask(24, outsider, validator); // task 1, no proof
      await expect(
        contract.connect(validator).validateTask(1)
      ).to.be.revertedWith("Task not completed");
    });

    it("rejects double validation", async function () {
      await contract.connect(validator).validateTask(0);
      await expect(
        contract.connect(validator).validateTask(0)
      ).to.be.revertedWith("Already validated");
    });
  });

  describe("claimFunds", function () {
    beforeEach(async function () {
      await createTask();
      await contract.connect(relayer).submitProof(0, "ipfs://proof");
      await contract.connect(relayer).validateTask(0);
    });

    it("returns the full stake to the task owner", async function () {
      await expect(
        contract.connect(user).claimFunds(0)
      ).to.changeEtherBalance(user, STAKE);
      const task = await contract.getTask(0);
      expect(task.claimed).to.equal(true);
      expect(task.stake).to.equal(0);
    });

    it("increments completedTaskCount (leaderboard)", async function () {
      await contract.connect(user).claimFunds(0);
      expect(await contract.getCompletedTaskCount(user.address)).to.equal(1);
    });

    it("rejects claim by anyone but the task owner", async function () {
      await expect(
        contract.connect(validator).claimFunds(0)
      ).to.be.revertedWith("Not task owner");
      await expect(contract.connect(relayer).claimFunds(0)).to.be.revertedWith(
        "Not task owner"
      );
    });

    it("rejects double claim", async function () {
      await contract.connect(user).claimFunds(0);
      await expect(contract.connect(user).claimFunds(0)).to.be.revertedWith(
        "Already claimed"
      );
    });

    it("rejects claim before validation", async function () {
      await createTask(24, outsider, validator); // task 1
      await contract.connect(relayer).submitProof(1, "ipfs://proof");
      await expect(
        contract.connect(outsider).claimFunds(1)
      ).to.be.revertedWith("Task not validated yet");
    });
  });

  describe("forfeitStake", function () {
    beforeEach(createTask);

    it("rejects before the deadline", async function () {
      await expect(contract.forfeitStake(0)).to.be.revertedWith(
        "Deadline not passed"
      );
    });

    it("anyone can forfeit after a missed deadline", async function () {
      await increaseTime(25 * 3600);
      await expect(contract.connect(outsider).forfeitStake(0))
        .to.emit(contract, "StakeForfeited")
        .withArgs(0, user.address, STAKE);
      const task = await contract.getTask(0);
      expect(task.claimed).to.equal(true);
      expect(task.stake).to.equal(0);
    });

    it("rejects forfeit when proof was submitted in time", async function () {
      await contract.connect(user).submitProof(0, "ipfs://proof");
      await increaseTime(25 * 3600);
      await expect(contract.forfeitStake(0)).to.be.revertedWith(
        "Task was completed"
      );
    });

    it("rejects double forfeit", async function () {
      await increaseTime(25 * 3600);
      await contract.forfeitStake(0);
      await expect(contract.forfeitStake(0)).to.be.revertedWith(
        "Already claimed"
      );
    });

    it("owner cannot claim a forfeited stake back", async function () {
      await increaseTime(25 * 3600);
      await contract.forfeitStake(0);
      await expect(contract.connect(user).claimFunds(0)).to.be.revertedWith(
        "Already claimed"
      );
    });
  });

  describe("full lifecycle", function () {
    it("create -> relayer proof -> relayer validate -> claim (the demo path)", async function () {
      // User creates a task with stake (only signature the user makes)
      await createTask(1);

      // Backend relayer submits proof and validates - no user/validator tx
      await contract.connect(relayer).submitProof(0, "ipfs://QmProof");
      await contract.connect(relayer).validateTask(0);

      // User claims the stake back
      await expect(
        contract.connect(user).claimFunds(0)
      ).to.changeEtherBalance(user, STAKE);
      expect(await ethers.provider.getBalance(contract.address)).to.equal(0);
    });

    it("missed deadline -> forfeit (stake stays locked in contract)", async function () {
      await createTask(1);
      await increaseTime(2 * 3600);
      await contract.forfeitStake(0);
      // NOTE: forfeited ETH has no withdrawal path in V2 - it stays in the contract.
      expect(await ethers.provider.getBalance(contract.address)).to.equal(
        STAKE
      );
    });
  });
});
