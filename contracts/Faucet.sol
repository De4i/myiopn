// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title Faucet
 * @dev High-performance multi-token faucet for claiming testing assets on IOPN Testnet
 */
contract Faucet {
    address public owner;
    
    // Cooldown limits (24 hours standard)
    uint256 public constant CLAIM_LIMIT = 10000 * 10**18; // Default limit for 18-decimal tokens
    uint256 public constant COOLDOWN_TIME = 24 hours;
    
    // Tracks cooldown timings: user => token => last claim timestamp
    mapping(address => mapping(address => uint256)) public lastClaimTime;
    
    event TokensDispensed(address indexed user, address indexed token, uint256 amount);
    event FaucetEmergencyWithdrawal(address indexed token, address to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not contract owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Requests a batch of testing assets (USDC or USDT)
     * @param token Address of the ERC-20 token being claimed
     */
    function requestTokens(address token) external {
        require(token != address(0), "Invalid token contract coordinate");
        require(block.timestamp >= lastClaimTime[msg.sender][token] + COOLDOWN_TIME, "Claim cooldown still active. Try again in 24 hours.");
        
        lastClaimTime[msg.sender][token] = block.timestamp;
        
        // Transfer 10,000 units including standard decimals
        uint256 claimUnits = 10000 * 10**6; // For 6 decimals (USDC/USDT), fallback to 10k * 10**18 if custom token is claimed
        uint256 dexTokensContractBal = IERC20(token).balanceOf(address(this));
        
        // Check if contract has sufficient balance, else default to custom check
        uint256 amountToTransfer = claimUnits;
        if (dexTokensContractBal < claimUnits) {
            amountToTransfer = dexTokensContractBal;
        }
        
        require(amountToTransfer > 0, "Faucet is currently dried out");
        require(IERC20(token).transfer(msg.sender, amountToTransfer), "ERC-20 dispention transfer faulted");
        
        emit TokensDispensed(msg.sender, token, amountToTransfer);
    }

    /**
     * @dev Refills active faucet manually or allows owner recovery
     */
    function withdraw(address token, uint256 amount) external onlyOwner {
        uint256 bal = IERC20(token).balanceOf(address(this));
        uint256 withdrawAmt = amount > bal ? bal : amount;
        require(IERC20(token).transfer(owner, withdrawAmt), "Withdrawal failed");
        emit FaucetEmergencyWithdrawal(token, owner, withdrawAmt);
    }
}
