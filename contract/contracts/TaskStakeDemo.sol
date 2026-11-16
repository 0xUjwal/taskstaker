// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title TaskStakeDemo
 * @dev Proof-of-concept: users stake ETH to commit to tasks, submit proofs, and claim rewards
 */
contract TaskStakeDemo {
    struct Task {
        address user;
        string name;
        uint256 stake;
        uint256 deadline;
        bool completed;
        bool validated;
        string proofHash; // IPFS CID or hash
    }

    Task[] public tasks;

    event TaskCreated(uint256 indexed taskId, address indexed user, string name, uint256 stake, uint256 deadline);
    event ProofSubmitted(uint256 indexed taskId, string proofHash);
    event TaskValidated(uint256 indexed taskId);
    event FundsClaimed(uint256 indexed taskId, address indexed user, uint256 amount);

    /**
     * @notice Create a new task with a stake
     * @param _name Task description
     * @param _durationDays Number of days until deadline
     */
    function createTask(string memory _name, uint256 _durationDays) external payable {
        require(msg.value > 0, "Must stake ETH");
        require(_durationDays > 0, "Duration must be positive");

        uint256 deadline = block.timestamp + (_durationDays * 1 days);
        
        tasks.push(Task({
            user: msg.sender,
            name: _name,
            stake: msg.value,
            deadline: deadline,
            completed: false,
            validated: false,
            proofHash: ""
        }));

        uint256 taskId = tasks.length - 1;
        emit TaskCreated(taskId, msg.sender, _name, msg.value, deadline);
    }

    /**
     * @notice Submit proof of task completion
     * @param _taskId Task ID
     * @param _proofHash IPFS CID or proof identifier
     */
    function submitProof(uint256 _taskId, string memory _proofHash) external {
        require(_taskId < tasks.length, "Invalid task ID");
        Task storage task = tasks[_taskId];
        require(msg.sender == task.user, "Not task owner");
        require(!task.completed, "Already completed");
        require(block.timestamp <= task.deadline, "Deadline passed");

        task.proofHash = _proofHash;
        task.completed = true;

        emit ProofSubmitted(_taskId, _proofHash);
    }

    /**
     * @notice Validate a completed task (validator/AI action)
     * @param _taskId Task ID
     */
    function validateTask(uint256 _taskId) external {
        require(_taskId < tasks.length, "Invalid task ID");
        Task storage task = tasks[_taskId];
        require(task.completed, "Task not completed");
        require(!task.validated, "Already validated");

        task.validated = true;
        emit TaskValidated(_taskId);
    }

    /**
     * @notice Claim funds after validation or apply penalty
     * @param _taskId Task ID
     */
    function claimFunds(uint256 _taskId) external {
        require(_taskId < tasks.length, "Invalid task ID");
        Task storage task = tasks[_taskId];
        require(msg.sender == task.user, "Not task owner");

        uint256 amount = 0;

        if (task.validated) {
            // Task validated: return stake
            amount = task.stake;
            task.stake = 0;
            payable(msg.sender).transfer(amount);
        } else if (block.timestamp > task.deadline && !task.completed) {
            // Deadline passed, no proof: penalty (stake lost)
            task.stake = 0;
            // In production, stake could go to charity/treasury
        } else {
            revert("Cannot claim yet");
        }

        emit FundsClaimed(_taskId, msg.sender, amount);
    }

    /**
     * @notice Get task details
     * @param _taskId Task ID
     */
    function getTask(uint256 _taskId) external view returns (
        address user,
        string memory name,
        uint256 stake,
        uint256 deadline,
        bool completed,
        bool validated,
        string memory proofHash
    ) {
        require(_taskId < tasks.length, "Invalid task ID");
        Task memory task = tasks[_taskId];
        return (task.user, task.name, task.stake, task.deadline, task.completed, task.validated, task.proofHash);
    }

    /**
     * @notice Get total number of tasks
     */
    function getTaskCount() external view returns (uint256) {
        return tasks.length;
    }
}
