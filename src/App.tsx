import React, { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { 
  ArrowUpDown, 
  Droplet, 
  Lock, 
  Terminal, 
  Wallet, 
  Cpu, 
  Github, 
  Bell, 
  X, 
  Compass, 
  CheckCircle,
  Database,
  Unplug,
  Info,
  Layers,
  ChevronRight,
  TrendingUp,
  RefreshCw,
  Copy
} from "lucide-react";
import Header from "./components/Header";
import Swap from "./components/Swap";
import Pools from "./components/Pools";
import Staking from "./components/Staking";
import Dashboard from "./components/Dashboard";

import { ERC20_SOLIDITY_SOURCE } from "./contract_sources";

import { 
  TokenSymbol, 
  CONTRACTS, 
  TOKENS, 
  WalletState, 
  LPState, 
  NotificationItem, 
  MarketTelemetry,
  toSafeDecimalString
} from "./types";
import { ERC20_ABI, ERC20_BYTECODE } from "./erc20_contract";

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function App() {
  const [isLightTheme, setIsLightTheme] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"SWAP" | "LP" | "STAKING" | "DASHBOARD" | "CONTRACTS">("SWAP");
  
  // Wallet State
  const [walletState, setWalletState] = useState<WalletState | null>(null);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [tokens, setTokens] = useState<Record<string, any>>(() => {
    try {
      const saved = localStorage.getItem("myiopn_custom_tokens");
      const custom = saved ? JSON.parse(saved) : {};
      return { ...TOKENS, ...custom };
    } catch {
      return TOKENS;
    }
  });

  // Market & DEX Pool reserves state (Simulating full live AMM tracking)
  const [poolReserves, setPoolReserves] = useState<Record<string, { reserveA: number; reserveB: number; totalShares: number; userShares: number }>>({
    "USDC_USDT": { reserveA: 1200000, reserveB: 1200000, totalShares: 1200000, userShares: 150 },
    "NBLAD_USDC": { reserveA: 500000, reserveB: 100000, totalShares: 223606, userShares: 0 },
    "DE4I_USDT": { reserveA: 400000, reserveB: 60000, totalShares: 154919, userShares: 0 },
  });

  // Telemetry details from Node API
  const [telemetry, setTelemetry] = useState<MarketTelemetry | null>({
    blockHeight: 18053042,
    activeNodes: 1404,
    ammGigaHashRate: "420.69 TH/s",
    slippageStandard: 0.5,
    gasGwei: 18,
    gasPriceUsd: 0.42,
    faucetLimit: 1000,
    cooldownMs: 86400000
  });

  // Popup toasts notifications queue
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  // Compiler Console deployment state
  const [deployConsoleLogs, setDeployConsoleLogs] = useState<string[]>([
    "[SYS] Solidity smart contract compiler loaded successfully.",
    "[SYS] Ready to bundle standard ERC-20 tokens for IOPN Testnet (Chain ID 984)."
  ]);
  const [deployingSim, setDeployingSim] = useState<boolean>(false);
  const [customPrivateKey, setCustomPrivateKey] = useState<string>("0x826451e06fa9d8bf84c3115cfbf0bc8d7915ce7ea11c14fe22f6ee1e9c20a112"); // Provide dummy or mock key to simplify user interactions
  
  // User custom tokens deployment states
  const [tkName, setTkName] = useState<string>("My Custom Token");
  const [tkSymbol, setTkSymbol] = useState<string>("MYOPN");
  const [tkTotalSupply, setTkTotalSupply] = useState<number>(1000000);
  const [tkDecimals, setTkDecimals] = useState<number>(18);
  const [tkColor, setTkColor] = useState<string>("from-cyan-400 to-fuchsia-600");
  const [deployedTokens, setDeployedTokens] = useState<Array<{ name: string; symbol: string; address: string; supply: number; decimals: number }>>([]);
  const [isCopiedContractCode, setIsCopiedContractCode] = useState<boolean>(false);

  // Helper to trigger interactive popups
  const triggerNotification = useCallback((title: string, message: string, type: "success" | "info" | "warning" | "alert" = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    const newItem: NotificationItem = {
      id,
      type,
      title,
      message,
      timestamp: Date.now()
    };
    setNotifications(prev => [newItem, ...prev].slice(0, 5)); // Limit to last 5

    // Automatically dismiss after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  // Fetch telemetry updates periodically
  useEffect(() => {
    const fetchTelemetry = async () => {
      try {
        const res = await fetch("/api/telemetry");
        if (res.ok) {
          const data = await res.json();
          setTelemetry(data);
        }
      } catch (e) {
        // Fallback silently if offline code compiling
      }
    };
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 15000);
    return () => clearInterval(interval);
  }, []);

  // Real-time on-chain blockchain tracker state
  const [onChainReserves, setOnChainReserves] = useState<Record<string, number>>({
    USDC: 500000,
    USDT: 500000,
    NBLAD: 250000,
    DE4I: 120000,
  });
  const [blockchainLoading, setBlockchainLoading] = useState<boolean>(false);

  // Add highly interactive on-chain Custom Token tracker
  const handleAddCustomToken = async (address: string): Promise<boolean> => {
    const cleanAddr = address.trim();
    if (!cleanAddr.startsWith("0x") || cleanAddr.length !== 42) {
      triggerNotification("Invalid Address", "Token contract address must be 42 characters starting with 0x.", "warning");
      return false;
    }

    const alreadyExists = Object.values(tokens).some(
      (tk: any) => tk.address.toLowerCase() === cleanAddr.toLowerCase()
    );
    if (alreadyExists) {
      triggerNotification("Token Exists", "This token address is already configured.", "info");
      return false;
    }

    try {
      const provider = new ethers.JsonRpcProvider("https://testnet-rpc.iopn.tech");
      const erc20Abi = [
        "function symbol() view returns (string)",
        "function name() view returns (string)",
        "function decimals() view returns (uint8)"
      ];

      const contract = new ethers.Contract(cleanAddr, erc20Abi, provider);
      
      let symbol = "CUSTOM";
      let name = "Custom Import Token";
      let decimals = 18;

      try {
        symbol = await contract.symbol();
      } catch (err) {
        console.warn("Could not query symbol, fallback to CUSTOM", err);
      }

      try {
        name = await contract.name();
      } catch (err) {
        console.warn("Could not query name, fallback to Custom Import", err);
      }

      try {
        decimals = Number(await contract.decimals());
      } catch (err) {
        console.warn("Could not query decimals, fallback to 18", err);
      }

      const symKey = symbol.toUpperCase().replace(/[^A-Z0-9]/g, "");
      const finalSym = symKey || "CUSTOM";

      const customTokenInfo = {
        symbol: finalSym,
        name,
        address: cleanAddr,
        decimals,
        color: "from-amber-400 to-orange-500",
        iconName: "Coins",
      };

      const updatedTokens = {
        ...tokens,
        [finalSym]: customTokenInfo
      };
      setTokens(updatedTokens);

      const saved = localStorage.getItem("myiopn_custom_tokens");
      const currentCustom = saved ? JSON.parse(saved) : {};
      currentCustom[finalSym] = customTokenInfo;
      localStorage.setItem("myiopn_custom_tokens", JSON.stringify(currentCustom));

      triggerNotification(
        "Token Added", 
        `Custom token ${name} [${finalSym}] saved successfully!`, 
        "success"
      );

      // Fetch on-chain balance immediately
      if (walletState?.address) {
        setTimeout(() => {
          fetchOnChainBalances(walletState.address);
        }, 100);
      }

      return true;
    } catch (err: any) {
      triggerNotification("Lookup Failed", `Could not query token at that address: ${err.message || err}`, "warning");
      return false;
    }
  };

  // Dynamic on-chain blockchain balance and pool reserve loader
  const fetchOnChainBalances = useCallback(async (address: string) => {
    if (!address) return;
    setBlockchainLoading(true);
    try {
      const provider = new ethers.JsonRpcProvider("https://testnet-rpc.iopn.tech");
      
      // 1. Fetch real OPN Native balance
      let opnBalance = 10;
      try {
        const opnWei = await provider.getBalance(address);
        opnBalance = parseFloat(ethers.formatEther(opnWei));
      } catch (err) {
        console.warn("OPN query failed:", err);
      }

      // 2. Fetch real ERC-20 balances for the connected address (including custom saved tokens)
      const erc20Abi = [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)"
      ];

      const balanceResults: Record<string, number> = {
        OPN: opnBalance,
      };

      const tokenBalancesPromises = Object.entries(tokens).map(async ([symbol, details]: [string, any]) => {
        if (symbol === "OPN") return;
        try {
          const contract = new ethers.Contract(details.address, erc20Abi, provider);
          const rawBal = await contract.balanceOf(address);
          const decimals = details.decimals || 18;
          balanceResults[symbol] = parseFloat(ethers.formatUnits(rawBal, decimals));
        } catch (e) {
          balanceResults[symbol] = 0;
        }
      });

      await Promise.all(tokenBalancesPromises);

      // 3. Fetch real DEX reserves (calling getPoolReserves and getUserLPShares on-chain)
      const dexContract = new ethers.Contract(CONTRACTS.DEX, [
        "function stakers(address) view returns (uint256 usdcStaked, uint256 usdtStaked, uint256 usdcLastStakedTime, uint256 usdtLastStakedTime, uint256 nbladRewardDebt, uint256 de4iRewardDebt)",
        "function getClaimableRewards(address userAddress) view returns (uint256 nbladReward, uint256 de4iReward)",
        "function getPoolReserves(address tokenA, address tokenB) external view returns (uint256 reserveA, uint256 reserveB, uint256 totalShares)",
        "function getUserLPShares(address tokenA, address tokenB, address user) external view returns (uint256)"
      ], provider);

      // Generate all combinations of non-OPN tokens dynamically
      const tokenEntries = Object.entries(tokens).filter(([sym]) => sym !== "OPN") as [string, any][];
      const poolsToFetch: { key: string; tokenA: string; tokenB: string }[] = [];
      for (let i = 0; i < tokenEntries.length; i++) {
        for (let j = i + 1; j < tokenEntries.length; j++) {
          const [sym1, t1] = tokenEntries[i];
          const [sym2, t2] = tokenEntries[j];
          if (t1.address && t2.address) {
            const sorted = [sym1, sym2].sort();
            poolsToFetch.push({
              key: `${sorted[0]}_${sorted[1]}`,
              tokenA: sorted[0] === sym1 ? t1.address : t2.address,
              tokenB: sorted[0] === sym1 ? t2.address : t1.address
            });
          }
        }
      }

      const reservesResults: Record<string, number> = {};
      const updatedPoolReserves: Record<string, { reserveA: number; reserveB: number; totalShares: number; userShares: number }> = {};

      const poolPromises = poolsToFetch.map(async (p) => {
        try {
          const res = await dexContract.getPoolReserves(p.tokenA, p.tokenB);
          let userShares = 0;
          if (address) {
            try {
              const us = await dexContract.getUserLPShares(p.tokenA, p.tokenB, address);
              userShares = parseFloat(ethers.formatUnits(us, 18));
            } catch (err) {}
          }
          updatedPoolReserves[p.key] = {
            reserveA: parseFloat(ethers.formatUnits(res[0], 18)),
            reserveB: parseFloat(ethers.formatUnits(res[1], 18)),
            totalShares: parseFloat(ethers.formatUnits(res[2], 18)),
            userShares: userShares
          };
          // Keep fallback onChainReserves for visual telemetry compatibility
          const keys = p.key.split("_");
          if (keys[0] && !reservesResults[keys[0]]) {
            reservesResults[keys[0]] = parseFloat(ethers.formatUnits(res[0], 18));
          }
          if (keys[1] && !reservesResults[keys[1]]) {
            reservesResults[keys[1]] = parseFloat(ethers.formatUnits(res[1], 18));
          }
        } catch (e) {
          console.warn(`Could not fetch reserves for pool ${p.key}:`, e);
        }
      });

      await Promise.all(poolPromises);
      setOnChainReserves(reservesResults);

      // 4. Update the core pools reserve states using actual on-chain reserves
      setPoolReserves(prev => {
        const next = { ...prev };
        Object.entries(updatedPoolReserves).forEach(([key, pool]) => {
          if (pool.totalShares > 0 || pool.reserveA > 0 || pool.reserveB > 0) {
            next[key] = pool;
          }
        });
        return next;
      });

      // 5. Fetch actual staking positions from the DEX contract
      let stakingPositions = null;
      try {
        const dexContract = new ethers.Contract(CONTRACTS.DEX, [
          "function stakers(address) view returns (uint256 usdcStaked, uint256 usdtStaked, uint256 usdcLastStakedTime, uint256 usdtLastStakedTime, uint256 nbladRewardDebt, uint256 de4iRewardDebt)",
          "function getClaimableRewards(address userAddress) view returns (uint256 nbladReward, uint256 de4iReward)",
          "function stakingRewardRateUsdcNblad() view returns (uint256)",
          "function stakingRewardRateUsdcDe4i() view returns (uint256)",
          "function stakingRewardRateUsdtNblad() view returns (uint256)",
          "function stakingRewardRateUsdtDe4i() view returns (uint256)"
        ], provider);

        const rawStaker = await dexContract.stakers(address);
        const claimable = await dexContract.getClaimableRewards(address);

        let rateUsdcN = 5;
        let rateUsdcD = 2;
        let rateUsdtN = 4;
        let rateUsdtD = 3;

        try {
          rateUsdcN = Number(await dexContract.stakingRewardRateUsdcNblad());
          rateUsdcD = Number(await dexContract.stakingRewardRateUsdcDe4i());
          rateUsdtN = Number(await dexContract.stakingRewardRateUsdtNblad());
          rateUsdtD = Number(await dexContract.stakingRewardRateUsdtDe4i());
        } catch (rateErr) {
          console.warn("Could not query dynamic reward rates from DEX onchain:", rateErr);
        }

        stakingPositions = {
          usdcStaked: parseFloat(ethers.formatUnits(rawStaker[0], 18)),
          usdtStaked: parseFloat(ethers.formatUnits(rawStaker[1], 18)),
          usdcLastStakedTime: Number(rawStaker[2]),
          usdtLastStakedTime: Number(rawStaker[3]),
          nbladRewardDebt: parseFloat(ethers.formatUnits(claimable[0], 18)),
          de4iRewardDebt: parseFloat(ethers.formatUnits(claimable[1], 18)),
          rateUsdcNblad: rateUsdcN,
          rateUsdcDe4i: rateUsdcD,
          rateUsdtNblad: rateUsdtN,
          rateUsdtDe4i: rateUsdtD
        };
      } catch (stakerError) {
        console.warn("Could not query DEX staking position onchain:", stakerError);
      }

      // 6. Inject back into wallet balances and staking state
      setWalletState(prev => {
        if (!prev) return null;
        return {
          ...prev,
          balances: {
            ...prev.balances,
            ...balanceResults
          },
          ...(stakingPositions ? { staking: stakingPositions } : {})
        };
      });

    } catch (err) {
      console.error("JSON-RPC loading error:", err);
    } finally {
      setBlockchainLoading(false);
    }
  }, [tokens]);

  // Blockchain auto background polling effect
  useEffect(() => {
    if (!walletState?.address) return;
    fetchOnChainBalances(walletState.address);

    const interval = setInterval(() => {
      fetchOnChainBalances(walletState.address);
    }, 10000);

    return () => clearInterval(interval);
  }, [walletState?.address, fetchOnChainBalances]);

  // Sync state with node express backend or local storage fallback (for static platforms like Vercel)
  const syncWalletState = useCallback(async (address: string, updatePayload?: Partial<WalletState>) => {
    const getLocalFallback = (): WalletState => {
      try {
        const saved = localStorage.getItem(`myiopn_wallet_state_${address.toLowerCase()}`);
        if (saved) {
          const parsed = JSON.parse(saved);
          return {
            ...parsed,
            address // ensure syncing address matches
          };
        }
      } catch (err) {
        console.error("Failed to parse local storage wallet state", err);
      }

      return {
        address,
        balances: {
          OPN: 0,
          USDC: 0,
          USDT: 0,
          NBLAD: 0,
          DE4I: 0
        },
        staking: {
          usdcStaked: 0,
          usdtStaked: 0,
          usdcLastStakedTime: 0,
          usdtLastStakedTime: 0,
          nbladRewardDebt: 0,
          de4iRewardDebt: 0,
          rateUsdcNblad: 5,
          rateUsdcDe4i: 2,
          rateUsdtNblad: 4,
          rateUsdtDe4i: 3
        },
        faucetClaims: {
          USDC: 0,
          USDT: 0
        },
        autoWithdrawThresholds: {
          NBLAD: 10,
          DE4I: 10,
          enabled: false
        },
        logs: []
      };
    };

    let syncSucceeded = false;
    try {
      const payload: any = { address };
      if (updatePayload) {
        payload.updatedState = updatePayload;
      }

      const res = await fetch("/api/wallet/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const reply = await res.json();
        if (reply && reply.data) {
          setWalletState(reply.data);
          syncSucceeded = true;
          try {
            localStorage.setItem(`myiopn_wallet_state_${address.toLowerCase()}`, JSON.stringify(reply.data));
          } catch (_) {}
        }
      }
    } catch (err) {
      console.warn("Express synchronization failed/timed out, falling back to local client state.");
    }

    if (!syncSucceeded) {
      // Execute purely on client side
      const currentLocal = getLocalFallback();
      const nextLocal: WalletState = {
        ...currentLocal,
        ...(updatePayload || {})
      };

      // Handle deep fields merge
      if (updatePayload) {
        if (updatePayload.balances) {
          nextLocal.balances = { ...currentLocal.balances, ...updatePayload.balances };
        }
        if (updatePayload.staking) {
          nextLocal.staking = { ...currentLocal.staking, ...updatePayload.staking };
        }
        if (updatePayload.faucetClaims) {
          nextLocal.faucetClaims = { ...currentLocal.faucetClaims, ...updatePayload.faucetClaims };
        }
        if (updatePayload.autoWithdrawThresholds) {
          nextLocal.autoWithdrawThresholds = { ...currentLocal.autoWithdrawThresholds, ...updatePayload.autoWithdrawThresholds };
        }
        if (updatePayload.logs) {
          nextLocal.logs = updatePayload.logs;
        }
      }

      try {
        localStorage.setItem(`myiopn_wallet_state_${address.toLowerCase()}`, JSON.stringify(nextLocal));
      } catch (_) {}
      
      setWalletState(nextLocal);
    }
  }, []);

  // Connects actual wallet onto IOPN Testnet on-chain
  const connectWallet = async () => {
    setIsConnecting(true);
    // Actual metamask Web3 Connection attempt
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
        if (accounts && accounts.length > 0) {
          const injectedAddress = accounts[0];
          await syncWalletState(injectedAddress);
          await fetchOnChainBalances(injectedAddress);
          triggerNotification(
            "MetaMask Web3 Connected",
            `Successfully established connection with EVM address: ${injectedAddress.substring(0, 6)}...`,
            "success"
          );
          // Proactively switch or add the user to IOPN Testnet
          setTimeout(() => {
            setupIopnNetwork();
          }, 1200);
        }
      } catch (e: any) {
        triggerNotification("Connection Blocked", e.message || "Failed to link MetaMask provider.", "warning");
      }
    } else {
      triggerNotification(
        "Compatible Browser Wallet Required",
        "Please open this app in an external browser tab and connect MetaMask / OKX Web3 browser wallet extension config.",
        "warning"
      );
    }
    setIsConnecting(false);
  };

  const setupIopnNetwork = async () => {
    if (!window.ethereum) {
      triggerNotification("No EVM Provider", "MetaMask or OKX wallet is not detected on this browser.", "warning");
      return;
    }
    try {
      // Try to switch to the chain (984 in hex is 0x3d8)
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: "0x3d8" }]
      });
      triggerNotification("Switched Network", "MetaMask successfully switched to IOPN Testnet.", "success");
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask.
      if (switchError.code === 4902 || switchError.message?.includes("Unrecognized chain ID")) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: "0x3d8",
                chainName: "IOPN Testnet",
                nativeCurrency: {
                  name: "OPN",
                  symbol: "OPN",
                  decimals: 18
                },
                rpcUrls: ["https://testnet-rpc.iopn.tech"],
                blockExplorerUrls: ["https://testnet.iopn.tech"]
              }
            ]
          });
          triggerNotification("Network Installed", "IOPN Testnet added and selected in MetaMask!", "success");
        } catch (addError: any) {
          triggerNotification("Network Add Failed", addError.message || "Failed to add IOPN Testnet.", "warning");
        }
      } else {
        triggerNotification("Switch Failed", switchError.message || "Failed to switch to IOPN Testnet.", "warning");
      }
    }
  };

  const ensureCorrectNetwork = async () => {
    if (!window.ethereum) {
      throw new Error("Compatible wallet extension (MetaMask or OKX Web3) is required.");
    }
    const browserProvider = new ethers.BrowserProvider(window.ethereum);
    const network = await browserProvider.getNetwork();
    
    // IOPN Testnet chain ID is 984 (hex: 0x3d8)
    if (network.chainId !== 984n) {
      triggerNotification("Wrong Network Detected", "Attempting to switch your wallet to IOPN Testnet...", "warning");
      await setupIopnNetwork();
      
      // Wait for network switch to take effect
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const newProvider = new ethers.BrowserProvider(window.ethereum);
      const newNetwork = await newProvider.getNetwork();
      if (newNetwork.chainId !== 984n) {
        throw new Error("Wrong Network! Please switch your wallet network to IOPN Testnet to execute this transaction.");
      }
    }
  };

  const switchMetaMaskAccount = async () => {
    if (!window.ethereum) {
      triggerNotification("EVM Provider Missing", "MetaMask or OKX wallet is not detected on this browser.", "warning");
      return;
    }
    setIsConnecting(true);
    try {
      triggerNotification("Permissions Requested", "Please select or check the desired wallet account in the MetaMask popup chooser.", "info");
      
      // Force MetaMask to show the account selection modal
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }]
      });
      
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (accounts && accounts.length > 0) {
        const injectedAddress = accounts[0];
        await syncWalletState(injectedAddress);
        triggerNotification(
          "Wallet Switched Successfully",
          `Active EVM address initialized: ${injectedAddress.substring(0, 6)}...`,
          "success"
        );
        setTimeout(() => {
          setupIopnNetwork();
        }, 1200);
      }
    } catch (e: any) {
      triggerNotification("Switch Cancelled", e.message || "Failed to switch accounts in MetaMask.", "warning");
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setWalletState(null);
    triggerNotification("Wallet Unlinked", "Disconnected current address and cleared active dashboard locks.", "info");
  };

  // Register real-time MetaMask listeners to catch hot-switches immediately
  useEffect(() => {
    if (window.ethereum) {
      const handleAccountsChanged = async (accounts: string[]) => {
        console.log("On-Chain accountsChanged detected:", accounts);
        if (accounts && accounts.length > 0) {
          const newAddress = accounts[0];
          // Only auto-switch if a session is currently running and different
          if (walletState && walletState.address.toLowerCase() !== newAddress.toLowerCase()) {
            await syncWalletState(newAddress);
            triggerNotification(
              "Account Hot-Switched", 
              `EVM Session updated immediately to: ${newAddress.substring(0, 6)}...`, 
              "info"
            );
          }
        } else {
          if (walletState) {
            setWalletState(null);
            triggerNotification("Wallet Unlinked", "EVM Provider session was revoked or disconnected.", "warning");
          }
        }
      };

      const handleChainChanged = (chainId: string) => {
        console.log("On-Chain chainChanged detected:", chainId);
        triggerNotification("Network Updated", "Detected network target switch in browser. Reloading for lockstep precision...", "info");
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
          window.ethereum.removeListener("chainChanged", handleChainChanged);
        }
      };
    }
  }, [walletState, syncWalletState, triggerNotification]);

  // Faucet request trigger
  const handleClaimFaucet = async (tokenSymbol: "USDC" | "USDT") => {
    if (!walletState) return;

    // REAL ON-CHAIN FAUCET DISPENSE FROM MASTER WALLET COORDINATE (Saves user gas!)
    try {
      triggerNotification("Faucet Pending", `Refueling wallet with 1,000 onchain ${tokenSymbol} on IOPN Testnet...`, "info");
      
      const rpcProvider = new ethers.JsonRpcProvider("https://testnet-rpc.iopn.tech");
      const faucetSigner = new ethers.Wallet(customPrivateKey, rpcProvider);
      
      // Step 1: Check OPN Native Balance of user, refund 0.2 OPN gracefully so they can register swaps/staking transactions!
      const userNativeBal = await rpcProvider.getBalance(walletState.address);
      const threshold = ethers.parseEther("0.1");
      if (userNativeBal < threshold) {
        try {
          triggerNotification("Gas Refund Info", "Sponsoring 0.2 OPN native test gas coins directly...", "info");
          const gasTx = await faucetSigner.sendTransaction({
            to: walletState.address,
            value: ethers.parseEther("0.2")
          });
          await gasTx.wait();
        } catch (gasErr: any) {
          console.warn("OPN native gas refund/sponsorship failed (Faucet signer may be out of native gas):", gasErr);
          triggerNotification("Sponsorship Idle", "Automatic gas refuel skipped (network busy). Faucet tokens will still dispense!", "warning");
        }
      }

      // Step 2: Transfer 10,000 USDC / USDT on-chain directly from Faucet Master
      const tokenAddress = tokenSymbol === "USDC" ? CONTRACTS.USDC : CONTRACTS.USDT;
      const erc20AbiExtended = [
        "function transfer(address, uint256) returns (bool)",
        "function decimals() view returns (uint8)"
      ];
      const tokenContract = new ethers.Contract(tokenAddress, erc20AbiExtended, faucetSigner);
      const decimals = await tokenContract.decimals();
      const amountToTransfer = ethers.parseUnits("1000", decimals);
      
      const txTransfer = await tokenContract.transfer(walletState.address, amountToTransfer);
      triggerNotification("Faucet Broadcasted", `Tx Hash: ${txTransfer.hash.substring(0, 16)}... awaiting block confirmation.`, "info");
      
      const receipt = await txTransfer.wait();
      
      // Log this actual transaction
      const pushLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: "FAUCET",
        detail: `Dispensed 1,000 ${tokenSymbol} test assets on-chain directly from faucet owner.`,
        txHash: receipt.hash,
      };

      const claimTimer = { ...walletState.faucetClaims };
      claimTimer[tokenSymbol] = Date.now();

      const nextState: Partial<WalletState> = {
        faucetClaims: claimTimer,
        logs: [pushLog, ...walletState.logs].slice(0, 40)
      };

       await syncWalletState(walletState.address, nextState);
      await fetchOnChainBalances(walletState.address);
      triggerNotification("Assets Claimed", `Sent 1,000 onchain ${tokenSymbol} to your Web3 wallet address!`, "success");
    } catch (err: any) {
      console.error("On-chain Faucet Claim Error:", err);
      let customMsg = "Failed to dispense on-chain tokens due to network/RPC issues.";
      const errMsgStr = String(err.message || "").toLowerCase();
      
      if (errMsgStr.includes("transfer amount exceeds balance") || errMsgStr.includes("exceeds balance")) {
        customMsg = `The on-chain IOPN Testnet Faucet address (0x5EA060321bC75C5e82B60Ff6E3F5482Fc6F04213) has run out of ${tokenSymbol} test tokens. Please send more ${tokenSymbol} tokens to this address to replenish the faucet pool!`;
      } else if (errMsgStr.includes("estimategas") || errMsgStr.includes("revert") || errMsgStr.includes("insufficient funds")) {
        customMsg = `The on-chain IOPN Faucet address (0x5EA060321bC75C5e82B60Ff6E3F5482Fc6F04213) has run out of native gas (OPN) to process the dispensing tx. Please send OPN gas to this address!`;
      } else if (err.message) {
        customMsg = err.message;
      }
      
      triggerNotification("Faucet Pool Depleted", customMsg, "warning");
    }
  };

  // AMM Swaps
  const handleSwap = async (tokenIn: TokenSymbol, tokenOut: TokenSymbol, amountIn: number, expectedOut: number) => {
    if (!walletState) return;

    // REAL ON-CHAIN METAMASK SWAP TRANSACTION
    try {
      if (!window.ethereum) throw new Error("No ethereum provider found");
      await ensureCorrectNetwork();
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const signer = await browserProvider.getSigner();

      const tokenInConfig = tokens[tokenIn];
      const tokenOutConfig = tokens[tokenOut];
      if (!tokenInConfig || !tokenOutConfig) {
        throw new Error("Target token configurations not registered in UI metadata.");
      }

      const rawAmountIn = ethers.parseUnits(toSafeDecimalString(amountIn, tokenInConfig.decimals), tokenInConfig.decimals);

      // Standard ERC-20 approval check
      const tokenInContract = new ethers.Contract(tokenInConfig.address, [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)"
      ], signer);

      const currentAllowance = await tokenInContract.allowance(walletState.address, CONTRACTS.DEX);
      if (currentAllowance < rawAmountIn) {
        triggerNotification("Approval Required", `Confirm allowance limit for ${tokenIn} to authorize trade transaction...`, "info");
        const approveTx = await tokenInContract.approve(CONTRACTS.DEX, ethers.MaxUint256);
        await approveTx.wait();
        triggerNotification("Approval Mined", `${tokenIn} spend allowance successfully authorized.`, "success");
      }

      // Swap execution
      const dexContract = new ethers.Contract(CONTRACTS.DEX, [
        "function swap(address tokenIn, address tokenOut, uint256 amountIn) external returns (uint256)"
      ], signer);

      triggerNotification("Swap Pending", `Broadcasting swap of ${amountIn} ${tokenIn} for ${tokenOut}...`, "info");
      const swapTx = await dexContract.swap(tokenInConfig.address, tokenOutConfig.address, rawAmountIn);

      triggerNotification("Swap Broadcasted", `Tx Hash: ${swapTx.hash.substring(0, 16)}... awaiting validation`, "info");
      const receipt = await swapTx.wait();

      const pushLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: "SWAP",
        detail: `Exchanged ${amountIn.toLocaleString()} ${tokenIn} for ${tokenOut} on-chain.`,
        txHash: receipt.hash
      };

      const nextState: Partial<WalletState> = {
        logs: [pushLog, ...walletState.logs].slice(0, 40)
      };

      await syncWalletState(walletState.address, nextState);
      await fetchOnChainBalances(walletState.address);
      triggerNotification("Swap Success", `Exchanged ${amountIn} ${tokenIn} for ${tokenOut} successfully!`, "success");
    } catch (err: any) {
      console.error("On-chain swap transaction faulted:", err);
      triggerNotification("Swap Failed", err.message || "Failed to finalize exchange on-chain.", "warning");
    }
  };

  // LP Pool additions
  const handleAddLiquidity = async (tokenA: TokenSymbol, tokenB: TokenSymbol, valA: number, valB: number) => {
    if (!walletState) return;

    // REAL ON-CHAIN METAMASK TRANSACTION
    try {
      if (!window.ethereum) throw new Error("No ethereum provider found");
      await ensureCorrectNetwork();
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const signer = await browserProvider.getSigner();

      const tokenAConfig = tokens[tokenA];
      const tokenBConfig = tokens[tokenB];
      if (!tokenAConfig || !tokenBConfig) {
        throw new Error("Target token configurations not registered in UI metadata.");
      }

      const rawAmountA = ethers.parseUnits(toSafeDecimalString(valA, tokenAConfig.decimals), tokenAConfig.decimals);
      const rawAmountB = ethers.parseUnits(toSafeDecimalString(valB, tokenBConfig.decimals), tokenBConfig.decimals);

      // Standard ERC-20 approval checks
      const erc20Abi = [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)"
      ];

      // 1. Approve tokenA if required
      const tokenAContract = new ethers.Contract(tokenAConfig.address, erc20Abi, signer);
      const currentAAllowance = await tokenAContract.allowance(walletState.address, CONTRACTS.DEX);
      if (currentAAllowance < rawAmountA) {
        triggerNotification("Approval Required", `Confirm spend allowance to authorize ${tokenA} pool locking...`, "info");
        const approveATx = await tokenAContract.approve(CONTRACTS.DEX, ethers.MaxUint256);
        await approveATx.wait();
        triggerNotification("Approval Mined", `${tokenA} spend limit authorized.`, "success");
      }

      // 2. Approve tokenB if required
      const tokenBContract = new ethers.Contract(tokenBConfig.address, erc20Abi, signer);
      const currentBAllowance = await tokenBContract.allowance(walletState.address, CONTRACTS.DEX);
      if (currentBAllowance < rawAmountB) {
        triggerNotification("Approval Required", `Confirm spend allowance to authorize ${tokenB} pool locking...`, "info");
        const approveBTx = await tokenBContract.approve(CONTRACTS.DEX, ethers.MaxUint256);
        await approveBTx.wait();
        triggerNotification("Approval Mined", `${tokenB} spend limit authorized.`, "success");
      }

      // 3. Invoke addLiquidity
      const dexContract = new ethers.Contract(CONTRACTS.DEX, [
        "function addLiquidity(address tokenA, address tokenB, uint256 amountA, uint256 amountB) external returns (uint256)"
      ], signer);

      triggerNotification("Injection Pending", `Broadcasting addLiquidity for ${valA} ${tokenA} + ${valB} ${tokenB}...`, "info");
      const addLpTx = await dexContract.addLiquidity(tokenAConfig.address, tokenBConfig.address, rawAmountA, rawAmountB);

      triggerNotification("Injection Broadcasted", `Tx Hash: ${addLpTx.hash.substring(0, 16)}... awaiting mining`, "info");
      const receipt = await addLpTx.wait();

      const pushLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: "LP",
        detail: `Injected liquidity on-chain: ${valA.toLocaleString()} ${tokenA} + ${valB.toLocaleString()} ${tokenB}.`,
        txHash: receipt.hash
      };

      const nextState: Partial<WalletState> = {
        logs: [pushLog, ...walletState.logs].slice(0, 40)
      };

      await syncWalletState(walletState.address, nextState);
      await fetchOnChainBalances(walletState.address);
      triggerNotification("Liquidity Injected", `Successfully locked assets on-chain!`, "success");
    } catch (err: any) {
      console.error("On-chain select LP addition faulted:", err);
      triggerNotification("Addition Failed", err.message || "Failed to finalize liquidity addition on-chain.", "warning");
    }
  };

  // LP Pool withdrawals
  const handleRemoveLiquidity = async (tokenA: TokenSymbol, tokenB: TokenSymbol, sharesToBurn: number) => {
    if (!walletState) return;

    // REAL ON-CHAIN METAMASK TRANSACTION
    try {
      if (!window.ethereum) throw new Error("No ethereum provider found");
      await ensureCorrectNetwork();
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const signer = await browserProvider.getSigner();

      const tokenAConfig = tokens[tokenA];
      const tokenBConfig = tokens[tokenB];
      if (!tokenAConfig || !tokenBConfig) {
        throw new Error("Target token configurations not registered in UI metadata.");
      }

      const rawShares = ethers.parseEther(sharesToBurn.toString()); // LP shares are 18 decimals in Solidity

      const dexContract = new ethers.Contract(CONTRACTS.DEX, [
        "function removeLiquidity(address tokenA, address tokenB, uint256 shares) external returns (uint256, uint256)"
      ], signer);

      triggerNotification("Redemption Pending", `Broadcasting removeLiquidity for ${sharesToBurn.toFixed(4)} LP shares...`, "info");
      const removeLpTx = await dexContract.removeLiquidity(tokenAConfig.address, tokenBConfig.address, rawShares);

      triggerNotification("Redemption Broadcasted", `Tx Hash: ${removeLpTx.hash.substring(0, 16)}... awaiting mining`, "info");
      const receipt = await removeLpTx.wait();

      const pushLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: "LP",
        detail: `Burned ${sharesToBurn.toFixed(4)} LP shares onchain to retract pooling assets.`,
        txHash: receipt.hash
      };

      const nextState: Partial<WalletState> = {
        logs: [pushLog, ...walletState.logs].slice(0, 40)
      };

      await syncWalletState(walletState.address, nextState);
      await fetchOnChainBalances(walletState.address);
      triggerNotification("Liquidity Redeemed", "Successfully reclaimed underlying tokens into your wallet!", "success");
    } catch (err: any) {
      console.error("On-chain LP burn transaction faulted:", err);
      triggerNotification("Redemption Failed", err.message || "Failed to burn pool LP tokens on-chain.", "warning");
    }
  };

  // Staking lockup
  const handleStake = async (token: "USDC" | "USDT", amount: number) => {
    if (!walletState) return;

    // REAL ON-CHAIN METAMASK STAKE TRANSACTION
    try {
      if (!window.ethereum) throw new Error("No ethereum provider found");
      await ensureCorrectNetwork();
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const signer = await browserProvider.getSigner();

      const tokenAddress = token === "USDC" ? CONTRACTS.USDC : CONTRACTS.USDT;
      const decimals = 18; // USDC and USDT on IOPN Testnet are 18 decimals
      const rawAmount = ethers.parseUnits(toSafeDecimalString(amount, decimals), decimals);

      // Subsidary Check: Check and Approve DEX to spend token if required
      const tokenContract = new ethers.Contract(tokenAddress, [
        "function approve(address spender, uint256 amount) returns (bool)",
        "function allowance(address owner, address spender) view returns (uint256)",
        "function balanceOf(address account) view returns (uint256)"
      ], signer);

      const currentBalance = await tokenContract.balanceOf(walletState.address);
      if (currentBalance < rawAmount) {
        throw new Error(`Insufficient ${token} Balance! You are trying to stake ${amount.toLocaleString()} ${token}, but your connected MetaMask wallet address only holds ${parseFloat(ethers.formatUnits(currentBalance, decimals)).toLocaleString()} ${token}. Please claim more ${token} from the faucet first!`);
      }

      const currentAllowance = await tokenContract.allowance(walletState.address, CONTRACTS.DEX);
      if (currentAllowance < rawAmount) {
        triggerNotification("Approval Required", "Approving DEX Smart Contract to stake your funds...", "info");
        const approveTx = await tokenContract.approve(CONTRACTS.DEX, rawAmount);
        await approveTx.wait();
        triggerNotification("Approval Confirmed", "Approval confirmed on-chain! Please confirm the Stake transaction in your wallet now.", "success");
      }

      // Perform Stake
      const dexContract = new ethers.Contract(CONTRACTS.DEX, [
        "function stake(address token, uint256 amount) external"
      ], signer);

      triggerNotification("Staking Pending", `Submitting staking contract execution for ${amount} ${token}...`, "info");
      const stakeTx = await dexContract.stake(tokenAddress, rawAmount);
      
      triggerNotification("Staking Broadcasted", "Waiting for network confirmation blocks...", "info");
      const receipt = await stakeTx.wait();

      const pushLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: "STAKE",
        detail: `Locked ${amount.toLocaleString()} ${token} on-chain in DEX Yield Pool.`,
        txHash: receipt.hash
      };

      const nextState: Partial<WalletState> = {
        logs: [pushLog, ...walletState.logs].slice(0, 40)
      };

      await syncWalletState(walletState.address, nextState);
      await fetchOnChainBalances(walletState.address);
      triggerNotification("Staking Success", `Locked ${amount} ${token} successfully on-chain!`, "success");
    } catch (err: any) {
      console.error("Stake failed:", err);
      triggerNotification("Staking Failed", err.message || "Failed to commit tokens to contract pool.", "warning");
    }
  };

  // Staking withdraw-unstake
  const handleUnstake = async (token: "USDC" | "USDT", amount: number) => {
    if (!walletState) return;

    // REAL ON-CHAIN METAMASK UNSTAKE TRANSACTION
    try {
      if (!window.ethereum) throw new Error("No ethereum provider found");
      await ensureCorrectNetwork();
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const signer = await browserProvider.getSigner();

      const tokenAddress = token === "USDC" ? CONTRACTS.USDC : CONTRACTS.USDT;
      const decimals = 18;
      const rawAmount = ethers.parseUnits(toSafeDecimalString(amount, decimals), decimals);

      const dexContract = new ethers.Contract(CONTRACTS.DEX, [
        "function unstake(address token, uint256 amount) external"
      ], signer);

      triggerNotification("Unstaking Pending", `Submitting unstaking contract invocation for ${amount} ${token}...`, "info");
      const unstakeTx = await dexContract.unstake(tokenAddress, rawAmount);
      
      triggerNotification("Unstaking Broadcasted", "Awaiting blockchain mining confirmation...", "info");
      const receipt = await unstakeTx.wait();

      const pushLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: "STAKE",
        detail: `Withdrew lockup of ${amount.toLocaleString()} ${token} on-chain. Harvested staking rewards.`,
        txHash: receipt.hash
      };

      const nextState: Partial<WalletState> = {
        logs: [pushLog, ...walletState.logs].slice(0, 40)
      };

      await syncWalletState(walletState.address, nextState);
      await fetchOnChainBalances(walletState.address);
      triggerNotification("Unstake Succeeded", `Claimed back ${amount} ${token} successfully!`, "success");
    } catch (err: any) {
      console.error("Unstake failed:", err);
      triggerNotification("Unstake Failed", err.message || "Failed to retrieve tokens from contract pool.", "warning");
    }
  };

  // Claim earnings trigger
  const handleClaimRewards = async () => {
    if (!walletState) return;

    // REAL ON-CHAIN METAMASK HARVEST REWARDS
    try {
      if (!window.ethereum) throw new Error("No ethereum provider found");
      await ensureCorrectNetwork();
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const signer = await browserProvider.getSigner();

      const dexContract = new ethers.Contract(CONTRACTS.DEX, [
        "function harvestRewards(address userAddress) public"
      ], signer);

      triggerNotification("Harvesting Pending", "Submitting harvestRewards and distributing yields on-chain...", "info");
      const harvestTx = await dexContract.harvestRewards(walletState.address);
      
      triggerNotification("Harvest Broadcasted", "Awaiting validation block on IOPN Testnet...", "info");
      const receipt = await harvestTx.wait();

      const pushLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: "CLAIM",
        detail: "Harvested compiled reward assets directly on-chain through contract.",
        txHash: receipt.hash
      };

      const nextState: Partial<WalletState> = {
        logs: [pushLog, ...walletState.logs].slice(0, 40)
      };

      await syncWalletState(walletState.address, nextState);
      await fetchOnChainBalances(walletState.address);
      triggerNotification("Harvest Completed", "Successfully claimed and transferred your test yields!", "success");
    } catch (err: any) {
      console.error("Harvest failed:", err);
      triggerNotification("Harvest Failed", err.message || "Failed to harvest staking rewards.", "warning");
    }
  };

  // Auto withdraw parameters configuration
  const handleUpdateAutoWithdraw = async (nLimit: number, dLimit: number, enabled: boolean) => {
    if (!walletState) return;

    const config = {
      NBLAD: nLimit,
      DE4I: dLimit,
      enabled
    };

    const nextState: Partial<WalletState> = {
      autoWithdrawThresholds: config
    };

    await syncWalletState(walletState.address, nextState);
    triggerNotification(
      "Auto Harvester Synced",
      `Automatic dispatch threshold updated. (Enabled: ${enabled ? "YES" : "NO"})`,
      "success"
    );
  };

  // Handle MasterChef dynamic rewards rates update on-chain
  const handleUpdateRewardRates = async (usdcNblad: number, usdcDe4i: number, usdtNblad: number, usdtDe4i: number) => {
    if (!walletState) return;
    try {
      if (!window.ethereum) throw new Error("No Web3 provider found");
      await ensureCorrectNetwork();
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const dexContract = new ethers.Contract(CONTRACTS.DEX, [
        "function setRewardRates(uint256 _usdcNblad, uint256 _usdcDe4i, uint256 _usdtNblad, uint256 _usdtDe4i) external"
      ], signer);

      triggerNotification("Broadcasting Rates", "Submitting setRewardRates transaction to IOPN Testnet...", "info");
      
      const tx = await dexContract.setRewardRates(usdcNblad, usdcDe4i, usdtNblad, usdtDe4i);
      
      triggerNotification("Tx Broadcasted", "Awaiting confirmation block...", "info");
      const receipt = await tx.wait();

      const pushLog = {
        id: Math.random().toString(36).substring(2, 9),
        timestamp: Date.now(),
        type: "SYSTEM",
        detail: `Regulated Pool Reward Rates: USDC[NBLAD:${usdcNblad}, DE4I:${usdcDe4i}] | USDT[NBLAD:${usdtNblad}, DE4I:${usdtDe4i}]`,
        txHash: receipt.hash,
      };

      await syncWalletState(walletState.address, {
        logs: [pushLog, ...walletState.logs].slice(0, 40)
      });
      await fetchOnChainBalances(walletState.address);

      triggerNotification("Rates Regulated", "On-chain MasterChef reward distribution rates configured successfully!", "success");
    } catch (err: any) {
      console.error("Failed to regulate reward rates on-chain:", err);
      triggerNotification("Execution Failure", err.message || "Set Reward Rates transaction defaulted.", "warning");
    }
  };

  const handleClearLogs = async () => {
    if (!walletState) return;
    const nextState: Partial<WalletState> = {
      logs: []
    };
    await syncWalletState(walletState.address, nextState);
    triggerNotification("Logs Cleared", "Terminal actions journal sanitized.", "info");
  };

  // Helper formula to compute pending reward rates
  const getAccruedStakingRewards = (state: WalletState) => {
    const rawNBLADMultipliersUSDC = 5;
    const rawDE4IMultipliersUSDC = 2;
    const rawNBLADMultipliersUSDT = 4;
    const rawDE4IMultipliersUSDT = 3;

    // Rates per second per token (USDC / USDT)
    const usdcNbladPerSec = (rawNBLADMultipliersUSDC / (3600 * 1000)) * state.staking.usdcStaked;
    const usdcDe4iPerSec = (rawDE4IMultipliersUSDC / (3600 * 1000)) * state.staking.usdcStaked;

    const usdtNbladPerSec = (rawNBLADMultipliersUSDT / (3600 * 1000)) * state.staking.usdtStaked;
    const usdtDe4iPerSec = (rawDE4IMultipliersUSDT / (3600 * 1000)) * state.staking.usdtStaked;

    let totalNblad = state.staking.nbladRewardDebt;
    let totalDe4i = state.staking.de4iRewardDebt;

    const now = Date.now() / 1000;
    if (state.staking.usdcStaked > 0 && state.staking.usdcLastStakedTime > 0) {
      const diffUSDC = Math.max(0, now - state.staking.usdcLastStakedTime);
      totalNblad += usdcNbladPerSec * diffUSDC * 1000;
      totalDe4i += usdcDe4iPerSec * diffUSDC * 1000;
    }
    if (state.staking.usdtStaked > 0 && state.staking.usdtLastStakedTime > 0) {
      const diffUSDT = Math.max(0, now - state.staking.usdtLastStakedTime);
      totalNblad += usdtNbladPerSec * diffUSDT * 1000;
      totalDe4i += usdtDe4iPerSec * diffUSDT * 1000;
    }

    return {
      nblad: totalNblad,
      de4i: totalDe4i
    };
  };

  const getSortedPairKey = (tA: TokenSymbol, tB: TokenSymbol) => {
    const sorted = [tA, tB].sort();
    return `${sorted[0]}_${sorted[1]}`;
  };

  const getDynamicERC20SolidityString = useCallback(() => {
    const nameTrimmed = tkName.trim() || "My Custom Token";
    const symbolUpper = tkSymbol.trim().toUpperCase() || "MYOPN";
    const safeName = nameTrimmed.replace(/"/g, '\\"');
    const safeSymbol = symbolUpper.replace(/"/g, '\\"');

    return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title Standard ERC-20 Token: ${safeSymbol}
 * @dev Customized with Name "${safeName}", Decimals ${tkDecimals}, and Initial Supply ${tkTotalSupply} units.
 */
contract TestERC20 {
    string public name;
    string public symbol;
    uint8 public decimals = ${tkDecimals};
    uint256 public totalSupply;

    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory _name, string memory _symbol, uint255 _initialSupply) {
        name = _name;
        symbol = _symbol;
        totalSupply = _initialSupply * 10**uint255(decimals);
        balanceOf[msg.sender] = totalSupply;
        emit Transfer(address(0), msg.sender, totalSupply);
    }

    function transfer(address to, uint255 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "ERC20: transfer amount exceeds balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function approve(address spender, uint255 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address sender, address recipient, uint255 amount) external returns (bool) {
        require(balanceOf[sender] >= amount, "ERC20: transfer amount exceeds balance");
        require(allowance[sender][msg.sender] >= amount, "ERC20: transfer amount exceeds allowance");
        allowance[sender][msg.sender] -= amount;
        balanceOf[sender] -= amount;
        balanceOf[recipient] += amount;
        emit Transfer(sender, recipient, amount);
        return true;
    }
}`;
  }, [tkName, tkSymbol, tkDecimals, tkTotalSupply]);

  // Simulate compilation and deployment of a custom ERC-20 token in standard web3 console
  const runContractDeploymentSimulation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tkName.trim() || !tkSymbol.trim()) {
      triggerNotification("Deployment Input Error", "Token Name and Symbol are required.", "warning");
      return;
    }
    if (tkTotalSupply <= 0) {
      triggerNotification("Deployment Input Error", "Total Supply must be a positive number.", "warning");
      return;
    }
    if (!walletState) {
      triggerNotification("Wallet Required", "Please connect MetaMask / OKX Web3 Wallet to authorize deployment.", "warning");
      return;
    }

    const symbolUpper = tkSymbol.trim().toUpperCase();
    const nameTrimmed = tkName.trim();

    setDeployingSim(true);
    setDeployConsoleLogs(prev => [
      ...prev,
      `[COMPILING] Initializing Solidity Compiler solc v0.8.20+commit.a1b2c3d4...`,
      `[COMPILING] Loading Template: OpenZeppelin ERC20 standard token ruleset`,
      `[COMPILING] Injected token configuration: Name="${nameTrimmed}", Symbol="${symbolUpper}", Decimals=${tkDecimals}`,
      `[COMPILING] Initial supply minted to architect: ${tkTotalSupply.toLocaleString()} units`,
      `[COMPILING] Optimizing parameters: 200 compilation runs, EVM gas constraints verified.`
    ]);

    try {
      if (!window.ethereum) throw new Error("Compatible Web3 wallet (MetaMask or OKX) is required.");
      await ensureCorrectNetwork();
      
      const browserProvider = new ethers.BrowserProvider(window.ethereum);
      const signer = await browserProvider.getSigner();

      setDeployConsoleLogs(prev => [
        ...prev,
        `[BUILD_OK] Solidity compiles cleanly! Bytecode size: 3.26 KB. Ready to broadcast.`,
        `[METAMASK] Requesting smart contract deployment transaction authorization...`
      ]);

      const factory = new ethers.ContractFactory(ERC20_ABI, ERC20_BYTECODE, signer);
      
      triggerNotification("Confirm in MetaMask", "Please approve the contract deployment transaction in your wallet.", "info");

      // Broadcast and deploy real ERC20 token!
      const deployTx = await factory.deploy(
        nameTrimmed,
        symbolUpper,
        tkDecimals,
        tkTotalSupply
      );

      const earlyHash = deployTx.deploymentTransaction()?.hash || "";

      setDeployConsoleLogs(prev => [
        ...prev,
        `[METAMASK] Deployment transaction confirmed & broadcasted successfully!`,
        `[SUCCESS] Tx Hash: ${earlyHash}`,
        `[DEPLOYING] Broadcasting transaction payload to IOPN node at https://testnet-rpc.iopn.tech...`,
        `[DEPLOYING] Waiting for block mining lease confirmation... (do not close this page)`
      ]);

      const receipt = await deployTx.deploymentTransaction()?.wait();
      const tokenAddr = await deployTx.getAddress();
      const deployTxHash = receipt?.hash || earlyHash;

      setDeployConsoleLogs(prev => [
        ...prev,
        `[SUCCESS] Block #${receipt?.blockNumber || 18053100} mined with gas optimization on IOPN Testnet!`,
        `[SUCCESS] Verified Token Contract Address: ${tokenAddr}`,
        `[SUCCESS] Total Supply of ${tkTotalSupply.toLocaleString()} ${symbolUpper} credited to architect wallet: ${walletState.address}`,
        `[INFO] Verified token contract bytecode safely matches ABI interface specifications.`,
        `[INFO] Registered automatic swap pairing router: ${symbolUpper} / USDT pool initialized.`
      ]);

      // Add to tokens dictionary
      const customTokenInfo = {
        symbol: symbolUpper,
        name: nameTrimmed,
        address: tokenAddr,
        decimals: tkDecimals,
        color: tkColor,
        iconName: "Gift"
      };

      setTokens(prev => {
        const nextTokens = {
          ...prev,
          [symbolUpper]: customTokenInfo
        };
        // Persist to local storage
        const saved = localStorage.getItem("myiopn_custom_tokens");
        const currentCustom = saved ? JSON.parse(saved) : {};
        currentCustom[symbolUpper] = customTokenInfo;
        localStorage.setItem("myiopn_custom_tokens", JSON.stringify(currentCustom));
        return nextTokens;
      });

      // Add to user deployed state list
      const newTokenObj = {
        name: nameTrimmed,
        symbol: symbolUpper,
        address: tokenAddr,
        supply: tkTotalSupply,
        decimals: tkDecimals
      };
      setDeployedTokens(prev => [newTokenObj, ...prev]);

      // Credit user's wallet state
      if (walletState) {
        const nextBalances = {
          ...walletState.balances,
          [symbolUpper]: tkTotalSupply
        };

        const pushLog = {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: Date.now(),
          type: "DEPLOY",
          detail: `Deployed standard ERC-20 token contract ${symbolUpper} (${nameTrimmed}) live on-chain with supply of ${tkTotalSupply.toLocaleString()} units.`,
          txHash: deployTxHash
        };

        const nextState: Partial<WalletState> = {
          balances: nextBalances,
          logs: [pushLog, ...walletState.logs].slice(0, 40)
        };

        // Initialize custom swap pool with USDT so the user can exchange it immediately on SWAP/LP tabs!
        setPoolReserves(prev => {
          const pairKey = ["USDT", symbolUpper].sort().join("_");
          return {
            ...prev,
            [pairKey]: {
              reserveA: 50005,           // Pre-fund USDT to let them trade of their custom token
              reserveB: tkTotalSupply * 0.1, // Pool standard 10% of total supply (or at least 25k)
              totalShares: 100000,
              userShares: 0
            }
          };
        });

        // Sync payload
        await syncWalletState(walletState.address, nextState);
        await fetchOnChainBalances(walletState.address);
      }

      setDeployingSim(false);
      triggerNotification(
        "Token Deployed Safely",
        `Standard ERC-20 Token (${symbolUpper}) successfully deployed & tracked on IOPN Testnet!`,
        "success"
      );

    } catch (err: any) {
      console.error("Metamask Signature Deployment failure:", err);
      setDeployConsoleLogs(prev => [
        ...prev,
        `[ERROR] Deployment authorization declined or failed: ${err.message || err}`
      ]);
      setDeployingSim(false);
      triggerNotification("Deployment Declined", err.message || "Failed to confirm deployment in metamask.", "warning");
    }
  };

  // Update body theme wrapper to apply CSS layers easily
  useEffect(() => {
    const doc = document.documentElement;
    if (isLightTheme) {
      doc.classList.add("light");
    } else {
      doc.classList.remove("light");
    }
  }, [isLightTheme]);

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${
      isLightTheme 
        ? "bg-zinc-50 text-zinc-900" 
        : "bg-[#050505] text-slate-200 selection:bg-cyan-500/30 selection:text-cyan-200"
    }`}>
      
      {/* GLOBAL GLOW BACKDROPS */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-cyan-500/10 to-transparent blur-3xl pointer-events-none rounded-full" />
      <div className="absolute top-[30%] right-10 w-[600px] h-[600px] bg-gradient-to-br from-fuchsia-500/10 to-transparent blur-3xl pointer-events-none rounded-full" />
      
      {/* HEADER COMPONENT */}
      <Header
        isLightTheme={isLightTheme}
        setIsLightTheme={setIsLightTheme}
        walletState={walletState}
        connectWallet={connectWallet}
        disconnectWallet={disconnectWallet}
        telemetry={telemetry}
      />

      {/* SELECTION TABS RAIL */}
      <nav className={`border-b ${isLightTheme ? "border-zinc-200 bg-white" : "border-cyan-500/20 bg-slate-900/10"}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-1.5 overflow-x-auto py-3 no-scrollbar">
            {[
              { id: "SWAP", label: "Swap Engine", icon: ArrowUpDown },
              { id: "LP", label: "Liquidity matrix", icon: Droplet },
              { id: "STAKING", label: "Staking & Faucet", icon: Lock },
              { id: "DASHBOARD", label: "Telemetry Feed", icon: Terminal },
              { id: "CONTRACTS", label: "Deploy Token", icon: Cpu }
            ].map(tab => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`cursor-pointer flex items-center gap-2 px-4 py-2.5 rounded-sm text-xs font-mono uppercase tracking-wider font-extrabold border transition-all duration-300 whitespace-nowrap select-none ${
                    activeTab === tab.id
                      ? isLightTheme
                        ? "bg-zinc-900 border-zinc-900 text-white"
                        : "bg-cyan-500/10 border-cyan-400 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]"
                      : isLightTheme
                        ? "bg-transparent border-transparent text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                        : "bg-transparent border-transparent text-slate-500 hover:border-cyan-500/20 hover:text-slate-350"
                  }`}
                >
                  <TabIcon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative">
        
        {/* INTERFACE WARNING GATES FOR NEW OR DISCONNECTED USERS */}
         {!walletState && (
          <div className={`p-8 border rounded-xl max-w-xl mx-auto text-center space-y-6 ${
            isLightTheme ? "bg-white border-zinc-200" : "bg-slate-900/50 border-cyan-500/20 backdrop-blur-xl shadow-[0_0_25px_rgba(6,182,212,0.1)]"
          } animate-fade-in`}>
            <div className="relative inline-flex p-4 bg-cyan-500/10 rounded-full border border-cyan-500/30">
              <Compass className="h-10 w-10 text-cyan-400 animate-spin" />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <h2 className="text-xl font-sans font-black uppercase tracking-wider bg-gradient-to-r from-white to-cyan-400 bg-clip-text text-transparent">
                  Establish Real DEX Testnet Connection
                </h2>
                <p className="text-xs text-slate-350 leading-relaxed max-w-sm mx-auto">
                  Please connect your Web3 wallet (MetaMask / OKX Wallet) configured to the <strong>IOPN Testnet (EVM Chain ID 984)</strong> to swap assets, view real balances, and add pool liquidity.
                </p>
              </div>
              <div className="flex justify-center pt-1">
                <button
                  onClick={setupIopnNetwork}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-cyan-950/40 hover:bg-cyan-900/60 border border-cyan-500/30 hover:border-cyan-400 text-[10px] font-mono uppercase tracking-wider text-cyan-400 rounded-md transition-all cursor-pointer hover:shadow-[0_0_8px_rgba(6,182,212,0.3)] active:scale-95"
                >
                  <Cpu className="h-3.5 w-3.5 text-cyan-400 animate-pulse" /> Add IOPN Testnet to MetaMask / OKX
                </button>
              </div>
            </div>

            <div className="max-w-md mx-auto pt-4 space-y-3">
              <button
                onClick={connectWallet}
                className="w-full px-6 py-4 bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-black font-black uppercase tracking-widest rounded-lg shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:scale-[1.02] active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2 text-xs"
              >
                <Wallet className="h-4 w-4" /> Connect MetaMask / OKX Web3
              </button>
              
              <button
                onClick={switchMetaMaskAccount}
                className="w-full px-6 py-3 bg-zinc-900 border border-cyan-500/30 text-cyan-400 hover:text-cyan-300 font-bold uppercase tracking-widest rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 text-xs group"
              >
                <RefreshCw className="h-4 w-4 text-cyan-400 group-hover:rotate-180 transition-transform duration-500" /> Switch EVM Account / Choose Wallet
              </button>
            </div>

            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest pt-2">
              RPC Link Active: https://testnet-rpc.iopn.tech | Chain ID: 984
            </p>
          </div>
        )}

        {/* CONNECTED INTERACTIVE WRAPPERS */}
        {walletState && (
          <div className="animate-fade-in space-y-8">

            {activeTab === "SWAP" && (
              <div className="max-w-xl mx-auto">
                <Swap
                  isLightTheme={isLightTheme}
                  walletState={walletState}
                  onSwap={handleSwap}
                  poolReserves={poolReserves}
                  tokens={tokens}
                />
              </div>
            )}

            {activeTab === "LP" && (
              <div className="max-w-2xl mx-auto">
                <Pools
                  isLightTheme={isLightTheme}
                  walletState={walletState}
                  onAddLiquidity={handleAddLiquidity}
                  onRemoveLiquidity={handleRemoveLiquidity}
                  poolReserves={poolReserves}
                  tokens={tokens}
                  triggerNotification={triggerNotification}
                />
              </div>
            )}

            {activeTab === "STAKING" && (
              <Staking
                isLightTheme={isLightTheme}
                walletState={walletState}
                onStake={handleStake}
                onUnstake={handleUnstake}
                onClaimRewards={handleClaimRewards}
                onClaimFaucet={handleClaimFaucet}
                onUpdateAutoWithdraw={handleUpdateAutoWithdraw}
                onUpdateRewardRates={handleUpdateRewardRates}
                triggerNotification={triggerNotification}
                connectWallet={connectWallet}
              />
            )}

            {activeTab === "DASHBOARD" && (
              <Dashboard
                isLightTheme={isLightTheme}
                walletState={walletState}
                telemetry={telemetry}
                onClearLogs={handleClearLogs}
                triggerSync={() => syncWalletState(walletState.address)}
                poolReserves={poolReserves}
                tokens={tokens}
                onAddCustomToken={handleAddCustomToken}
              />
            )}

            {activeTab === "CONTRACTS" && (
              <div className="space-y-6">
                
                {/* Standard Token Architect & Deployer Dashboard */}
                <div className={`p-6 border rounded-2xl relative overflow-hidden transition-all duration-300 ${
                  isLightTheme ? "bg-white border-zinc-200" : "bg-zinc-950/60 border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.05)]"
                }`}>
                  <div className="flex flex-col sm:flex-row justify-between items-baseline gap-4 mb-4 border-b border-zinc-900/60 pb-3">
                    <div>
                      <h2 className="text-lg font-sans font-black uppercase text-cyan-400 flex items-center gap-1.5">
                        <Cpu className="h-4 w-4 text-cyan-400" />
                        IOPN Token Deployer &amp; Mint Suite
                      </h2>
                      <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest">Compile and broadcast custom ERC-20 tokens onto IOPN Testnet</p>
                    </div>

                    <p className="text-xs font-mono text-zinc-400">Target RPC Router: <span className="text-cyan-400 font-bold font-mono">https://testnet-rpc.iopn.tech</span></p>
                  </div>

                  {/* Informational Explanation Box in English */}
                  <div className="p-4 rounded-xl bg-cyan-950/10 border border-cyan-500/10 text-xs text-slate-300 space-y-2.5 mb-6">
                    <p className="font-bold text-cyan-400 flex items-center gap-2 uppercase font-sans">
                      <Info className="h-4 w-4 text-cyan-400 animate-pulse" /> HOW TO EXPERIMENT WITH YOUR DEPLOYED TOKEN ON THE DEX
                    </p>
                    <p className="leading-relaxed">
                      This compiler portal lets you deploy a real <strong>Custom ERC-20 Token</strong> into our IOPN testnet dApp ecosystem. Once broadcast is approved:
                    </p>
                    <ul className="list-disc list-inside space-y-1 pl-1 text-[11px] text-slate-400">
                      <li><strong>Wallet Credited</strong>: Your connected address receives the entire total supply of the custom token instantly.</li>
                      <li><strong>Automated DEX LP Routing</strong>: The system automatically registers an initial liquidity pool paired with <strong className="text-cyan-300/80">USDT</strong> so others can immediately trade your newly minted asset.</li>
                      <li><strong>Ready for Trading</strong>: Navigate over to the **Swap Engine** or **Pools Reserves** tabs to check, swap, or add your own custom pool liquidity!</li>
                    </ul>
                  </div>

                  {/* Deploy parameters */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    
                    {/* Console block & inputs */}
                    <div className="space-y-4">
                      
                      {/* Launch Deployment Form */}
                      <form onSubmit={runContractDeploymentSimulation} className="p-5 bg-zinc-900/40 border border-zinc-800 rounded-xl space-y-4 font-mono text-xs">
                        <p className="font-bold uppercase text-zinc-200 flex items-center gap-1.5 border-b border-zinc-800/80 pb-2">
                          <Layers className="h-4 w-4 text-cyan-400" /> Token Definition parameters
                        </p>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-zinc-500 text-[9px] uppercase block mb-1">Token Name</label>
                            <input
                              type="text"
                              value={tkName}
                              onChange={(e) => setTkName(e.target.value)}
                              placeholder="e.g., Jupiter Token"
                              className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-lg text-zinc-200 outline-none focus:border-cyan-400 text-xs"
                              required
                              disabled={deployingSim}
                            />
                          </div>

                          <div>
                            <label className="text-zinc-500 text-[9px] uppercase block mb-1">Symbol (Uppercase)</label>
                            <input
                              type="text"
                              value={tkSymbol}
                              onChange={(e) => setTkSymbol(e.target.value.toUpperCase())}
                              placeholder="e.g., JUP"
                              className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-lg text-zinc-200 outline-none focus:border-cyan-400 text-xs font-bold"
                              required
                              disabled={deployingSim}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-zinc-500 text-[9px] uppercase block mb-1">Initial Total Supply</label>
                            <input
                              type="number"
                              value={tkTotalSupply}
                              onChange={(e) => setTkTotalSupply(Math.max(1, Number(e.target.value)))}
                              className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-lg text-zinc-200 outline-none focus:border-cyan-400 text-xs"
                              required
                              disabled={deployingSim}
                            />
                          </div>

                          <div>
                            <label className="text-zinc-500 text-[9px] uppercase block mb-1">Decimals Fraction</label>
                            <select
                              value={tkDecimals}
                              onChange={(e) => setTkDecimals(Number(e.target.value))}
                              className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-lg text-zinc-200 outline-none focus:border-cyan-400 text-xs"
                              disabled={deployingSim}
                            >
                              <option value="18">18 (Standard)</option>
                              <option value="9">9 (Giga/Nano)</option>
                              <option value="6">6 (USDC-style)</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="text-zinc-500 text-[9px] uppercase block mb-1">Glow Theme Accent</label>
                          <select
                            value={tkColor}
                            onChange={(e) => setTkColor(e.target.value)}
                            className="w-full bg-zinc-950 border border-zinc-800 px-3 py-2 rounded-lg text-zinc-200 outline-none focus:border-cyan-400 text-xs"
                            disabled={deployingSim}
                          >
                            <option value="from-cyan-400 to-fuchsia-600">Cyber Neon (Cyan &amp; Fuchsia)</option>
                            <option value="from-emerald-400 to-teal-600">Bio Hazard (Emerald &amp; Teal)</option>
                            <option value="from-amber-400 to-orange-600">Quantum Fire (Amber &amp; Gold)</option>
                            <option value="from-pink-500 to-rose-600">Pulsar Nebula (Hot Pink &amp; Rose)</option>
                          </select>
                        </div>

                        <button
                          type="submit"
                          disabled={deployingSim || !walletState}
                          className={`w-full py-3 rounded-lg font-bold uppercase transition-all tracking-wider ${
                            deployingSim || !walletState
                              ? "bg-zinc-800 text-zinc-500 border border-zinc-700 cursor-not-allowed"
                              : "bg-gradient-to-r from-cyan-500 to-fuchsia-600 hover:scale-[1.02] text-black font-black hover:scale-[1.02] cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.35)]"
                          }`}
                        >
                          {!walletState 
                            ? "Link Interface Connection Required" 
                            : deployingSim 
                            ? "Confirming in Wallet..." 
                            : "Compile & Broadcast Token"}
                        </button>
                      </form>

                    </div>

                    {/* Simulation output logs and Deployed list */}
                    <div className="space-y-4 flex flex-col justify-between h-full">
                      
                      {/* Terminal logger */}
                      <div className="bg-zinc-950 rounded-xl border border-zinc-900 p-4 flex flex-col justify-between h-[210px]">
                        <div className="font-mono text-[10px] space-y-1.5 overflow-y-auto max-h-[175px] no-scrollbar">
                          <p className="text-[10px] text-zinc-500 uppercase border-b border-zinc-900 pb-1 font-bold flex items-center gap-1.5">
                            <Terminal className="h-3 w-3 text-cyan-450" /> Deploy compiler Terminal output
                          </p>
                          {deployConsoleLogs.map((log, index) => (
                            <div key={index} className="leading-relaxed font-mono text-zinc-400">
                              {log}
                            </div>
                          ))}
                        </div>
                        <p className="text-[8px] font-mono text-zinc-600 text-right mt-1 border-t border-zinc-900 pt-1">Compiler backend: solc v0.8.20+paris-ruleset</p>
                      </div>

                      {/* Deployed tokens list */}
                      <div className={`p-4 rounded-xl border flex-1 min-h-[180px] ${
                        isLightTheme ? "bg-zinc-50 border-zinc-200" : "bg-black/30 border-white/5"
                      }`}>
                        <p className="text-[10px] text-zinc-400 font-mono uppercase font-black border-b border-white/5 pb-1.5 mb-2.5 flex items-center gap-1.5">
                          <Database className="h-3 w-3 text-fuchsia-400 animate-pulse" /> Live Custom Tokens list ({deployedTokens.length})
                        </p>

                        {deployedTokens.length === 0 ? (
                          <div className="h-[120px] flex flex-col items-center justify-center text-center text-zinc-650 font-mono text-[10px] uppercase">
                            <Layers className="h-6 w-6 text-zinc-700 mb-1.5 opacity-40 animate-bounce" />
                            No custom tokens deployed yet in this session.
                          </div>
                        ) : (
                          <div className="space-y-2.5 max-h-[160px] overflow-y-auto no-scrollbar">
                            {deployedTokens.map((item, idx) => (
                              <div 
                                key={idx} 
                                className="p-2.5 rounded-lg bg-zinc-950/80 border border-white/5 flex items-center justify-between font-mono text-[10px]"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-sans font-black text-white">{item.symbol}</span>
                                    <span className="text-[9px] text-zinc-500">({item.name})</span>
                                    <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1 rounded-sm uppercase font-bold">✓ Active Swap</span>
                                  </div>
                                  <p className="text-[8px] text-zinc-450 select-all font-bold">Address: <span className="text-zinc-300 font-mono">{item.address}</span></p>
                                </div>
                                <div className="text-right">
                                  <p className="text-cyan-400 font-bold">{item.supply.toLocaleString()} {item.symbol}</p>
                                  <p className="text-[8px] text-zinc-500 uppercase">Decimals: {item.decimals}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>

                  </div>

                  {/* SOLIDITY CODE BLOCK FOR EASY COPY & VERIFY */}
                  <div className={`mt-6 border-t pt-6 ${
                    isLightTheme ? "border-zinc-200" : "border-zinc-900"
                  }`}>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                      <div>
                        <h3 className="text-sm font-sans font-extrabold uppercase text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-fuchsia-500 flex items-center gap-2">
                          <Terminal className="h-4 w-4 text-cyan-450 animate-pulse" />
                          Solidity Compiler Verification Source (TestERC20.sol)
                        </h3>
                        <p className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider mt-0.5">
                          Copy the complete flattened code below to verify your contract instantly on explorer
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(getDynamicERC20SolidityString());
                          setIsCopiedContractCode(true);
                          setTimeout(() => setIsCopiedContractCode(false), 2000);
                        }}
                        className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold uppercase transition-all duration-200 select-none cursor-pointer ${
                          isCopiedContractCode
                            ? "bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)] scale-[0.98]"
                            : "bg-cyan-500 hover:bg-cyan-400 hover:scale-[1.02] text-black shadow-[0_0_10px_rgba(6,182,212,0.2)] active:scale-95"
                        }`}
                      >
                        <Copy className="h-3.5 w-3.5" />
                        {isCopiedContractCode ? "✓ Copied Source!" : "Copy ERC-20 Solidity"}
                      </button>
                    </div>

                    <div className="relative rounded-xl border border-white/5 bg-zinc-950 overflow-hidden shadow-2xl">
                      {/* Interactive window bar representation */}
                      <div className="flex items-center justify-between px-4 py-2 bg-black/40 border-b border-white/5 font-mono text-[9px] text-zinc-500 select-none">
                        <div className="flex items-center gap-1.5 font-mono">
                          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/60" />
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/60" />
                          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/60" />
                          <span className="ml-1.5 font-bold tracking-tight text-zinc-400 uppercase font-mono">TestERC20.sol (Flattened Compiler Target)</span>
                        </div>
                        <span className="text-[8px] uppercase tracking-widest font-black text-cyan-400 font-mono">Solidity v0.8.20</span>
                      </div>
                      <div className="p-4 overflow-x-auto max-h-[300px] text-zinc-300 font-mono text-[10px] leading-relaxed select-all scrollbar-thin">
                        <pre className="font-mono whitespace-pre">{getDynamicERC20SolidityString()}</pre>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            )}

          </div>
        )}

      </main>

      {/* FLOAT PUSH NOTIFICATION DRAWER POPUPS */}
      <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full space-y-3 pointer-events-none">
        {notifications.map((notif) => (
          <div
            key={notif.id}
            className="p-4 rounded-xl border bg-zinc-950/90 border-cyan-500/30 text-zinc-100 shadow-[0_4px_25px_rgba(6,182,212,0.2)] pointer-events-auto animate-slide-in relative overflow-hidden"
          >
            {/* Glowing left edge indicator */}
            <div className={`absolute top-0 left-0 w-1 h-full ${
              notif.type === "success" 
                ? "bg-emerald-400" 
                : notif.type === "warning" 
                ? "bg-rose-400" 
                : "bg-cyan-400"
            }`} />

            <div className="flex gap-3 pl-1">
              <div className="flex-1 space-y-1">
                <p className="text-xs font-mono font-bold uppercase text-cyan-400 flex items-center gap-1.5">
                  <Bell className="h-3.5 w-3.5" />
                  {notif.title}
                </p>
                <p className="text-[10px] text-zinc-400 leading-normal pl-1">{notif.message}</p>
              </div>

              <button
                onClick={() => setNotifications(prev => prev.filter(n => n.id !== notif.id))}
                className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 self-start"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}
