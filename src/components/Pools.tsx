import React, { useState } from "react";
import { 
  Droplet, 
  Plus, 
  Minus, 
  TrendingUp, 
  HelpCircle,
  Database
} from "lucide-react";
import { TokenSymbol, WalletState, CONTRACTS, formatAmount } from "../types";

interface PoolsProps {
  isLightTheme: boolean;
  walletState: WalletState | null;
  onAddLiquidity: (tokenA: TokenSymbol, tokenB: TokenSymbol, amountA: number, amountB: number) => void;
  onRemoveLiquidity: (tokenA: TokenSymbol, tokenB: TokenSymbol, sharesToBurn: number) => void;
  poolReserves: Record<string, { reserveA: number; reserveB: number; totalShares: number; userShares: number }>;
  tokens: Record<string, any>;
  triggerNotification?: (title: string, desc: string, type: "success" | "info" | "warning") => void;
}

export default function Pools({
  isLightTheme,
  walletState,
  onAddLiquidity,
  onRemoveLiquidity,
  poolReserves,
  tokens,
  triggerNotification,
}: PoolsProps) {
  // Modes: "ADD" or "REMOVE"
  const [mode, setMode] = useState<"ADD" | "REMOVE">("ADD");

  // Selection state
  const [tokenA, setTokenA] = useState<TokenSymbol>("USDC");
  const [tokenB, setTokenB] = useState<TokenSymbol>("USDT");

  // Input states
  const [amountA, setAmountA] = useState<string>("");
  const [amountB, setAmountB] = useState<string>("");
  const [sharesToRemove, setSharesToRemove] = useState<string>("");

  // Get selected pair's pool key
  const getSortedPairKey = (tA: TokenSymbol, tB: TokenSymbol) => {
    const sorted = [tA, tB].sort();
    return `${sorted[0]}_${sorted[1]}`;
  };

  const poolKey = getSortedPairKey(tokenA, tokenB);
  const activePool = poolReserves[poolKey] || {
    reserveA: 100000,
    reserveB: 100000,
    totalShares: 100000,
    userShares: 0
  };

  const handleTokenAChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value as TokenSymbol;
    setTokenA(selected);
    setAmountA("");
    setAmountB("");
    if (selected === tokenB) {
      setTokenB(tokenA);
    }
  };

  const handleTokenBChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value as TokenSymbol;
    setTokenB(selected);
    setAmountA("");
    setAmountB("");
    if (selected === tokenA) {
      setTokenA(tokenB);
    }
  };

  const handleAmountAChange = (valStr: string) => {
    setAmountA(valStr);
    const val = parseFloat(valStr);
    if (!isNaN(val) && val > 0 && activePool.reserveA > 0 && activePool.reserveB > 0) {
      const calculatedB = (val * activePool.reserveB) / activePool.reserveA;
      setAmountB(parseFloat(calculatedB.toFixed(6)).toString());
    } else if (!valStr) {
      setAmountB("");
    }
  };

  const handleAmountBChange = (valStr: string) => {
    setAmountB(valStr);
    const val = parseFloat(valStr);
    if (!isNaN(val) && val > 0 && activePool.reserveA > 0 && activePool.reserveB > 0) {
      const calculatedA = (val * activePool.reserveA) / activePool.reserveB;
      setAmountA(parseFloat(calculatedA.toFixed(6)).toString());
    } else if (!valStr) {
      setAmountA("");
    }
  };

  const calculateSharesToMint = () => {
    const valA = parseFloat(amountA);
    const valB = parseFloat(amountB);
    if (isNaN(valA) || isNaN(valB) || valA <= 0 || valB <= 0) return 0;

    if (activePool.totalShares === 0) {
      return Math.sqrt(valA * valB);
    }
    const shareA = (valA * activePool.totalShares) / activePool.reserveA;
    const shareB = (valB * activePool.totalShares) / activePool.reserveB;
    return Math.min(shareA, shareB);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const valA = parseFloat(amountA);
    const valB = parseFloat(amountB);

    if (isNaN(valA) || isNaN(valB) || valA <= 0 || valB <= 0) return;
    if (walletState) {
      if (valA > walletState.balances[tokenA] || valB > walletState.balances[tokenB]) {
        if (triggerNotification) {
          triggerNotification(
            "Low Account Balances",
            `You do not hold enough units of ${tokenA} or ${tokenB} to construct this liquidity seed. Mint them at the Faucet!`,
            "warning"
          );
        } else {
          alert(`Insufficient ${tokenA} or ${tokenB} tokens available.`);
        }
        return;
      }
    }
    onAddLiquidity(tokenA, tokenB, valA, valB);
    setAmountA("");
    setAmountB("");
  };

  const handleRemoveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const shares = parseFloat(sharesToRemove);
    if (isNaN(shares) || shares <= 0 || shares > activePool.userShares) return;

    onRemoveLiquidity(tokenA, tokenB, shares);
    setSharesToRemove("");
  };

  const sharesToMint = calculateSharesToMint();

  return (
    <div className={`p-6 border rounded-xl relative overflow-hidden transition-all duration-300 ${
      isLightTheme 
        ? "bg-white border-zinc-200" 
        : "bg-slate-900/50 border-cyan-500/20 shadow-[0_0_20px_rgba(6,182,212,0.05)] backdrop-blur-xl"
    }`}>
      {/* Decorative crosshairs */}
      <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-cyan-500/40"></div>
      <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-cyan-500/40"></div>
      <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-cyan-500/40"></div>
      <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-cyan-500/40"></div>

      {/* Widget header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-sans font-bold uppercase text-cyan-400 flex items-center gap-1.5 animate-pulse">
            <Droplet className="h-4 w-4 text-cyan-400" />
            Liquidity Matrix Pool
          </h2>
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
            Inject liquidity to claim ratio swap yields
          </p>
        </div>

        {/* Tab Selection */}
        <div className={`flex p-1 rounded-sm ${
          isLightTheme ? "bg-zinc-100 border border-zinc-200" : "bg-black/40 border border-white/5"
        }`}>
          <button
            onClick={() => setMode("ADD")}
            className={`cursor-pointer px-3 py-1.5 rounded-sm text-[10px] font-mono font-bold tracking-wider uppercase transition-all ${
              mode === "ADD"
                ? isLightTheme
                  ? "bg-cyan-200 text-cyan-800 border border-cyan-300"
                  : "bg-cyan-500/20 text-cyan-400 border border-cyan-500/40"
                : isLightTheme
                  ? "text-zinc-550 hover:text-zinc-800"
                  : "text-slate-500 hover:text-slate-200"
            }`}
          >
            Add Liquidity
          </button>
          <button
            onClick={() => setMode("REMOVE")}
            className={`cursor-pointer px-3 py-1.5 rounded-sm text-[10px] font-mono font-bold tracking-wider uppercase transition-all ${
              mode === "REMOVE"
                ? isLightTheme
                  ? "bg-fuchsia-200 text-fuchsia-800 border border-fuchsia-300"
                  : "bg-fuchsia-500/20 text-fuchsia-400 border border-fuchsia-500/40"
                : isLightTheme
                  ? "text-zinc-550 hover:text-zinc-800"
                  : "text-slate-500 hover:text-slate-200"
            }`}
          >
            Burn LP Shares
          </button>
        </div>
      </div>

      {/* Interactive LP selection module */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        
        {/* Token Selection A */}
        <div className={`p-4 rounded-xl border ${
          isLightTheme ? "bg-zinc-50 border-zinc-200" : "bg-black/40 border border-white/5"
        }`}>
          <label className="block text-[9px] font-mono uppercase text-slate-500 mb-1">Inject Asset Alpha</label>
          <div className="flex items-center gap-2">
            <select
              value={tokenA}
              onChange={handleTokenAChange}
              className={`w-full font-mono text-sm font-bold border rounded-lg px-2 py-2 focus:outline-none ${
                isLightTheme 
                  ? "bg-white border-zinc-300 text-zinc-900" 
                  : "bg-slate-905 border-white/5 text-white"
              }`}
            >
              {Object.keys(tokens).map((t) => (
                <option key={t} value={t}>{t} ({tokens[t as TokenSymbol].name})</option>
              ))}
            </select>
            {walletState && (
              <span className={`text-[10px] font-mono whitespace-nowrap min-w-[70px] text-right font-bold ${
                isLightTheme ? "text-zinc-650" : "text-slate-405"
              }`}>
                Balance: {formatAmount(walletState.balances[tokenA] || 0, 4)}
              </span>
            )}
          </div>
        </div>

        {/* Token Selection B */}
        <div className={`p-4 rounded-xl border ${
          isLightTheme ? "bg-zinc-50 border-zinc-200" : "bg-black/40 border border-white/5"
        }`}>
          <label className="block text-[9px] font-mono uppercase text-slate-500 mb-1">Inject Asset Beta</label>
          <div className="flex items-center gap-2">
            <select
              value={tokenB}
              onChange={handleTokenBChange}
              className={`w-full font-mono text-sm font-bold border rounded-lg px-2 py-2 focus:outline-none ${
                isLightTheme 
                  ? "bg-white border-zinc-300 text-zinc-900" 
                  : "bg-slate-905 border-white/5 text-white"
              }`}
            >
              {Object.keys(tokens).map((t) => (
                <option key={t} value={t}>{t} ({tokens[t as TokenSymbol].name})</option>
              ))}
            </select>
            {walletState && (
              <span className={`text-[10px] font-mono whitespace-nowrap min-w-[70px] text-right font-bold ${
                isLightTheme ? "text-zinc-650" : "text-slate-405"
              }`}>
                Balance: {formatAmount(walletState.balances[tokenB] || 0, 4)}
              </span>
            )}
          </div>
        </div>

      </div>

      {/* active pool details display */}
      <div className={`p-4 rounded-xl border font-mono text-xs mb-6 space-y-2 ${
        isLightTheme ? "bg-zinc-100/80 border-zinc-200 text-zinc-900" : "bg-cyan-400/5 border border-cyan-500/10"
      }`}>
        <div className={`flex items-center justify-between text-[10px] uppercase tracking-wider mb-1.5 border-b pb-1.5 font-black ${
          isLightTheme ? "text-cyan-750 border-zinc-200" : "text-cyan-400 border-cyan-500/10"
        }`}>
          <span className="flex items-center"><Database className="h-3 w-3 mr-1 animate-pulse" /> ACTIVE POOL: {tokenA} / {tokenB}</span>
          <span>Constant K: {formatAmount(activePool.reserveA * activePool.reserveB, 4)}</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-slate-500 text-[9px] uppercase">Reserve A ({tokenA})</p>
            <p className={`font-bold text-sm ${isLightTheme ? "text-zinc-900" : "text-slate-200"}`}>{formatAmount(activePool.reserveA, 4)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-[9px] uppercase">Reserve B ({tokenB})</p>
            <p className={`font-bold text-sm ${isLightTheme ? "text-zinc-900" : "text-slate-200"}`}>{formatAmount(activePool.reserveB, 4)}</p>
          </div>
          <div>
            <p className="text-slate-500 text-[9px] uppercase">Your LP shares</p>
            <p className={`font-bold text-sm flex items-center gap-1 ${
              isLightTheme ? "text-cyan-700" : "text-cyan-400"
            }`}>
              {formatAmount(activePool.userShares, 4)}
              <span className="text-[9px] text-slate-500">
                ({activePool.totalShares > 0 ? formatAmount((activePool.userShares/activePool.totalShares)*100, 2) : "0"}%)
              </span>
            </p>
          </div>
          <div>
            <p className="text-slate-500 text-[9px] uppercase">Total Pool LP Shares</p>
            <p className={`font-bold text-sm ${isLightTheme ? "text-zinc-900" : "text-slate-200"}`}>{formatAmount(activePool.totalShares, 4)}</p>
          </div>
        </div>
      </div>

      {mode === "ADD" ? (
        // Add Liquidity View
        <form onSubmit={handleAddSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            <div className={`p-4 rounded-xl border relative ${
              isLightTheme ? "bg-zinc-50 border-zinc-200" : "bg-black/40 border border-white/5"
            }`}>
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wide block mb-1">Enter {tokenA} Amount</span>
              <input
                type="number"
                placeholder="0.0"
                value={amountA}
                onChange={(e) => handleAmountAChange(e.target.value)}
                className={`bg-transparent text-lg font-bold font-mono outline-none w-full border-none p-0 ${
                  isLightTheme ? "text-zinc-900" : "text-slate-100"
                }`}
                required
              />
              {(!activePool.reserveA || !activePool.reserveB) && (
                <div className="text-[8px] text-amber-500 font-mono mt-0.5">
                  ⚠️ Initial ratio setter is ACTIVE.
                </div>
              )}
            </div>

            <div className={`p-4 rounded-xl border relative ${
              isLightTheme ? "bg-zinc-50 border-zinc-200" : "bg-black/40 border border-white/5"
            }`}>
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-wide block mb-1">Enter {tokenB} Amount</span>
              <input
                type="number"
                placeholder="0.0"
                value={amountB}
                onChange={(e) => handleAmountBChange(e.target.value)}
                className={`bg-transparent text-lg font-bold font-mono outline-none w-full border-none p-0 ${
                  isLightTheme ? "text-zinc-900" : "text-slate-100"
                }`}
                required
              />
              {(!activePool.reserveA || !activePool.reserveB) && parseFloat(amountA) > 0 && parseFloat(amountB) > 0 && (
                <div className="text-[8px] text-cyan-400 font-mono mt-0.5">
                  1 {tokenA} = {(parseFloat(amountB) / parseFloat(amountA)).toFixed(4)} {tokenB}
                </div>
              )}
            </div>

          </div>

          {sharesToMint > 0 && (
            <div className={`p-3 border rounded-lg text-xs font-mono rgb-strip ${
              isLightTheme ? "bg-cyan-50 border-cyan-200 text-cyan-800" : "bg-cyan-950/20 border border-cyan-500/20 text-cyan-300"
            }`}>
              ⚡ Calculated LP share yield: <span className={`font-bold ${isLightTheme ? "text-cyan-705" : "text-cyan-400"}`}>{formatAmount(sharesToMint, 6)} LP Shares</span>
            </div>
          )}

          {walletState ? (
            <button
               type="submit"
               className="w-full py-4 rounded-sm font-sans font-black tracking-widest uppercase transition-all duration-300 bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-black hover:scale-[1.02] shadow-[0_0_20px_rgba(6,182,212,0.3)] active:translate-y-0.5 cursor-pointer"
            >
              Inject Liquidity Pair
            </button>
          ) : (
            <div className="text-center py-3 border border-zinc-805 text-zinc-500 text-xs font-mono rounded-xl bg-zinc-950/20">
              Link interface to authorize liquidity operations.
            </div>
          )}
        </form>
      ) : (
        // Remove Liquidity View
        <form onSubmit={handleRemoveSubmit} className="space-y-4">
          <div className={`p-4 rounded-xl border relative ${
            isLightTheme ? "bg-zinc-50 border-zinc-200" : "bg-black/40 border border-white/5"
          }`}>
            <div className="flex justify-between items-center mb-1">
              <span className={`text-[9px] font-mono uppercase tracking-wide ${
                isLightTheme ? "text-fuchsia-750 font-extrabold" : "text-fuchsia-400"
              }`}>Burn LP Shares</span>
              <span 
                onClick={() => setSharesToRemove(activePool.userShares.toString())}
                className={`text-xs font-mono cursor-pointer underline decoration-dotted font-bold ${
                  isLightTheme ? "text-fuchsia-750 hover:text-fuchsia-900" : "text-fuchsia-400 hover:text-fuchsia-300"
                }`}
              >
                Burn All Max ({formatAmount(activePool.userShares, 4)})
              </span>
            </div>

            <input
              type="number"
              placeholder="0.0"
              max={activePool.userShares}
              value={sharesToRemove}
              onChange={(e) => setSharesToRemove(e.target.value)}
              className={`bg-transparent text-lg font-bold font-mono outline-none w-full border-none p-0 ${
                isLightTheme ? "text-zinc-900" : "text-slate-100"
              }`}
              required
            />
          </div>

          {walletState ? (
            <button
              type="submit"
              disabled={!sharesToRemove || parseFloat(sharesToRemove) <= 0 || parseFloat(sharesToRemove) > activePool.userShares}
              className={`w-full py-4 rounded-sm font-sans font-black tracking-widest uppercase transition-all duration-300 ${
                !sharesToRemove || parseFloat(sharesToRemove) <= 0 || parseFloat(sharesToRemove) > activePool.userShares
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-white/5"
                  : "bg-gradient-to-r from-fuchsia-500 to-rose-600 text-black font-black hover:scale-[1.02] shadow-[0_0_20px_rgba(217,70,239,0.3)] active:translate-y-0.5 cursor-pointer"
              }`}
            >
              Withdraw & Reclaim Underlying Assets
            </button>
          ) : (
            <div className="text-center py-3 border border-zinc-800 text-zinc-500 text-xs font-mono rounded-xl bg-zinc-950/20">
              Link interface to withdraw reserves.
            </div>
          )}
        </form>
      )}

    </div>
  );
}
