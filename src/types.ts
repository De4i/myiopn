/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TokenSymbol = string;

export interface TokenDetails {
  symbol: TokenSymbol;
  name: string;
  address: string;
  decimals: number;
  color: string; // Tailwind glow classes
  iconName: string;
}

export const CONTRACTS = {
  DEX: "0x49336536b03B8bBafdAb01a8CADA65123a803770",
  USDC: "0xAe69efe47ad3b3AEE2Be0c3A6eeA2bA9bc4a9284",
  USDT: "0xd79Cf114127bE55bDD96b608662109B277DaBF8d",
  NBLAD: "0x0258FaE58d52f8AD4508beEF1c40342b2E0CeD32",
  DE4I: "0x605B6EDD6A38f1D66C32E2A1D5d91DC2e9F12e44",
  Masterchef: "0x49336536b03B8bBafdAb01a8CADA65123a803770",
  Faucet: "0x49336536b03B8bBafdAb01a8CADA65123a803770",
  Pair: "0x49336536b03B8bBafdAb01a8CADA65123a803770",
};

export const TOKENS: Record<TokenSymbol, TokenDetails> = {
  OPN: {
    symbol: "OPN",
    name: "IOPN Native Coin",
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18,
    color: "from-cyan-400 to-indigo-600 border-cyan-400 text-cyan-200",
    iconName: "TrendingUp",
  },
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    address: CONTRACTS.USDC,
    decimals: 18,
    color: "from-cyan-400 to-blue-500",
    iconName: "DollarSign",
  },
  USDT: {
    symbol: "USDT",
    name: "Tether USD",
    address: CONTRACTS.USDT,
    decimals: 18,
    color: "from-green-400 to-emerald-600",
    iconName: "ShieldAlert",
  },
  NBLAD: {
    symbol: "NBLAD",
    name: "Nebula Blade",
    address: CONTRACTS.NBLAD,
    decimals: 18,
    color: "from-purple-500 to-fuchsia-600 border-fuchsia-400 text-fuchsia-300",
    iconName: "Zap",
  },
  DE4I: {
    symbol: "DE4I",
    name: "Deity Quantum",
    address: CONTRACTS.DE4I,
    decimals: 18,
    color: "from-orange-500_to-yellow-400 border-amber-400 text-amber-200",
    iconName: "Cpu",
  },
};

export interface WalletState {
  address: string;
  balances: Record<TokenSymbol, number>;
  staking: {
    usdcStaked: number;
    usdtStaked: number;
    usdcLastStakedTime: number;
    usdtLastStakedTime: number;
    nbladRewardDebt: number;
    de4iRewardDebt: number;
    rateUsdcNblad?: number;
    rateUsdcDe4i?: number;
    rateUsdtNblad?: number;
    rateUsdtDe4i?: number;
  };
  faucetClaims: {
    USDC: number;
    USDT: number;
  };
  autoWithdrawThresholds: {
    NBLAD: number;
    DE4I: number;
    enabled: boolean;
  };
  logs: Array<{
    id: string;
    timestamp: number;
    type: string; // "SWAP" | "LP" | "STAKE" | "CLAIM" | "FAUCET" | "SYSTEM" | "AUTO_WITHDRAW"
    detail: string;
    txHash: string;
  }>;
}

export interface LPState {
  pair: [TokenSymbol, TokenSymbol];
  reserveA: number;
  reserveB: number;
  userShares: number;
  totalShares: number;
}

export interface NotificationItem {
  id: string;
  type: "success" | "info" | "warning" | "alert";
  title: string;
  message: string;
  timestamp: number;
}

export interface MarketTelemetry {
  blockHeight: number;
  activeNodes: number;
  ammGigaHashRate: string;
  slippageStandard: number;
  gasGwei: number;
  gasPriceUsd: number;
  faucetLimit: number;
  cooldownMs: number;
  deployedAddresses?: {
    DEX: string;
    USDC: string;
    USDT: string;
    NBLAD: string;
    DE4I: string;
    Masterchef: string;
    Faucet: string;
    Pair: string;
    deployedTimestamp: number;
    deployedBy: string;
    txHash: string;
  } | null;
}

export function formatAmount(val: number | undefined | null, maxDecimals: number = 4): string {
  if (val === undefined || val === null || isNaN(val)) return "0";
  // Clean up floating point precision issues by rounding to maxDecimals
  const factor = Math.pow(10, maxDecimals);
  const rounded = Math.round(val * factor) / factor;
  
  if (rounded % 1 === 0) {
    return rounded.toLocaleString(undefined, { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 0 
    });
  }
  return rounded.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals
  });
}

export function toSafeDecimalString(amount: number | string | undefined | null, decimals: number): string {
  if (amount === undefined || amount === null || isNaN(Number(amount))) return "0";
  
  let amtStr = typeof amount === "number" ? amount.toFixed(Math.min(20, decimals + 4)) : amount.trim();
  
  if (amtStr.includes("e") || amtStr.includes("E")) {
    try {
      const numValue = typeof amount === "number" ? amount : parseFloat(amount);
      amtStr = numValue.toFixed(decimals);
    } catch (e) {
      // ignore
    }
  }
  
  const parts = amtStr.split(".");
  if (parts.length === 2) {
    const integerPart = parts[0];
    const fractionalPart = parts[1].substring(0, decimals);
    const sanitizedFraction = fractionalPart || "0";
    return `${integerPart}.${sanitizedFraction}`;
  }
  return parts[0];
}

