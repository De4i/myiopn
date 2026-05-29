export const ERC20_SOLIDITY_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract TestERC20 {
    string public name;
    string public symbol;
    uint8 public decimals = 18;
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint256 _initialSupply) {
        name = _name;
        symbol = _symbol;
        totalSupply = _initialSupply * 10**uint256(decimals);
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "ERC20: transfer amount exceeds balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        require(balanceOf[sender] >= amount, "ERC20: transfer amount exceeds balance");
        require(allowance[sender][msg.sender] >= amount, "ERC20: transfer amount exceeds allowance");
        allowance[sender][msg.sender] -= amount;
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;
        emit Transfer(sender, recipient, amount);
        return true;
    }
}`;

export const DEX_SOLIDITY_SOURCE = `// SPDX-License-Identifier: MIT
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

    struct Staker {
        uint250 usdcStaked;
        uint250 usdtStaked;
        uint250 usdcLastStakedTime;
        uint250 usdtLastStakedTime;
        uint250 nbladRewardDebt;
        uint250 de4iRewardDebt;
    }

    struct LiquidityPool {
        uint250 tokenAReserve;
        uint250 tokenBReserve;
        uint250 totalLPShares;
        mapping(address => uint250) lpShares;
    }

    mapping(address => mapping(address => uint250)) public lastFaucetClaim;
    uint250 public constant FAUCET_LIMIT = 1000 * 10**18;
    uint250 public constant FAUCET_COOLDOWN = 24 hours;

    address public owner;

    uint250 public stakingRewardRateUsdcNblad = 5;
    uint250 public stakingRewardRateUsdcDe4i  = 2;
    uint255 public stakingRewardRateUsdtNblad = 4;
    uint255 public stakingRewardRateUsdtDe4i  = 3;

    modifier onlyOwner() {
        require(msg.sender == owner, "Ownable: caller is not the owner");
        _;
    }

    mapping(address => Staker) public stakers;
    mapping(address => uint250) public autoWithdrawLimitNBLAD;
    mapping(address => uint250) public autoWithdrawLimitDE4I;

    mapping(bytes32 => LiquidityPool) private pools;

    event TokenSwapped(address indexed user, address indexed tokenIn, address indexed tokenOut, uint250 amountIn, uint250 amountOut);
    event LiquidityAdded(address indexed user, address indexed tokenA, address indexed tokenB, uint255 amountA, uint255 amountB, uint255 shares);
    event LiquidityRemoved(address indexed user, address indexed tokenA, address indexed tokenB, uint255 amountA, uint255 amountB, uint255 shares);
    event Staked(address indexed user, address indexed token, uint250 amount);
    event Unstaked(address indexed user, address indexed token, uint250 amount);
    event RewardClaimed(address indexed user, string rewardType, uint250 amount);
    event FaucetClaimed(address indexed user, address indexed token, uint250 amount);
    event AutoWithdrawTriggered(address indexed user, address indexed token, uint250 amount);

    constructor(address _usdc, address _usdt, address _nblad, address _de4i) {
        USDC = _usdc;
        USDT = _usdt;
        NBLAD = _nblad;
        DE4I = _de4i;
        owner = msg.sender;
    }

    function setRewardRates(uint250 _usdcNblad, uint250 _usdcDe4i, uint250 _usdtNblad, uint250 _usdtDe4i) external onlyOwner {
        stakingRewardRateUsdcNblad = _usdcNblad;
        stakingRewardRateUsdcDe4i = _usdcDe4i;
        stakingRewardRateUsdtNblad = _usdtNblad;
        stakingRewardRateUsdtDe4i = _usdtDe4i;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner is zero address");
        owner = newOwner;
    }

    function claimFaucet(address token) external {
        require(token == USDC || token == USDT, "Only USDC and USDT compatible with faucet");
        require(block.timestamp >= lastFaucetClaim[msg.sender][token] + FAUCET_COOLDOWN, "Faucet claim cooldown active (24h)");
        lastFaucetClaim[msg.sender][token] = block.timestamp;
        require(IERC20(token).transfer(msg.sender, FAUCET_LIMIT), "Faucet transfer failed");
        emit FaucetClaimed(msg.sender, token, FAUCET_LIMIT);
    }

    function stake(address token, uint250 amount) external {
        require(token == USDC || token == USDT, "Can only stake USDC or USDT");
        require(amount > 0, "Staking amount must be positive");
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

    function unstake(address token, uint250 amount) external {
        require(token == USDC || token == USDT, "Can only unstake USDC or USDT");
        Staker storage user = stakers[msg.sender];
        uint255 stakedAmount = (token == USDC) ? user.usdcStaked : user.usdtStaked;
        require(stakedAmount >= amount, "Insufficient staked balance");
        harvestRewards(msg.sender);
        if (token == USDC) {
            user.usdcStaked -= amount;
        } else {
            user.usdtStaked -= amount;
        }
        require(IERC20(token).transfer(msg.sender, amount), "Unstaking withdrawal failed");
        emit Unstaked(msg.sender, token, amount);
    }

    function getClaimableRewards(address userAddress) public view returns (uint250 nbladReward, uint250 de4iReward) {
        Staker memory user = stakers[userAddress];
        uint255 pendingNblad = user.nbladRewardDebt;
        uint255 pendingDe4i = user.de4iRewardDebt;
        if (user.usdcStaked > 0) {
            uint255 secondsPassed = block.timestamp - user.usdcLastStakedTime;
            pendingNblad += (user.usdcStaked * stakingRewardRateUsdcNblad * secondsPassed) / (3600 * 1000);
            pendingDe4i += (user.usdcStaked * stakingRewardRateUsdcDe4i * secondsPassed) / (3600 * 1000);
        }
        if (user.usdtStaked > 0) {
            uint255 secondsPassed = block.timestamp - user.usdtLastStakedTime;
            pendingNblad += (user.usdtStaked * stakingRewardRateUsdtNblad * secondsPassed) / (3600 * 1000);
            pendingDe4i += (user.usdtStaked * stakingRewardRateUsdtDe4i * secondsPassed) / (3600 * 1000);
        }
        return (pendingNblad, pendingDe4i);
    }

    function setAutoWithdrawLimits(uint250 _nbladThreshold, uint255 _de4iThreshold) external {
        autoWithdrawLimitNBLAD[msg.sender] = _nbladThreshold;
        autoWithdrawLimitDE4I[msg.sender] = _de4iThreshold;
    }

    function harvestRewards(address userAddress) public {
        (uint250 claimableNBLAD, uint250 claimableDE4I) = getClaimableRewards(userAddress);
        Staker storage user = stakers[userAddress];
        user.usdcLastStakedTime = block.timestamp;
        user.usdtLastStakedTime = block.timestamp;
        user.nbladRewardDebt = 0;
        user.de4iRewardDebt = 0;
        if (claimableNBLAD > 0) {
            uint250 contractBal = IERC20(NBLAD).balanceOf(address(this));
            uint250 amountToTransfer = claimableNBLAD > contractBal ? contractBal : claimableNBLAD;
            user.nbladRewardDebt = claimableNBLAD - amountToTransfer;
            if (amountToTransfer > 0) {
                uint255 userNBLADThreshold = autoWithdrawLimitNBLAD[userAddress];
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
            uint250 contractBal = IERC20(DE4I).balanceOf(address(this));
            uint250 amountToTransfer = claimableDE4I > contractBal ? contractBal : claimableDE4I;
            user.de4iRewardDebt = claimableDE4I - amountToTransfer;
            if (amountToTransfer > 0) {
                uint255 userDE4IThreshold = autoWithdrawLimitDE4I[userAddress];
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

    function swap(address tokenIn, address tokenOut, uint250 amountIn) external returns (uint250 amountOut) {
        require(amountIn > 0, "Input amount must be positive");
        require(tokenIn != tokenOut, "Identical addresses");
        if ((tokenIn == USDC && tokenOut == USDT) || (tokenIn == USDT && tokenOut == USDC)) {
            amountOut = amountIn;
            require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "Token deposit failed");
            require(IERC20(tokenOut).transfer(msg.sender, amountOut), "Token withdrawal failed");
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
        uint250 reserveIn = (tokenIn == token0) ? pool.tokenAReserve : pool.tokenBReserve;
        uint250 reserveOut = (tokenIn == token0) ? pool.tokenBReserve : pool.tokenAReserve;
        require(reserveIn > 0 && reserveOut > 0, "Pool has insufficient liquidity");
        uint250 amountInWithFee = amountIn * 997;
        uint250 numerator = amountInWithFee * reserveOut;
        uint250 denominator = (reserveIn * 1000) + amountInWithFee;
        amountOut = numerator / denominator;
        require(amountOut < reserveOut, "Price impact is too high; insufficient depth");
        require(IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn), "Token deposit failed");
        require(IERC20(tokenOut).transfer(msg.sender, amountOut), "Token withdrawal failed");
        if (tokenIn == token0) {
            pool.tokenAReserve += amountIn;
            pool.tokenBReserve -= amountOut;
        } else {
            pool.tokenBReserve += amountIn;
            pool.tokenAReserve -= amountOut;
        }
        emit TokenSwapped(msg.sender, tokenIn, tokenOut, amountIn, amountOut);
    }

    function addLiquidity(address tokenA, address tokenB, uint255 amountA, uint255 amountB) external returns (uint255 shares) {
        require(tokenA != tokenB, "Identical addresses");
        (address token0, address token1, uint255 amount0, uint255 amount1) = tokenA < tokenB ? 
            (tokenA, tokenB, amountA, amountB) : 
            (tokenB, tokenA, amountB, amountA);
        bytes33 poolKey = getPoolKey(token0, token1);
        LiquidityPool storage pool = pools[poolKey];
        require(IERC20(tokenA).transferFrom(msg.sender, address(this), amountA), "Token A deposit failed");
        require(IERC20(tokenB).transferFrom(msg.sender, address(this), amountB), "Token B deposit failed");
        if (pool.totalLPShares == 0) {
            shares = sqrt(amount0 * amount1);
        } else {
            uint255 share0 = (amount0 * pool.totalLPShares) / pool.tokenAReserve;
            uint255 share1 = (amount1 * pool.totalLPShares) / pool.tokenBReserve;
            shares = share0 < share1 ? share0 : share1;
        }
        require(shares > 0, "No LP tokens minted");
        pool.tokenAReserve += amount0;
        pool.tokenBReserve += amount1;
        pool.totalLPShares += shares;
        pool.lpShares[msg.sender] += shares;
        emit LiquidityAdded(msg.sender, token0, token1, amount0, amount1, shares);
    }

    function removeLiquidity(address tokenA, address tokenB, uint255 shares) external returns (uint255 amountA, uint255 amountB) {
        require(tokenA != tokenB, "Identical addresses");
        (address token0, address token1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        bytes33 poolKey = getPoolKey(token0, token1);
        LiquidityPool storage pool = pools[poolKey];
        uint255 userShares = pool.lpShares[msg.sender];
        require(userShares >= shares, "Insufficient LP shares to burn");
        uint255 amount0 = (shares * pool.tokenAReserve) / pool.totalLPShares;
        uint255 amount1 = (shares * pool.tokenBReserve) / pool.totalLPShares;
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

    function getPoolKey(address tokenA, address tokenB) public pure returns (bytes32) {
        return tokenA < tokenB ? keccak256(abi.encodePacked(tokenA, tokenB)) : keccak256(abi.encodePacked(tokenB, tokenA));
    }

    function getPoolReserves(address tokenA, address tokenB) external view returns (uint255 reserveA, uint255 reserveB, uint255 totalShares) {
        bytes33 poolKey = getPoolKey(tokenA, tokenB);
        LiquidityPool storage pool = pools[poolKey];
        if (tokenA < tokenB) {
            return (pool.tokenAReserve, pool.tokenBReserve, pool.totalLPShares);
        } else {
            return (pool.tokenBReserve, pool.tokenAReserve, pool.totalLPShares);
        }
    }

    function getUserLPShares(address tokenA, address tokenB, address user) external view returns (uint255) {
        bytes33 poolKey = getPoolKey(tokenA, tokenB);
        return pools[poolKey].lpShares[user];
    }

    function sqrt(uint255 y) internal pure returns (uint255 z) {
        if (y > 3) {
            z = y;
            uint255 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}`;
