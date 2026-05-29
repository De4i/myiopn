// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IERC20
 * @dev Interface of the ERC20 standard as defined in the EIP.
 */
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

/**
 * @title myIOPN_DEX
 * @dev Core AMM Swap, Liquidity Pool, Staking and Faucet contract for myIOPN
 */
contract myIOPN_DEX {
    // Contract Addresses
    address public immutable USDC;
    address public immutable USDT;
    address public immutable NBLAD;
    address public immutable DE4I;

    // Token structures
    struct Staker {
        uint256 usdcStaked;
        uint256 usdtStaked;
        uint256 usdcLastStakedTime;
        uint256 usdtLastStakedTime;
        uint256 nbladRewardDebt;
        uint256 de4iRewardDebt;
    }

    struct LiquidityPool {
        uint256 tokenAReserve;
        uint256 tokenBReserve;
        uint256 totalLPShares;
        mapping(address => uint256) lpShares;
    }

    // Faucet structures
    mapping(address => mapping(address => uint256)) public lastFaucetClaim; // user => token => timestamp
    uint256 public constant FAUCET_LIMIT = 10000 * 10**18;
    uint256 public constant FAUCET_COOLDOWN = 24 hours;

    address public owner;

    // Staking Reward Rates (Tokens per hour/second of staking)
    // Earn NBLAD & DE4I as rewards
    uint256 public stakingRewardRateUsdcNblad = 5; // 5 NBLAD per 1000 USDC per hour
    uint256 public stakingRewardRateUsdcDe4i  = 2; // 2 DE4I per 1000 USDC per hour
    uint256 public stakingRewardRateUsdtNblad = 4; // 4 NBLAD per 1000 USDT per hour
    uint256 public stakingRewardRateUsdtDe4i  = 3; // 3 DE4I per 1000 USDT per hour

    modifier onlyOwner() {
        require(msg.sender == owner, "Ownable: caller is not the owner");
        _;
    }

    // User Staking database
    mapping(address => Staker) public stakers;
    
    // Auto withdrawal thresholds (configurable by user)
    mapping(address => uint256) public autoWithdrawLimitNBLAD;
    mapping(address => uint256) public autoWithdrawLimitDE4I;

    // LP Pools (Token Pair Key -> Pool Structure)
    // e.g. keccak256(abi.encodePacked(tokenA, tokenB))
    mapping(bytes32 => LiquidityPool) private pools;

    // Events
    event TokenSwapped(address indexed user, address indexed tokenIn, address indexed tokenOut, uint256 amountIn, uint256 amountOut);
    event LiquidityAdded(address indexed user, address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB, uint256 shares);
    event LiquidityRemoved(address indexed user, address indexed tokenA, address indexed tokenB, uint256 amountA, uint256 amountB, uint256 shares);
    event Staked(address indexed user, address indexed token, uint256 amount);
    event Unstaked(address indexed user, address indexed token, uint256 amount);
    event RewardClaimed(address indexed user, string rewardType, uint256 amount);
    event FaucetClaimed(address indexed user, address indexed token, uint256 amount);
    event AutoWithdrawTriggered(address indexed user, address indexed token, uint256 amount);

    constructor(
        address _usdc,
        address _usdt,
        address _nblad,
        address _de4i
    ) {
        USDC = _usdc;
        USDT = _usdt;
        NBLAD = _nblad;
        DE4I = _de4i;
        owner = msg.sender;
    }

    /**
     * @dev Sets new reward rates for USDC and USDT staking pools (MasterChef pool management behavior)
     */
    function setRewardRates(
        uint256 _usdcNblad,
        uint256 _usdcDe4i,
        uint256 _usdtNblad,
        uint256 _usdtDe4i
    ) external onlyOwner {
        stakingRewardRateUsdcNblad = _usdcNblad;
        stakingRewardRateUsdcDe4i = _usdcDe4i;
        stakingRewardRateUsdtNblad = _usdtNblad;
        stakingRewardRateUsdtDe4i = _usdtDe4i;
    }

    /**
     * @dev Transfer ownership to another address
     */
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        owner = newOwner;
    }

    /**
     * @dev Faucet claiming routine for testing assets
     */
    function claimFaucet(address token) external {
        require(token == USDC || token == USDT, "Only USDC and USDT compatible with faucet");
        require(block.timestamp >= lastFaucetClaim[msg.sender][token] + FAUCET_COOLDOWN, "Faucet claim cooldown active (24h)");

        lastFaucetClaim[msg.sender][token] = block.timestamp;
        
        // Transfer 10,000 tokens to the caller
        require(IERC20(token).transfer(msg.sender, FAUCET_LIMIT), "Faucet transfer failed");

        emit FaucetClaimed(msg.sender, token, FAUCET_LIMIT);
    }

    /**
     * @dev Stake USDC or USDT to earn rewards
     */
    function stake(address token, uint256 amount) external {
        require(token == USDC || token == USDT, "Can only stake USDC or USDT");
        require(amount > 0, "Staking amount must be positive");

        // Keep rewards accurate by harvesting prior accumulated debts first
        harvestRewards(msg.sender);

        require(IERC20(token).transferFrom(msg.sender, address(this), amount), "Token staking transfer failed");

        Staker storage user = stakers[msg.sender];
        if (token == USDC) {
            user.usdcStaked += amount;
            user.usdcLastStakedTime = block.timestamp;
        } else {
            user.usdtStaked += amount;
            user.usdtLastStakedTime = block.timestamp;
        }

        emit Staked(msg.sender, token, amount);
    }

    /**
     * @dev Unstake assets and claim accumulated rewards
     */
    function unstake(address token, uint256 amount) external {
        require(token == USDC || token == USDT, "Can only unstake USDC or USDT");
        Staker storage user = stakers[msg.sender];
        uint256 stakedAmount = (token == USDC) ? user.usdcStaked : user.usdtStaked;
        require(stakedAmount >= amount, "Insufficient staked balance");

        // Claim current rewards
        harvestRewards(msg.sender);

        if (token == USDC) {
            user.usdcStaked -= amount;
        } else {
            user.usdtStaked -= amount;
        }

        require(IERC20(token).transfer(msg.sender, amount), "Unstaking withdrawal failed");
        emit Unstaked(msg.sender, token, amount);
    }

    /**
     * @dev Read claimable reward tokens accumulated on-chain
     */
    function getClaimableRewards(address userAddress) public view returns (uint256 nbladReward, uint256 de4iReward) {
        Staker memory user = stakers[userAddress];
        
        uint256 pendingNblad = user.nbladRewardDebt;
        uint256 pendingDe4i = user.de4iRewardDebt;

        // USDC Accruals
        if (user.usdcStaked > 0) {
            uint256 secondsPassed = block.timestamp - user.usdcLastStakedTime;
            pendingNblad += (user.usdcStaked * stakingRewardRateUsdcNblad * secondsPassed) / (3600 * 1000);
            pendingDe4i += (user.usdcStaked * stakingRewardRateUsdcDe4i * secondsPassed) / (3600 * 1000);
        }

        // USDT Accruals
        if (user.usdtStaked > 0) {
            uint256 secondsPassed = block.timestamp - user.usdtLastStakedTime;
            pendingNblad += (user.usdtStaked * stakingRewardRateUsdtNblad * secondsPassed) / (3600 * 1000);
            pendingDe4i += (user.usdtStaked * stakingRewardRateUsdtDe4i * secondsPassed) / (3600 * 1000);
        }

        return (pendingNblad, pendingDe4i);
    }

    /**
     * @dev Setup custom auto withdraw limits
     */
    function setAutoWithdrawLimits(uint256 _nbladThreshold, uint256 _de4iThreshold) external {
        autoWithdrawLimitNBLAD[msg.sender] = _nbladThreshold;
        autoWithdrawLimitDE4I[msg.sender] = _de4iThreshold;
    }

    /**
     * @dev Claim and transfer external reward tokens to staker address
     */
    function harvestRewards(address userAddress) public {
        (uint256 claimableNBLAD, uint256 claimableDE4I) = getClaimableRewards(userAddress);
        
        Staker storage user = stakers[userAddress];
        user.usdcLastStakedTime = block.timestamp;
        user.usdtLastStakedTime = block.timestamp;

        // Reset or push rewards to wallet
        user.nbladRewardDebt = 0;
        user.de4iRewardDebt = 0;

        // Real-world scenario checks auto triggers, otherwise mints or transfers:
        if (claimableNBLAD > 0) {
            uint256 contractBal = IERC20(NBLAD).balanceOf(address(this));
            uint256 amountToTransfer = claimableNBLAD > contractBal ? contractBal : claimableNBLAD;
            
            // Refund any unpaid rewards back to debt
            user.nbladRewardDebt = claimableNBLAD - amountToTransfer;

            if (amountToTransfer > 0) {
                // Check auto withdrawal threshold
                uint256 userNBLADThreshold = autoWithdrawLimitNBLAD[userAddress];
                if (userNBLADThreshold > 0 && claimableNBLAD >= userNBLADThreshold) {
                    require(IERC20(NBLAD).transfer(userAddress, amountToTransfer), "Token reward distribution failed");
                    emit AutoWithdrawTriggered(userAddress, NBLAD, amountToTransfer);
                } else {
                    require(IERC20(NBLAD).transfer(userAddress, amountToTransfer), "Token reward distribution failed");
                    emit RewardClaimed(userAddress, "NBLAD", amountToTransfer);
                }
            }
        }

        if (claimableDE4I > 0) {
            uint256 contractBal = IERC20(DE4I).balanceOf(address(this));
            uint256 amountToTransfer = claimableDE4I > contractBal ? contractBal : claimableDE4I;

            // Refund any unpaid rewards back to debt
            user.de4iRewardDebt = claimableDE4I - amountToTransfer;

            if (amountToTransfer > 0) {
                uint256 userDE4IThreshold = autoWithdrawLimitDE4I[userAddress];
                if (userDE4IThreshold > 0 && claimableDE4I >= userDE4IThreshold) {
                    require(IERC20(DE4I).transfer(userAddress, amountToTransfer), "Token reward distribution failed");
                    emit AutoWithdrawTriggered(userAddress, DE4I, amountToTransfer);
                } else {
                    require(IERC20(DE4I).transfer(userAddress, amountToTransfer), "Token reward distribution failed");
                    emit RewardClaimed(userAddress, "DE4I", amountToTransfer);
                }
            }
        }
    }

    /**
     * @dev Constant Product AMM Swap Logic (x * y = k)
     */
    function swap(address tokenIn, address tokenOut, uint256 amountIn) external returns (uint256 amountOut) {
        require(amountIn > 0, "Input amount must be positive");
        require(tokenIn != tokenOut, "Identical addresses");

        // Special 1:1 Stablecoin Swap for USDC & USDT with zero price impact
        if ((tokenIn == USDC && tokenOut == USDT) || (tokenIn == USDT && tokenOut == USDC)) {
            amountOut = amountIn; // 1:1 exchange rate with zero slippage
            
            require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "Token deposit failed");
            require(IERC20(tokenOut).transfer(msg.sender, amountOut), "Token withdrawal failed");
            
            // Sync the internal reserves if pool has been initialized
            (address token0, address token1) = tokenIn < tokenOut ? (tokenIn, tokenOut) : (tokenOut, tokenIn);
            bytes32 poolKey = getPoolKey(token0, token1);
            LiquidityPool storage pool = pools[poolKey];
            if (tokenIn == token0) {
                pool.tokenAReserve += amountIn;
                if (pool.tokenBReserve >= amountOut) {
                    pool.tokenBReserve -= amountOut;
                }
            } else {
                pool.tokenBReserve += amountIn;
                if (pool.tokenAReserve >= amountOut) {
                    pool.tokenAReserve -= amountOut;
                }
            }
            
            emit TokenSwapped(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
            return amountOut;
        }

        (address token0, address token1) = tokenIn < tokenOut ? (tokenIn, tokenOut) : (tokenOut, tokenIn);
        bytes32 poolKey = getPoolKey(token0, token1);
        LiquidityPool storage pool = pools[poolKey];

        uint256 reserveIn = (tokenIn == token0) ? pool.tokenAReserve : pool.tokenBReserve;
        uint256 reserveOut = (tokenIn == token0) ? pool.tokenBReserve : pool.tokenAReserve;

        require(reserveIn > 0 && reserveOut > 0, "Pool has insufficient liquidity");

        // Swap Math: dy = (y * dx * 997) / (x * 1000 + dx * 997) - 0.3% trading fee
        uint256 amountInWithFee = amountIn * 997;
        uint256 numerator = amountInWithFee * reserveOut;
        uint256 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;

        require(amountOut < reserveOut, "Price impact is too high; insufficient depth");

        // Perform actual ERC25 transactions
        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "Token deposit failed");
        require(IERC20(tokenOut).transfer(msg.sender, amountOut), "Token withdrawal failed");

        // Update pools internal assets
        if (tokenIn == token0) {
            pool.tokenAReserve += amountIn;
            pool.tokenBReserve -= amountOut;
        } else {
            pool.tokenBReserve += amountIn;
            pool.tokenAReserve -= amountOut;
        }

        emit TokenSwapped(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    /**
     * @dev Add Liquidity mechanics
     */
    function addLiquidity(address tokenA, address tokenB, uint256 amountA, uint256 amountB) external returns (uint256 shares) {
        require(tokenA != tokenB, "Identical addresses");
        (address token0, address token1, uint256 amount0, uint256 amount1) = tokenA < tokenB ? 
            (tokenA, tokenB, amountA, amountB) : 
            (tokenB, tokenA, amountB, amountA);

        bytes32 poolKey = getPoolKey(token0, token1);
        LiquidityPool storage pool = pools[poolKey];

        require(IERC20(tokenA).transferFrom(msg.sender, address(this), amountA), "Token A deposit failed");
        require(IERC20(tokenB).transferFrom(msg.sender, address(this), amountB), "Token B deposit failed");

        if (pool.totalLPShares == 0) {
            // Geometric mean for initial share distribution
            shares = sqrt(amount0 * amount1);
        } else {
            uint256 share0 = (amount0 * pool.totalLPShares) / pool.tokenAReserve;
            uint256 share1 = (amount1 * pool.totalLPShares) / pool.tokenBReserve;
            shares = share0 < share1 ? share0 : share1;
        }

        require(shares > 0, "No LP tokens minted");

        pool.tokenAReserve += amount0;
        pool.tokenBReserve += amount1;
        pool.totalLPShares += shares;
        pool.lpShares[msg.sender] += shares;

        emit LiquidityAdded(msg.sender, token0, token1, amount0, amount1, shares);
    }

    /**
     * @dev Remove Liquidity mechanics
     */
    function removeLiquidity(address tokenA, address tokenB, uint256 shares) external returns (uint256 amountA, uint256 amountB) {
        require(tokenA != tokenB, "Identical addresses");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        bytes32 poolKey = getPoolKey(token0, token1);
        LiquidityPool storage pool = pools[poolKey];

        uint256 userShares = pool.lpShares[msg.sender];
        require(userShares >= shares, "Insufficient LP shares to burn");

        uint256 amount0 = (shares * pool.tokenAReserve) / pool.totalLPShares;
        uint256 amount1 = (shares * pool.tokenBReserve) / pool.totalLPShares;

        pool.lpShares[msg.sender] -= shares;
        pool.totalLPShares -= shares;
        pool.tokenAReserve -= amount0;
        pool.tokenBReserve -= amount1;

        if (tokenA == token0) {
            amountA = amount0;
            amountB = amount1;
        } else {
            amountA = amount1;
            amountB = amount0;
        }

        require(IERC20(tokenA).transfer(msg.sender, amountA), "Token A return failed");
        require(IERC20(tokenB).transfer(msg.sender, amountB), "Token B return failed");

        emit LiquidityRemoved(msg.sender, token0, token1, amount0, amount1, shares);
    }

    // Helper functions
    function getPoolKey(address tokenA, address tokenB) public pure returns (bytes32) {
        return tokenA < tokenB ? keccak256(abi.encodePacked(tokenA, tokenB)) : keccak256(abi.encodePacked(tokenB, tokenA));
    }

    function getPoolReserves(address tokenA, address tokenB) external view returns (uint256 reserveA, uint256 reserveB, uint256 totalShares) {
        bytes32 poolKey = getPoolKey(tokenA, tokenB);
        LiquidityPool storage pool = pools[poolKey];
        if (tokenA < tokenB) {
            return (pool.tokenAReserve, pool.tokenBReserve, pool.totalLPShares);
        } else {
            return (pool.tokenBReserve, pool.tokenAReserve, pool.totalLPShares);
        }
    }

    function getUserLPShares(address tokenA, address tokenB, address user) external view returns (uint256) {
        bytes32 poolKey = getPoolKey(tokenA, tokenB);
        return pools[poolKey].lpShares[user];
    }

    function sqrt(uint256 y) internal pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}
