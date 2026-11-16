// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface IERC20 {
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) external returns (bool);

    function transfer(address to, uint256 amount) external returns (bool);

    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title TaskStakerV2
 * @dev Users stake ETH (or ERC-20 tokens) to commit to tasks.
 *      Assigned validators approve completion via backend relayer (no wallet needed for proof/validate).
 *      Supports native ETH and ERC-20 tokens (for Base chain USDT/USDC).
 *
 *      Relayer pattern: the backend server wallet can call submitProof and validateTask
 *      on behalf of users, removing the need for validators/users to sign those transactions.
 *      Only createTask and claimFunds require a user wallet signature.
 */
contract TaskStakerV2 {
    uint256 public constant MIN_DURATION_HOURS = 1;

    address public owner;
    address public relayer;

    struct Task {
        address user;
        address validator;
        string name;
        uint256 stake;
        uint256 deadline;
        bool completed;
        bool validated;
        bool claimed;
        string proofUrl;
        address token; // address(0) = native ETH, otherwise ERC-20
    }

    Task[] public tasks;
    mapping(address => uint256) public completedTaskCount;

    event TaskCreated(
        uint256 indexed taskId,
        address indexed user,
        address indexed validator,
        string name,
        uint256 stake,
        uint256 deadline,
        address token
    );
    event ProofSubmitted(uint256 indexed taskId, string proofUrl);
    event TaskValidated(uint256 indexed taskId, address indexed validator);
    event FundsClaimed(
        uint256 indexed taskId,
        address indexed user,
        uint256 amount
    );
    event StakeForfeited(
        uint256 indexed taskId,
        address indexed user,
        uint256 amount
    );

    modifier onlyOwnerOrRelayer() {
        require(msg.sender == owner || msg.sender == relayer, "Not authorized");
        _;
    }

    constructor(address _relayer) {
        owner = msg.sender;
        relayer = _relayer;
    }

    function setRelayer(address _relayer) external {
        require(msg.sender == owner, "Only owner");
        relayer = _relayer;
    }

    /**
     * @notice Create a new task with native ETH stake
     * @param _name Task description
     * @param _durationHours Number of hours until deadline (min 1)
     * @param _validator Address of the assigned validator
     */
    function createTask(
        string memory _name,
        uint256 _durationHours,
        address _validator
    ) external payable {
        require(msg.value > 0, "Must stake ETH");
        require(
            _durationHours >= MIN_DURATION_HOURS,
            "Minimum deadline is 1 hour"
        );
        require(_validator != address(0), "Invalid validator address");
        require(_validator != msg.sender, "Cannot validate your own task");

        uint256 deadline = block.timestamp + (_durationHours * 1 hours);

        tasks.push(
            Task({
                user: msg.sender,
                validator: _validator,
                name: _name,
                stake: msg.value,
                deadline: deadline,
                completed: false,
                validated: false,
                claimed: false,
                proofUrl: "",
                token: address(0)
            })
        );

        uint256 taskId = tasks.length - 1;
        emit TaskCreated(
            taskId,
            msg.sender,
            _validator,
            _name,
            msg.value,
            deadline,
            address(0)
        );
    }

    /**
     * @notice Create a new task with ERC-20 token stake (for Base chain USDT/USDC)
     */
    function createTaskWithToken(
        string memory _name,
        uint256 _durationHours,
        address _validator,
        address _token,
        uint256 _amount
    ) external {
        require(_amount > 0, "Must stake tokens");
        require(
            _durationHours >= MIN_DURATION_HOURS,
            "Minimum deadline is 1 hour"
        );
        require(_validator != address(0), "Invalid validator address");
        require(_validator != msg.sender, "Cannot validate your own task");
        require(_token != address(0), "Invalid token address");

        IERC20(_token).transferFrom(msg.sender, address(this), _amount);

        uint256 deadline = block.timestamp + (_durationHours * 1 hours);

        tasks.push(
            Task({
                user: msg.sender,
                validator: _validator,
                name: _name,
                stake: _amount,
                deadline: deadline,
                completed: false,
                validated: false,
                claimed: false,
                proofUrl: "",
                token: _token
            })
        );

        uint256 taskId = tasks.length - 1;
        emit TaskCreated(
            taskId,
            msg.sender,
            _validator,
            _name,
            _amount,
            deadline,
            _token
        );
    }

    /**
     * @notice Submit proof of task completion.
     *         Called by the task owner directly OR by the trusted relayer on their behalf.
     */
    function submitProof(uint256 _taskId, string memory _proofUrl) external {
        require(_taskId < tasks.length, "Invalid task ID");
        Task storage task = tasks[_taskId];
        require(
            msg.sender == task.user || msg.sender == relayer,
            "Not authorized"
        );
        require(!task.completed, "Already completed");
        require(block.timestamp <= task.deadline, "Deadline passed");

        task.proofUrl = _proofUrl;
        task.completed = true;

        emit ProofSubmitted(_taskId, _proofUrl);
    }

    /**
     * @notice Validate a completed task.
     *         Called by the assigned validator directly OR by the trusted relayer on their behalf.
     *         This allows validation without a MetaMask transaction from the validator.
     */
    function validateTask(uint256 _taskId) external {
        require(_taskId < tasks.length, "Invalid task ID");
        Task storage task = tasks[_taskId];
        require(
            msg.sender == task.validator || msg.sender == relayer,
            "Not authorized"
        );
        require(task.completed, "Task not completed");
        require(!task.validated, "Already validated");

        task.validated = true;
        emit TaskValidated(_taskId, task.validator);
    }

    /**
     * @notice Claim funds after validation (requires user wallet — this is the ETH transfer)
     */
    function claimFunds(uint256 _taskId) external {
        require(_taskId < tasks.length, "Invalid task ID");
        Task storage task = tasks[_taskId];
        require(msg.sender == task.user, "Not task owner");
        require(!task.claimed, "Already claimed");
        require(task.validated, "Task not validated yet");

        uint256 amount = task.stake;
        task.stake = 0;
        task.claimed = true;
        completedTaskCount[msg.sender]++;

        if (task.token == address(0)) {
            payable(msg.sender).transfer(amount);
        } else {
            IERC20(task.token).transfer(msg.sender, amount);
        }

        emit FundsClaimed(_taskId, msg.sender, amount);
    }

    /**
     * @notice Forfeit stake after missed deadline (anyone can call to clean up)
     */
    function forfeitStake(uint256 _taskId) external {
        require(_taskId < tasks.length, "Invalid task ID");
        Task storage task = tasks[_taskId];
        require(!task.claimed, "Already claimed");
        require(block.timestamp > task.deadline, "Deadline not passed");
        require(!task.completed, "Task was completed");

        uint256 amount = task.stake;
        task.stake = 0;
        task.claimed = true;

        emit StakeForfeited(_taskId, task.user, amount);
    }

    /**
     * @notice Get task details
     */
    function getTask(
        uint256 _taskId
    )
        external
        view
        returns (
            address user,
            address validator,
            string memory name,
            uint256 stake,
            uint256 deadline,
            bool completed,
            bool validated,
            bool claimed,
            string memory proofUrl,
            address token
        )
    {
        require(_taskId < tasks.length, "Invalid task ID");
        Task memory task = tasks[_taskId];
        return (
            task.user,
            task.validator,
            task.name,
            task.stake,
            task.deadline,
            task.completed,
            task.validated,
            task.claimed,
            task.proofUrl,
            task.token
        );
    }

    function getTaskCount() external view returns (uint256) {
        return tasks.length;
    }

    function getCompletedTaskCount(
        address _user
    ) external view returns (uint256) {
        return completedTaskCount[_user];
    }
}
