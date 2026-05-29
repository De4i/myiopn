// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
}

/**
 * @title MasterChef
 * @dev Staking Contract for earning NBLAD and DE4I reward assets
 */
contract MasterChef {
    address public owner;

    // Reward token coordinates
    address public immutable NBLAD;
    address public immutable DE4I;

    struct Staker {
        uint256 usdcStaked;
        uint256 usdtStaked;
        uint256 usdcLastStakedTime;
        uint256 usdtLastStakedTime;
        uint256 pendingNbladReward;
        uint256 pendingDe4iReward;
    }

    mapping(address => Staker) public stakers;

    // Hourly base incentives
    // USDC -> 5 NBLAD / 2 DE4I per 1000 staked
    // USDT -> 4 NBLAD / 3 DE4I per 1000 staked
    uint256 public constant USDC_NBLAD_RATE = 5;
    uint256 public constant USDC_DE4I_RATE  = 2;
    uint256 public constant USDT_NBLAD_RATE = 4;
    uint256 public constant USDT_DE4I_RATE  = 3;

    event Staked(address indexed user, address indexed token, uint256 amount);
    event Unstaked(address indexed user, address indexed token, uint256 amount);
    event RewardHarvested(address indexed user, uint256 nbladQty, uint256 de4iQty);

    constructor(address _nblad, address _de4i) {
        owner = msg.sender;
        NBLAD = _nblad;
        DE4I = _de4i;
    }

    /**
     * @dev Read accumulated rewards for a given user address
     */
    function getPendingRewards(address user) public view returns (uint256 nbladReward, uint256 de4iReward) {
        Staker memory info = stakers[user];
        uint256 nReward = info.pendingNbladReward;
        uint256 dReward = info.pendingDe4iReward;

        // Calculate USDC Accruals
        if (info.usdcStaked > 0) {
            uint256 secondsPassed = block.timestamp - info.usdcLastStakedTime;
            nReward += (info.usdcStaked * USDC_NBLAD_RATE * secondsPassed * 1e12) / (3600 * 1000);
            dReward += (info.usdcStaked * USDC_DE4I_RATE * secondsPassed * 1e12) / (3600 * 1000);
        }

        // Calculate USDT Accruals
        if (info.usdtStaked > 0) {
            uint256 secondsPassed = block.timestamp - info.usdtLastStakedTime;
            nReward += (info.usdtStaked * USDT_NBLAD_RATE * secondsPassed * 1e12) / (3600 * 1000);
            dReward += (info.usdtStaked * USDT_DE4I_RATE * secondsPassed * 1e12) / (3600 * 1000);
        }

        return (nReward, dReward);
    }

    /**
     * @dev Locks token into rewards generation staking
     */
    function stake(address token, uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        
        // Harvest any pre-existing rewards first
        _updateRewards(msg.sender);

        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Staking deposit transfer failed");

        Staker storage info = stakers[msg.sender];
        if (token == address(0xAe69efe47ad3b3AEE2Be0c3A6eeA2bA9bc4a9284)) { // USDC Testnet
            info.usdcStaked += amount;
            info.usdcLastStakedTime = block.timestamp;
        } else {
            info.usdtStaked += amount;
            info.usdtLastStakedTime = block.timestamp;
        }

        emit Staked(msg.sender, token, amount);
    }

    /**
     * @dev Unstakes token, withdrawing locking capital
     */
    function unstake(address token, uint256 amount) external {
        Staker storage info = stakers[msg.sender];
        uint256 stakedBal = (token == address(0xAe69efe47ad3b3AEE2Be0c3A6eeA2bA9bc4a9284)) ? info.usdcStaked : info.usdtStaked;
        require(stakedBal >= amount, "Insufficient staked balance");

        _updateRewards(msg.sender);

        if (token == address(0xAe69efe47ad3b3AEE2Be0c3A6eeA2bA9bc4a9284)) { // USDC
            info.usdcStaked -= amount;
            info.usdcLastStakedTime = block.timestamp;
        } else {
            info.usdtStaked -= amount;
            info.usdtLastStakedTime = block.timestamp;
        }

        require(IERC20(token).transfer(msg.sender, amount), "Unstaking recall transfer failed");
        emit Unstaked(msg.sender, token, amount);
    }

    /**
     * @dev Claim all compiled reward tokens
     */
    function harvest() external {
        _updateRewards(msg.sender);
        Staker storage info = stakers[msg.sender];

        uint256 nClaim = info.pendingNbladReward;
        uint256 dClaim = info.pendingDe4iReward;

        require(nClaim > 0 || dClaim > 0, "No reward dividends currently earned");

        info.pendingNbladReward = 0;
        info.pendingDe4iReward = 0;

        if (nClaim > 0) {
            require(IERC20(NBLAD).transfer(msg.sender, nClaim), "NBLAD distribution failed");
        }
        if (dClaim > 0) {
            require(IERC20(DE4I).transfer(msg.sender, dClaim), "DE4I distribution failed");
        }

        emit RewardHarvested(msg.sender, nClaim, dClaim);
    }

    function _updateRewards(address user) internal {
        (uint256 nReward, uint256 dReward) = getPendingRewards(user);
        Staker storage info = stakers[user];
        info.pendingNbladReward = nReward;
        info.pendingDe4iReward = dReward;
        info.usdcLastStakedTime = block.timestamp;
        info.usdtLastStakedTime = block.timestamp;
    }
}
