import React, { useState, useEffect } from "react";
import { 
  Lock, 
  Coins, 
  Gift, 
  Droplet, 
  LineChart, 
  Gauge, 
  Clock, 
  Sliders, 
  CheckCircle,
  TrendingUp,
  Cpu,
  Info
} from "lucide-react";
import { WalletState, TokenSymbol, formatAmount } from "../types";

interface StakingProps {
  isLightTheme: boolean;
  walletState: WalletState | null;
  onStake: (token: "USDC" | "USDT", amount: number) => void;
  onUnstake: (token: "USDC" | "USDT", amount: number) => void;
  onClaimRewards: () => void;
  onClaimFaucet: (token: "USDC" | "USDT") => void;
  onUpdateAutoWithdraw: (nbladLimit: number, de4iLimit: number, enabled: boolean) => void;
  onUpdateRewardRates?: (usdcNblad: number, usdcDe4i: number, usdtNblad: number, usdtDe4i: number) => Promise<void>;
  triggerNotification: (title: string, desc: string, type: "success" | "info" | "warning") => void;
  connectWallet?: () => void;
}

export default function Staking({
  isLightTheme,
  walletState,
  onStake,
  onUnstake,
  onClaimRewards,
  onClaimFaucet,
  onUpdateAutoWithdraw,
  onUpdateRewardRates,
  triggerNotification,
  connectWallet,
}: StakingProps) {
  // Tabs: "STAKE" | "UNSTAKE" | "CONFIG"
  const [activeTab, setActiveTab] = useState<"STAKE" | "UNSTAKE" | "CONFIG">("STAKE");
  const [selectedToken, setSelectedToken] = useState<"USDC" | "USDT">("USDC");
  const [amount, setAmount] = useState<string>("");

  // MasterChef admin state variables
  const [usdcNbladRate, setUsdcNbladRate] = useState<string>("5");
  const [usdcDe4iRate, setUsdcDe4iRate] = useState<string>("2");
  const [usdtNbladRate, setUsdtNbladRate] = useState<string>("4");
  const [usdtDe4iRate, setUsdtDe4iRate] = useState<string>("3");

  useEffect(() => {
    if (walletState?.staking) {
      if (walletState.staking.rateUsdcNblad !== undefined) setUsdcNbladRate(walletState.staking.rateUsdcNblad.toString());
      if (walletState.staking.rateUsdcDe4i !== undefined) setUsdcDe4iRate(walletState.staking.rateUsdcDe4i.toString());
      if (walletState.staking.rateUsdtNblad !== undefined) setUsdtNbladRate(walletState.staking.rateUsdtNblad.toString());
      if (walletState.staking.rateUsdtDe4i !== undefined) setUsdtDe4iRate(walletState.staking.rateUsdtDe4i.toString());
    }
  }, [walletState?.staking]);

  // Faucet timers (24 hour countdown per token)
  const [usdcFaucetTime, setUsdcFaucetTime] = useState<number>(0);
  const [usdtFaucetTime, setUsdtFaucetTime] = useState<number>(0);

  // Auto-withdraw thresholds
  const [nbladThreshold, setNbladThreshold] = useState<string>("500");
  const [de4iThreshold, setDe4iThreshold] = useState<string>("200");
  const [autoWithdrawEnabled, setAutoWithdrawEnabled] = useState<boolean>(true);

  // Staking reward calculations (Simulate continuous real-time ticking in frontend UI)
  const [realtimeNblad, setRealtimeNblad] = useState<number>(0);
  const [realtimeDe4i, setRealtimeDe4i] = useState<number>(0);

  // Daily estimated gains calculation:
  // Rates per 1000 tokens staked (per hour):
  // USDC -> 5 NBLAD / 2 DE4I
  // USDT -> 4 NBLAD / 3 DE4I
  const getDailyEst = () => {
    if (!walletState) return { nblad: 0, de4i: 0 };
    const usdcStaked = walletState.staking.usdcStaked;
    const usdtStaked = walletState.staking.usdtStaked;

    const rateUsdcN = walletState.staking.rateUsdcNblad ?? 5;
    const rateUsdcD = walletState.staking.rateUsdcDe4i ?? 2;
    const rateUsdtN = walletState.staking.rateUsdtNblad ?? 4;
    const rateUsdtD = walletState.staking.rateUsdtDe4i ?? 3;

    // Daily = (hourly_rate * 24 * amount) / 1000
    const usdcNblad = (usdcStaked * rateUsdcN * 24) / 1000;
    const usdcDe4i = (usdcStaked * rateUsdcD * 24) / 1000;

    const usdtNblad = (usdtStaked * rateUsdtN * 24) / 1000;
    const usdtDe4i = (usdtStaked * rateUsdtD * 24) / 1000;

    return {
      nblad: usdcNblad + usdtNblad,
      de4i: usdcDe4i + usdtDe4i
    };
  };

  const dailyEsts = getDailyEst();

  // Tick real-time rewards in the UI to give an immersive cyberpunk experience
  useEffect(() => {
    if (!walletState) {
      setRealtimeNblad(0);
      setRealtimeDe4i(0);
      return;
    }

    const interval = setInterval(() => {
      // Rates per second per token: Loaded from dynamic on-chain state
      const rateUsdcN = walletState.staking.rateUsdcNblad ?? 5;
      const rateUsdcD = walletState.staking.rateUsdcDe4i ?? 2;
      const rateUsdtN = walletState.staking.rateUsdtNblad ?? 4;
      const rateUsdtD = walletState.staking.rateUsdtDe4i ?? 3;

      const usdcNbladPerSec = (rateUsdcN / (3600 * 1000)) * walletState.staking.usdcStaked;
      const usdcDe4iPerSec = (rateUsdcD / (3600 * 1000)) * walletState.staking.usdcStaked;

      const usdtNbladPerSec = (rateUsdtN / (3600 * 1000)) * walletState.staking.usdtStaked;
      const usdtDe4iPerSec = (rateUsdtD / (3600 * 1000)) * walletState.staking.usdtStaked;

      // Base reward debt
      let currentNblad = walletState.staking.nbladRewardDebt;
      let currentDe4i = walletState.staking.de4iRewardDebt;

      // Add proportional accrued time elapsed since last stake
      const now = Date.now() / 1000;
      if (walletState.staking.usdcStaked > 0 && walletState.staking.usdcLastStakedTime > 0) {
        const diffUsdc = Math.max(0, now - walletState.staking.usdcLastStakedTime);
        currentNblad += usdcNbladPerSec * diffUsdc; // correct scaling
        currentDe4i += usdcDe4iPerSec * diffUsdc;
      }
      if (walletState.staking.usdtStaked > 0 && walletState.staking.usdtLastStakedTime > 0) {
        const diffUsdt = Math.max(0, now - walletState.staking.usdtLastStakedTime);
        currentNblad += usdtNbladPerSec * diffUsdt;
        currentDe4i += usdtDe4iPerSec * diffUsdt;
      }

      setRealtimeNblad(currentNblad);
      setRealtimeDe4i(currentDe4i);
      
      // Check AutoWithdraw thresholds dynamically for real-time convenience
      if (walletState.autoWithdrawThresholds.enabled) {
        const nLimit = walletState.autoWithdrawThresholds.NBLAD;
        const dLimit = walletState.autoWithdrawThresholds.DE4I;
        
        if (nLimit > 0 && currentNblad >= nLimit) {
          triggerNotification(
            "Auto Withdraw Triggered",
            `NBLAD rewards surpassed automatic threshold: ${nLimit} NBLAD. Dispatched tokens of quantity: ${formatAmount(currentNblad, 2)} to wallet!`,
            "success"
          );
          onClaimRewards();
        }
        else if (dLimit > 0 && currentDe4i >= dLimit) {
          triggerNotification(
            "Auto Withdraw Triggered",
            `DE4I rewards surpassed automatic threshold: ${dLimit} DE4I. Dispatched tokens of quantity: ${formatAmount(currentDe4i, 2)} to wallet!`,
            "success"
          );
          onClaimRewards();
        }
      }

    }, 1000);

    return () => clearInterval(interval);
  }, [walletState, onClaimRewards, triggerNotification]);

  // Faucet claim lock timer countdown tracking
  useEffect(() => {
    if (!walletState) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const usdcLeft = Math.max(0, (walletState.faucetClaims.USDC + 86400000) - now);
      const usdtLeft = Math.max(0, (walletState.faucetClaims.USDT + 86400000) - now);
      setUsdcFaucetTime(usdcLeft);
      setUsdtFaucetTime(usdtLeft);
    }, 1000);
    return () => clearInterval(interval);
  }, [walletState]);

  const handleActionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amount);
    if (isNaN(val) || val <= 0) return;

    if (activeTab === "STAKE") {
      if (walletState && val > walletState.balances[selectedToken]) {
        triggerNotification(
          "Insufficient Balance",
          `You have insufficient funds of ${selectedToken} (required: ${val}) to proceed with staking lockup. Re-claim via the Faucet!`,
          "warning"
        );
        return;
      }
      onStake(selectedToken, val);
    } else {
      const staked = selectedToken === "USDC" ? walletState?.staking.usdcStaked : walletState?.staking.usdtStaked;
      if (walletState && val > (staked || 0)) {
        triggerNotification(
          "Staking Limit Transgressed",
          `Cannot unstake more than currently locked. Max claimable amount: ${formatAmount(staked || 0, 4)} ${selectedToken}.`,
          "warning"
        );
        return;
      }
      onUnstake(selectedToken, val);
    }
    setAmount("");
  };

  const formattedTimeRemaining = (ms: number) => {
    if (ms <= 0) return "Ready";
    const hrs = Math.floor(ms / 3600000);
    const mins = Math.floor((ms % 3600000) / 60000);
    const secs = Math.floor((ms % 60000) / 1000);
    return `${hrs.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleUpdateConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const nLimit = parseFloat(nbladThreshold);
    const dLimit = parseFloat(de4iThreshold);
    onUpdateAutoWithdraw(nLimit, dLimit, autoWithdrawEnabled);
  };

  const handleUpdateMasterChef = (e: React.FormEvent) => {
    e.preventDefault();
    const uN = parseInt(usdcNbladRate);
    const uD = parseInt(usdcDe4iRate);
    const tN = parseInt(usdtNbladRate);
    const tD = parseInt(usdtDe4iRate);

    if (isNaN(uN) || isNaN(uD) || isNaN(tN) || isNaN(tD)) {
      triggerNotification("Selection Error", "All specified MasterChef rewards rates must be premium integers.", "warning");
      return;
    }

    if (onUpdateRewardRates) {
      onUpdateRewardRates(uN, uD, tN, tD);
    }
  };

  const activeStaked = selectedToken === "USDC" ? walletState?.staking.usdcStaked : walletState?.staking.usdtStaked;
  const userBalance = walletState?.balances[selectedToken] || 0;

  return (
    <div className="space-y-6">
      
      {/* 24-HOUR CYBER FAUCET MODULE */}
      <div className={`p-6 border rounded-xl relative overflow-hidden transition-all duration-300 ${
        isLightTheme 
          ? "bg-white border-zinc-200" 
          : "bg-slate-900/50 border-fuchsia-500/20 shadow-[0_0_20px_rgba(217,70,239,0.05)] backdrop-blur-xl"
      }`}>
        {/* Faucet matrix scanlines */}
        <div className="absolute top-0 right-0 p-1 text-[8px] font-mono text-slate-500 tracking-wider">SECURE_FAUCET_NODE_v3</div>
        
        <div className="flex flex-col sm:flex-row items-baseline justify-between mb-4">
          <div>
            <h3 className={`text-sm font-sans font-black uppercase flex items-center gap-1.5 animate-pulse ${
              isLightTheme ? "text-fuchsia-750" : "text-fuchsia-400"
            }`}>
              <Droplet className="h-4 w-4" />
              Gas Faucet Refueling
            </h3>
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Reclaim 1,000 USDC / USDT every 24 hours</p>
          </div>
          <p className="text-xs font-mono text-slate-400">Claims Limit: <span className={`${isLightTheme ? "text-fuchsia-700" : "text-fuchsia-400"} font-bold`}>1k token / Claim</span></p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          
          {/* Claim USDC Faucet */}
          <div className={`p-4 rounded-lg flex items-center justify-between border ${
            isLightTheme ? "bg-zinc-50 border-zinc-200" : "bg-black/40 border border-white/5"
          }`}>
            <div>
              <p className={`font-mono font-extrabold text-xs flex items-center gap-1 ${
                isLightTheme ? "text-zinc-900" : "text-zinc-200"
              }`}><Coins className={`h-3.5 w-3.5 ${isLightTheme ? "text-cyan-700" : "text-cyan-400"}`} /> USDC Faucet</p>
              <p className="text-[10px] font-mono mt-0.5 text-slate-500 uppercase flex items-center gap-1"><Clock className="h-3 w-3" /> Cooldown: {usdcFaucetTime > 0 ? formattedTimeRemaining(usdcFaucetTime) : "INACTIVE"}</p>
            </div>
            <button
              onClick={() => onClaimFaucet("USDC")}
              disabled={!walletState || usdcFaucetTime > 0}
              className={`px-5 py-2 rounded-sm font-sans text-xs font-black uppercase transition-all tracking-wide cursor-pointer ${
                !walletState || usdcFaucetTime > 0
                  ? isLightTheme
                    ? "bg-zinc-200 text-zinc-400 border border-zinc-300 cursor-not-allowed"
                    : "bg-slate-850 text-slate-655 border border-white/5 cursor-not-allowed"
                  : "bg-cyan-500 text-black hover:scale-[1.02] shadow-[0_0_15px_rgba(6,182,212,0.25)]"
              }`}
            >
              {usdcFaucetTime > 0 ? "Locked" : "Faucet 1k"}
            </button>
          </div>

          {/* Claim USDT Faucet */}
          <div className={`p-4 rounded-lg flex items-center justify-between border ${
            isLightTheme ? "bg-zinc-50 border-zinc-200" : "bg-black/40 border border-white/5"
          }`}>
            <div>
              <p className={`font-mono font-extrabold text-xs flex items-center gap-1 ${
                isLightTheme ? "text-zinc-900" : "text-zinc-200"
              }`}><Coins className={`h-3.5 w-3.5 ${isLightTheme ? "text-fuchsia-700" : "text-fuchsia-400"}`} /> USDT Faucet</p>
              <p className="text-[10px] font-mono mt-0.5 text-slate-500 uppercase flex items-center gap-1"><Clock className="h-3 w-3" /> Cooldown: {usdtFaucetTime > 0 ? formattedTimeRemaining(usdtFaucetTime) : "INACTIVE"}</p>
            </div>
            <button
              onClick={() => onClaimFaucet("USDT")}
              disabled={!walletState || usdtFaucetTime > 0}
              className={`px-5 py-2 rounded-sm font-sans text-xs font-black uppercase transition-all tracking-wide cursor-pointer ${
                !walletState || usdtFaucetTime > 0
                  ? isLightTheme
                    ? "bg-zinc-200 text-zinc-400 border border-zinc-300 cursor-not-allowed"
                    : "bg-slate-850 text-slate-655 border border-white/5 cursor-not-allowed"
                  : "bg-fuchsia-500 text-black hover:scale-[1.02] shadow-[0_0_15px_rgba(217,70,239,0.25)]"
              }`}
            >
              {usdtFaucetTime > 0 ? "Locked" : "Faucet 1k"}
            </button>
          </div>

        </div>

        <div className={`mt-4 p-3.5 border rounded-lg flex flex-col md:flex-row items-center justify-between gap-3 ${
          isLightTheme ? "bg-cyan-50 border-cyan-200" : "bg-cyan-950/25 border border-cyan-500/20"
        }`}>
          <div className="flex items-start sm:items-center gap-2.5">
            <span className="relative flex h-2 w-2 mt-1 sm:mt-0 shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                isLightTheme ? "bg-cyan-500" : "bg-cyan-400"
              }`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${
                isLightTheme ? "bg-cyan-600" : "bg-cyan-500"
              }`}></span>
            </span>
            <p className={`text-[10.5px] font-mono leading-relaxed ${
              isLightTheme ? "text-slate-800" : "text-slate-350"
            }`}>
              <span className={`${isLightTheme ? "text-cyan-800" : "text-cyan-400"} font-bold`}>FAUCET STATUS NOTIFICATION:</span> If claims fail with "Exceeds Balance", the on-chain faucet wallet needs replenishment. Send test assets (OPN gas, USDC, USDT) here: <strong className={`hover:underline select-all ${isLightTheme ? "text-cyan-800" : "text-white"}`}>0x5EA060321bC75C5e82B60Ff6E3F5482Fc6F04213</strong>
            </p>
          </div>
          <button
            onClick={() => {
              try {
                navigator.clipboard.writeText("0x5EA060321bC75C5e82B60Ff6E3F5482Fc6F04213");
                triggerNotification("Address Copied", "Faucet faucet-signer address copied to clipboard!", "success");
              } catch (_) {
                triggerNotification("EVM Address", "Faucet address: 0x5EA060321bC75C5e82B60Ff6E3F5482Fc6F04213", "info");
              }
            }}
            className="px-3 py-1.5 bg-zinc-950 hover:bg-zinc-900 border border-cyan-500/40 hover:border-cyan-400/80 text-cyan-400 hover:text-cyan-300 rounded text-[9px] font-mono uppercase tracking-wider font-extrabold transition-all cursor-pointer whitespace-nowrap active:translate-y-0.5"
          >
            📋 Copy Pool Wallet
          </button>
        </div>

      </div>

      {/* CORE STAKING ACTION HUB & MONITORING */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Real-time Staking Stats Column */}
        <div className={`p-6 border rounded-xl lg:col-span-2 relative transition-all duration-300 ${
          isLightTheme 
            ? "bg-white border-zinc-200" 
            : "bg-slate-900/50 border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.05)] backdrop-blur-xl"
        }`}>
          {/* Neon highlight background */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-amber-500 opacity-60"></div>
          <div className="flex justify-between items-baseline mb-6 pt-2">
            <div>
              <h3 className={`text-base font-sans font-black uppercase flex items-center gap-1.5 animate-pulse ${
                isLightTheme ? "text-cyan-750" : "text-cyan-400"
              }`}>
                <Gauge className="h-4 w-4" />
                Yield Harvester Staking
              </h3>
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Locks USDC or USDT for dual high reward yields</p>
            </div>
            <div className={`px-2.5 py-1 rounded text-[9px] font-mono font-bold uppercase ${
              isLightTheme ? "bg-cyan-100 border border-cyan-300 text-cyan-800" : "bg-cyan-505/20 border border-cyan-500/30 text-cyan-300"
            }`}>
              STAKING_LIVE MULTIPLIER
            </div>
          </div>

          {/* Locked Assets Visual Card */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            
            <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[90px] ${
              isLightTheme ? "bg-zinc-50 border-zinc-200" : "bg-black/40 border border-cyan-500/10"
            }`}>
              <div>
                <p className="text-[10px] font-mono text-slate-500 uppercase font-bold">Total USDC Locked</p>
                <div className={`text-2xl font-black font-sans tracking-tight mt-1 ${
                  isLightTheme ? "text-cyan-700" : "text-cyan-400"
                }`}>
                  {walletState ? formatAmount(walletState.staking.usdcStaked, 4) : "0"}{" "}
                  <span className="text-[11px] font-mono font-bold text-slate-500">USDC</span>
                </div>
              </div>
              <p className={`text-[9px] font-mono mt-2 flex items-center gap-1 font-bold ${
                isLightTheme ? "text-cyan-800" : "text-cyan-400"
              }`}>
                <TrendingUp className="h-3 w-3 animate-pulse" /> Yields NBLAD @ 5x & DE4I @ 2x hourly rate
              </p>
            </div>

            <div className={`p-4 rounded-xl border flex flex-col justify-between min-h-[90px] ${
              isLightTheme ? "bg-zinc-50 border-zinc-200" : "bg-black/40 border border-fuchsia-500/10"
            }`}>
              <div>
                <p className="text-[10px] font-mono text-slate-500 uppercase font-bold">Total USDT Locked</p>
                <div className={`text-2xl font-black font-sans tracking-tight mt-1 ${
                  isLightTheme ? "text-fuchsia-750" : "text-fuchsia-400"
                }`}>
                  {walletState ? formatAmount(walletState.staking.usdtStaked, 4) : "0"}{" "}
                  <span className="text-[11px] font-mono font-bold text-slate-500">USDT</span>
                </div>
              </div>
              <p className={`text-[9px] font-mono mt-2 flex items-center gap-1 font-bold ${
                isLightTheme ? "text-fuchsia-850" : "text-fuchsia-400"
              }`}>
                <TrendingUp className="h-3 w-3 animate-pulse" /> Yields NBLAD @ 4x & DE4I @ 3x hourly rate
              </p>
            </div>

          </div>

          {/* REAL-TIME REWARDS EARNED DASHBOARD */}
          <div className={`p-4 rounded-lg space-y-4 border ${
            isLightTheme ? "bg-zinc-50 border-zinc-200 text-zinc-900" : "bg-black/40 border border-white/5"
          }`}>
            <div className={`flex justify-between items-baseline border-b pb-2.5 ${
              isLightTheme ? "border-zinc-200" : "border-cyan-500/10"
            }`}>
              <span className={`text-xs font-sans font-black uppercase flex items-center gap-1.5 ${
                isLightTheme ? "text-zinc-900" : "text-zinc-300"
              }`}><Gift className={`h-4 w-4 ${isLightTheme ? "text-cyan-700" : "text-cyan-400"}`} /> Yield Earnings Real-time ledger</span>
              <span className="text-[9px] font-mono text-slate-500 uppercase flex items-center gap-1"><Cpu className="h-3.5 w-3.5 text-cyan-400 animate-pulse" /> Ticking Active matrix 1s</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[9px] font-mono text-slate-500 uppercase font-extrabold tracking-wider">Accumulated NBLAD Reward</p>
                <p className={`text-2xl font-mono font-black tracking-wider ${
                  isLightTheme ? "text-fuchsia-800" : "text-fuchsia-400"
                }`}>
                  {formatAmount(realtimeNblad, 6)}
                </p>
              </div>
              <div>
                <p className="text-[9px] font-mono text-slate-500 uppercase font-extrabold tracking-wider">Accumulated DE4I Reward</p>
                <p className={`text-2xl font-mono font-black tracking-wider ${
                  isLightTheme ? "text-cyan-805" : "text-cyan-400"
                }`}>
                  {formatAmount(realtimeDe4i, 6)}
                </p>
              </div>
            </div>

            {/* Daily projections */}
            <div className={`flex gap-4 text-[10px] font-mono border rounded p-2 ${
              isLightTheme 
                ? "bg-zinc-150/80 border-zinc-200 text-slate-800 font-semibold" 
                : "bg-black/20 border border-white/5 text-slate-400"
            }`}>
              <span>Projection: <strong className={isLightTheme ? "text-fuchsia-800" : "text-fuchsia-400"}>+{formatAmount(dailyEsts.nblad, 2)} NBLAD / day</strong></span>
              <span> &amp; <strong className={isLightTheme ? "text-cyan-805" : "text-cyan-400"}>+{formatAmount(dailyEsts.de4i, 2)} DE4I / day</strong></span>
            </div>

            <button
              onClick={onClaimRewards}
              disabled={!walletState || (realtimeNblad <= 0 && realtimeDe4i <= 0)}
              className={`w-full py-4 rounded-sm font-sans font-black text-xs uppercase tracking-widest transition-all duration-300 cursor-pointer ${
                !walletState || (realtimeNblad <= 0 && realtimeDe4i <= 0)
                  ? isLightTheme
                    ? "bg-zinc-200 text-zinc-400 border border-zinc-300 cursor-not-allowed"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5"
                  : "bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-black font-black hover:scale-[1.02] shadow-[0_0_20px_rgba(6,182,212,0.3)] active:translate-y-0.5"
              }`}
            >
              Claim Accrued Rewards Node
            </button>
          </div>
        </div>

        {/* Stake lock interaction + config thresholds Column */}
        <div className={`p-6 border rounded-xl relative transition-all duration-300 flex flex-col justify-between ${
          isLightTheme 
            ? "bg-white border-zinc-200" 
            : "bg-slate-900/50 border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.05)] backdrop-blur-xl"
        }`}>
          <div>
            {/* Staking interaction tabs */}
            <div className={`flex p-1 rounded-sm mb-4 ${
              isLightTheme ? "bg-zinc-150 border border-zinc-200" : "bg-black/40 border border-white/5"
            }`}>
              {["STAKE", "UNSTAKE", "CONFIG"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as "STAKE" | "UNSTAKE" | "CONFIG")}
                  className={`cursor-pointer w-full text-center py-2 rounded-sm text-[9px] font-mono font-black uppercase transition-all tracking-wider ${
                    activeTab === tab
                      ? isLightTheme
                        ? "bg-cyan-200 text-cyan-800 border border-cyan-300 font-extrabold"
                        : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-extrabold"
                      : isLightTheme
                        ? "text-zinc-500 hover:text-zinc-800"
                        : "text-slate-500 hover:text-slate-355"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {activeTab !== "CONFIG" && (
              // Staking / Unstaking forms
              <form onSubmit={handleActionSubmit} className="space-y-4">
                
                {/* Token selectors */}
                <div className="space-y-1.5">
                  <label className="text-[9px] font-mono uppercase text-slate-500 block">Staking Asset Node</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedToken("USDC")}
                      className={`py-2.5 rounded border font-mono text-xs font-bold transition-all cursor-pointer ${
                        selectedToken === "USDC"
                          ? isLightTheme
                            ? "border-cyan-600 text-cyan-805 bg-cyan-100/50 font-bold animate-pulse"
                            : "border-cyan-400 text-cyan-400 bg-cyan-950/10"
                          : isLightTheme
                            ? "border-zinc-300 text-zinc-550 hover:border-zinc-400"
                            : "border-white/5 text-slate-400 hover:border-zinc-700"
                      }`}
                    >
                      USDC Token
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedToken("USDT")}
                      className={`py-2.5 rounded border font-mono text-xs font-bold transition-all cursor-pointer ${
                        selectedToken === "USDT"
                          ? isLightTheme
                            ? "border-fuchsia-600 text-fuchsia-805 bg-fuchsia-100/50 font-bold animate-pulse"
                            : "border-fuchsia-500 text-fuchsia-400 bg-fuchsia-950/10"
                          : isLightTheme
                            ? "border-zinc-300 text-zinc-550 hover:border-zinc-400"
                            : "border-white/5 text-slate-400 hover:border-zinc-700"
                      }`}
                    >
                      USDT Token
                    </button>
                  </div>
                </div>

                {/* Amount lock-in */}
                <div className={`p-3.5 rounded-lg border ${
                  isLightTheme ? "bg-zinc-50 border-zinc-200" : "bg-black/40 border border-white/5"
                }`}>
                  <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 mb-1">
                    <span>
                      {activeTab === "STAKE" ? "Max lockable:" : "Lock active limit:"}
                    </span>
                    <span 
                      onClick={() => {
                        const maxVal = activeTab === "STAKE" ? userBalance : (activeStaked || 0);
                        setAmount(maxVal.toString());
                      }}
                      className={`cursor-pointer hover:font-bold underline text-[9px] ${
                        isLightTheme ? "text-cyan-705" : "text-cyan-400"
                      }`}
                    >
                      {activeTab === "STAKE"
                        ? `${formatAmount(userBalance, 4)}`
                        : `${formatAmount(activeStaked || 0, 4)}`
                      } (Max)
                    </span>
                  </div>

                  <input
                    type="number"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className={`w-full bg-transparent border-none text-xl outline-none font-bold font-mono py-1 p-0 ${
                      isLightTheme ? "text-zinc-900" : "text-slate-100"
                    }`}
                    style={{ caretColor: "#38bdf8" }}
                    required
                  />
                </div>

                {walletState ? (
                  <button
                    type="submit"
                    className="w-full py-4 rounded-sm font-sans font-black text-xs uppercase text-black bg-gradient-to-r from-cyan-500 to-fuchsia-600 tracking-widest hover:scale-[1.02] shadow-[0_0_20px_rgba(6,182,212,0.3)] active:translate-y-0.5 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {activeTab === "STAKE" ? <Coins className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    {activeTab === "STAKE" ? "Stake" : "Unstake Unlock Reclaim"}
                  </button>
                ) : (
                  <div className={`p-3 text-center font-mono text-[10px] rounded-lg border ${
                    isLightTheme ? "border-zinc-200 bg-zinc-100 text-zinc-500" : "border-zinc-850 bg-black/40 text-slate-500"
                  }`}>
                    Link wallet connection to unlock vaults.
                  </div>
                )}

              </form>
            )}

            {activeTab === "CONFIG" && (
              <form onSubmit={handleUpdateConfig} className="space-y-4 font-mono">
                <div className={`flex items-center justify-between border-b pb-2.5 ${
                  isLightTheme ? "border-zinc-200" : "border-cyan-500/10"
                }`}>
                  <span className={`text-[10px] font-mono uppercase font-black ${
                    isLightTheme ? "text-cyan-805" : "text-cyan-400"
                  }`}>Setup Auto-Withdraw Thresholds</span>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="auto-thresh"
                      checked={autoWithdrawEnabled}
                      onChange={(e) => setAutoWithdrawEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <label 
                      htmlFor="auto-thresh"
                      className="relative w-8 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-cyan-500 peer-checked:after:bg-white cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-3 font-mono text-xs">
                  <div>
                    <label className="text-slate-500 text-[9px] uppercase block mb-1">NBLAD Auto-Claim Threshold (Qty)</label>
                    <input
                      type="number"
                      value={nbladThreshold}
                      onChange={(e) => setNbladThreshold(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg font-bold outline-none font-mono text-xs border ${
                        isLightTheme 
                          ? "bg-white border-zinc-300 text-zinc-900 focus:border-cyan-500" 
                          : "bg-black/40 border border-white/5 text-slate-205"
                      }`}
                      placeholder="500 NT"
                    />
                    <p className="text-[9px] text-zinc-500 mt-1">Mengirim penarikan otomatis ke wallet setelah melewati nominal ini.</p>
                  </div>

                  <div>
                    <label className="text-slate-500 text-[9px] uppercase block mb-1">DE4I Auto-Claim Threshold (Qty)</label>
                    <input
                      type="number"
                      value={de4iThreshold}
                      onChange={(e) => setDe4iThreshold(e.target.value)}
                      className={`w-full px-3 py-2 rounded-lg font-bold outline-none font-mono text-xs border ${
                        isLightTheme 
                          ? "bg-white border-zinc-300 text-zinc-900 focus:border-cyan-500" 
                          : "bg-black/40 border border-white/5 text-slate-205"
                      }`}
                      placeholder="200 DT"
                    />
                    <p className="text-[9px] text-zinc-500 mt-1">Mengirim penarikan otomatis ke wallet setelah melewati nominal ini.</p>
                  </div>
                </div>

                <button
                  type="submit"
                  className={`w-full py-3 rounded-sm font-sans text-xs font-black uppercase transition-all tracking-widest flex items-center justify-center gap-1.5 cursor-pointer border ${
                    isLightTheme
                      ? "border-cyan-500 bg-cyan-100 hover:bg-cyan-200 text-cyan-800"
                      : "border-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400"
                  }`}
                >
                  <Sliders className="h-3.5 w-3.5" /> Save Auto Router Set
                </button>
              </form>
            )}
          </div>

          <div className="text-[9px] font-mono text-slate-505 justify-end border-t border-cyan-505/10 pt-3 mt-4 leading-relaxed font-bold">
            * Yield formulas: rate multiplier based on total second-level timestamps. Automated smart contracts audit locked.
          </div>
        </div>

      </div>

    </div>
  );
}
