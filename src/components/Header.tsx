import React from "react";
import { 
  Compass, 
  Wallet, 
  Sun, 
  Moon, 
  Activity, 
  Cpu, 
  Database,
  Unplug
} from "lucide-react";
import { WalletState, MarketTelemetry } from "../types";

interface HeaderProps {
  isLightTheme: boolean;
  setIsLightTheme: (val: boolean) => void;
  walletState: WalletState | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  telemetry: MarketTelemetry | null;
}

export default function Header({
  isLightTheme,
  setIsLightTheme,
  walletState,
  connectWallet,
  disconnectWallet,
  telemetry,
}: HeaderProps) {
  const shortAddress = (addr: string) => {
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  return (
    <header className={`border-b ${
      isLightTheme 
        ? "bg-white border-zinc-200 text-zinc-900" 
        : "bg-[#050505] border-cyan-500/30 text-slate-200"
    } sticky top-0 z-50 backdrop-blur-md`}>
      {/* Glow highlight line */}
      <div className="h-1 w-full bg-gradient-to-r from-cyan-500 via-fuchsia-500 to-amber-500 shadow-[0_1px_10px_rgba(6,182,212,0.5)]"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          
          {/* Logo Brand */}
          <div className="flex items-center space-x-3">
            <div className="relative animate-pulse-slow">
              <div className="absolute -inset-1 rounded-lg bg-gradient-to-r from-cyan-500 to-fuchsia-500 opacity-75 blur" />
              <div className="relative w-11 h-11 bg-zinc-950 rounded-lg flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(6,182,212,0.5)] select-none">
                <img 
                  src="/logo.png" 
                  alt="myIOPN Logo" 
                  className="w-full h-full object-cover rounded-lg"
                  referrerPolicy="no-referrer"
                />
              </div>
            </div>
            <div>
              <div className="flex items-baseline space-x-1">
                <span className={`text-2xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r ${
                  isLightTheme ? "from-zinc-900 to-cyan-600" : "from-white to-cyan-400"
                }`}>
                  myIOPN
                </span>
                <span className="text-xs font-mono text-fuchsia-500 font-extrabold tracking-wider">
                  DEX_v2.0
                </span>
              </div>
              <p className={`text-[10px] font-mono tracking-widest font-bold uppercase ${
                isLightTheme ? "text-cyan-700" : "text-cyan-400"
              }`}>
                IOPN TESTNET (EVM: 984)
              </p>
            </div>
          </div>

          {/* Right side controls */}
          <div className="flex items-center space-x-3 md:space-x-4">
            
            {/* Live Telemetry Display */}
            {telemetry && (
              <div className={`hidden lg:flex items-center space-x-4 pr-4 border-r ${
                isLightTheme ? "border-zinc-200" : "border-zinc-850"
              }`}>
                <div className="text-right">
                  <div className={`flex items-center justify-end text-[10px] font-mono ${
                    isLightTheme ? "text-cyan-600 font-extrabold" : "text-cyan-400"
                  }`}>
                    <span className={`w-2 h-2 rounded-full mr-1.5 animate-ping ${
                      isLightTheme ? "bg-cyan-500" : "bg-cyan-400"
                    }`} />
                    Block #{telemetry.blockHeight}
                  </div>
                  <p className="text-[9px] font-mono text-slate-500">Sync Rate: 99.82%</p>
                </div>
                <div className="text-right">
                  <div className={`text-[10px] font-mono flex items-center justify-end ${
                    isLightTheme ? "text-amber-750 font-extrabold" : "text-amber-400"
                  }`}>
                    <Activity className="h-3 w-3 mr-1" />
                    {telemetry.gasGwei} Gwei
                  </div>
                  <p className="text-[9px] font-mono text-slate-500">Gas Lock: Safe</p>
                </div>
              </div>
            )}

            {/* Dark & Light Toggle */}
            <button
              id="theme-toggle"
              onClick={() => setIsLightTheme(!isLightTheme)}
              className={`p-2.5 rounded-lg border transition-all duration-300 ${
                isLightTheme 
                  ? "bg-zinc-100 border-zinc-300 text-zinc-800 hover:bg-zinc-200 hover:border-zinc-400" 
                  : "bg-slate-900 border-cyan-500/20 text-cyan-400 hover:bg-slate-850 hover:border-cyan-400/50"
              }`}
              title="Toggle Cyber Theme"
            >
              {isLightTheme ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </button>

            {/* Wallet Integration Segment */}
            {walletState ? (
              <div className="flex items-center space-x-2">
                <div className={`hidden md:flex flex-col items-end px-3 py-1 border rounded font-mono ${
                  isLightTheme 
                    ? "bg-cyan-50 border-cyan-300 text-cyan-800" 
                    : "bg-black/40 border-cyan-500/30 text-cyan-300"
                }`}>
                  <span className={`text-[10px] uppercase flex items-center font-bold ${
                    isLightTheme ? "text-cyan-700" : "text-slate-500"
                  }`}>
                    <Database className={`h-2 w-2 mr-1 animate-pulse ${isLightTheme ? "text-cyan-600" : "text-cyan-400"}`} />
                    IOPN Testnet EVM
                  </span>
                  <span className={`text-xs font-bold font-mono ${
                    isLightTheme ? "text-zinc-900" : "text-white"
                  }`}>
                    {shortAddress(walletState.address)}
                  </span>
                </div>

                <button
                  id="wallet-disconnect"
                  onClick={disconnectWallet}
                  className="px-3.5 py-2 bg-rose-950/45 border border-rose-500/30 hover:border-rose-500/80 text-rose-300 hover:text-rose-100 rounded-sm text-xs font-mono font-bold uppercase flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Disconnect Interface"
                >
                  <Unplug className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Unlink</span>
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2.5">
                <button
                  id="web3-connect"
                  onClick={connectWallet}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-fuchsia-600 text-black font-black uppercase text-[9.5px] tracking-widest rounded-sm shadow-[2.5px_2.5px_0px_rgba(217,70,239,0.30)] active:translate-y-0.5 hover:scale-[1.01] transition-all cursor-pointer"
                >
                  MetaMask / OKX
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
