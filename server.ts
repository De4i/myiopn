import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { ethers } from "ethers";
import solc from "solc";

const app = express();
const PORT = 3000;
const DB_FILE = path.join(process.cwd(), "wallets_db.json");

app.use(express.json());

// Type interfaces for the persistent DB
interface WalletData {
  address: string;
  balances: {
    OPN: number;
    USDC: number;
    USDT: number;
    NBLAD: number;
    DE4I: number;
  };
  staking: {
    usdcStaked: number;
    usdtStaked: number;
    usdcLastStakedTime: number;
    usdtLastStakedTime: number;
    nbladRewardDebt: number;
    de4iRewardDebt: number;
  };
  faucetClaims: {
    USDC: number; // timestamp
    USDT: number; // timestamp
  };
  autoWithdrawThresholds: {
    NBLAD: number;
    DE4I: number;
    enabled: boolean;
  };
  logs: Array<{
    id: string;
    timestamp: number;
    type: string;
    detail: string;
    txHash: string;
  }>;
}

// Initial state for new wallets
const getInitialWalletState = (address: string): WalletData => ({
  address: address.toLowerCase(),
  balances: {
    OPN: 0,
    USDC: 0,
    USDT: 0,
    NBLAD: 0,
    DE4I: 0,
  },
  staking: {
    usdcStaked: 0,
    usdtStaked: 0,
    usdcLastStakedTime: 0,
    usdtLastStakedTime: 0,
    nbladRewardDebt: 0,
    de4iRewardDebt: 0,
  },
  faucetClaims: {
    USDC: 0,
    USDT: 0,
  },
  autoWithdrawThresholds: {
    NBLAD: 500,
    DE4I: 200,
    enabled: false,
  },
  logs: [
    {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: Date.now(),
      type: "SYSTEM",
      detail: "Cybernetic wallet environment instantiated securely.",
      txHash: "0x" + Array.from({length: 64}, () => Math.floor(Math.random()*16).toString(16)).join(""),
    }
  ]
});

// Helper to load/save JSON database
function loadDb(): Record<string, WalletData> {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({}, null, 2));
  }
  try {
    const data = fs.readFileSync(DB_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading database block, recreating database structure.", err);
    return {};
  }
}

function saveDb(db: Record<string, WalletData>) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
  } catch (err) {
    console.error("Failed to write database file:", err);
  }
}

// REST APIs
// 1. Health check or telemetry feed
app.get("/api/telemetry", (req, res) => {
  let deployedAddresses = null;
  const filePath = path.join(process.cwd(), "deployed_addresses.json");
  if (fs.existsSync(filePath)) {
    try {
      deployedAddresses = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (e) {}
  }

  res.json({
    blockHeight: Math.floor(18053000 + (Date.now() - 1716960000000) / 12000),
    activeNodes: 1404 + Math.floor(Math.sin(Date.now() / 60000) * 8),
    ammGigaHashRate: "420.69 TH/s",
    slippageStandard: 0.5,
    gasGwei: 15 + Math.floor(Math.sin(Date.now() / 15000) * 5),
    gasPriceUsd: 0.42,
    faucetLimit: 1000,
    cooldownMs: 86400000, // 24 hours
    deployedAddresses: deployedAddresses
  });
});

// Endpoint to compile and deploy DEX contract using pk.txt private key
app.post("/api/deploy-contracts", async (req, res) => {
  try {
    const pkPath = path.join(process.cwd(), "pk.txt");
    let privateKey = "";
    if (fs.existsSync(pkPath)) {
      privateKey = fs.readFileSync(pkPath, "utf8").trim();
    }
    
    if (!privateKey) {
      privateKey = "0x826451e06fa9d8bf84c3115cfbf0bc8d7915ce7ea11c14fe22f6ee1e9c20a112";
    }
    
    if (!privateKey.startsWith("0x")) {
      privateKey = "0x" + privateKey;
    }

    const provider = new ethers.JsonRpcProvider("https://testnet-rpc.iopn.tech");
    const wallet = new ethers.Wallet(privateKey, provider);

    // Read myIOPN_DEX.sol source code
    const sourcePath = path.join(process.cwd(), "contracts", "myIOPN_DEX.sol");
    if (!fs.existsSync(sourcePath)) {
      return res.status(404).json({ error: "Source code of myIOPN_DEX.sol was not found in contracts directory." });
    }
    const sourceCode = fs.readFileSync(sourcePath, "utf8");

    // Dynamic compilation using solc module
    const input = {
      language: "Solidity",
      sources: {
        "myIOPN_DEX.sol": {
          content: sourceCode,
        },
      },
      settings: {
        outputSelection: {
          "*": {
            "*": ["abi", "evm.bytecode.object"],
          },
        },
        optimizer: {
          enabled: true,
          runs: 200,
        }
      },
    };

    const compiled = JSON.parse(solc.compile(JSON.stringify(input)));
    if (compiled.errors) {
      const errs = compiled.errors.filter((e: any) => e.severity === "error");
      if (errs.length > 0) {
        return res.status(400).json({ error: "Solidity compilation failed with errors", details: errs });
      }
    }

    const contractArtifact = compiled.contracts["myIOPN_DEX.sol"]["myIOPN_DEX"];
    const abi = contractArtifact.abi;
    const bytecode = contractArtifact.evm.bytecode.object;

    // Default assets config
    const USDC = "0xAe69efe47ad3b3AEE2Be0c3A6eeA2bA9bc4a9284";
    const USDT = "0xd79Cf114127bE55bDD96b608662109B277DaBF8d";
    const NBLAD = "0x0258FaE58d52f8AD4508beEF1c40342b2E0CeD32";
    const DE4I = "0x605B6EDD6A38f1D66C32E2A1D5d91DC2e9F12e44";

    const factory = new ethers.ContractFactory(abi, bytecode, wallet);
    const contract = await factory.deploy(USDC, USDT, NBLAD, DE4I);
    await contract.waitForDeployment();
    const deployedAddress = await contract.getAddress();

    const deployedObj = {
      DEX: deployedAddress,
      USDC,
      USDT,
      NBLAD,
      DE4I,
      Masterchef: deployedAddress,
      Faucet: deployedAddress,
      Pair: deployedAddress,
      deployedTimestamp: Date.now(),
      deployedBy: wallet.address,
      txHash: contract.deploymentTransaction()?.hash
    };

    const jsonPath = path.join(process.cwd(), "deployed_addresses.json");
    fs.writeFileSync(jsonPath, JSON.stringify(deployedObj, null, 2), "utf8");

    // Update src/types.ts immediately
    const typesPath = path.join(process.cwd(), "src", "types.ts");
    if (fs.existsSync(typesPath)) {
      let typesContent = fs.readFileSync(typesPath, "utf8");
      // Find and replace absolute addresses inside CONSTANTS block to maintain client-server lockstep
      typesContent = typesContent.replace(
        /DEX:\s*"0x[0-9a-fA-F]+"/g,
        `DEX: "${deployedAddress}"`
      ).replace(
        /Masterchef:\s*"0x[0-9a-fA-F]+"/g,
        `Masterchef: "${deployedAddress}"`
      ).replace(
        /Faucet:\s*"0x[0-9a-fA-F]+"/g,
        `Faucet: "${deployedAddress}"`
      ).replace(
        /Pair:\s*"0x[0-9a-fA-F]+"/g,
        `Pair: "${deployedAddress}"`
      );
      fs.writeFileSync(typesPath, typesContent, "utf8");
    }

    res.json({
      success: true,
      deployedAddress,
      txHash: contract.deploymentTransaction()?.hash,
      message: "Contract compiled and deployed successfully to IOPN Testnet!"
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Contract deployment failed on-chain due to gas or RPC latency." });
  }
});

// 2. Synchronization endpoint (efficient state loads & writes)
app.post("/api/wallet/sync", (req, res) => {
  const { address, updatedState } = req.body;
  if (!address || typeof address !== "string") {
    res.status(400).json({ error: "Invalid target wallet address" });
    return;
  }

  const walletAddress = address.toLowerCase();
  const db = loadDb();

  if (!db[walletAddress]) {
    db[walletAddress] = getInitialWalletState(walletAddress);
    saveDb(db);
  }

  if (updatedState) {
    // Preserve address while merging updates efficiently
    db[walletAddress] = {
      ...db[walletAddress],
      ...updatedState,
      address: walletAddress, // Must remain lock-tight
    };
    saveDb(db);
  }

  res.json({
    success: true,
    data: db[walletAddress]
  });
});

// 3. Clear wallet history/reset data for testing
app.post("/api/wallet/reset", (req, res) => {
  const { address } = req.body;
  if (!address) {
    res.status(400).json({ error: "Address is required" });
    return;
  }
  const walletAddress = address.toLowerCase();
  const db = loadDb();
  
  db[walletAddress] = getInitialWalletState(walletAddress);
  saveDb(db);
  
  res.json({
    success: true,
    data: db[walletAddress],
    message: "Cyberpunk wallet state successfully sanitized and re-loaded."
  });
});

// Start the core services and link Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[SYS_OK] myIOPN Full-Stack server running on port ${PORT}`);
  });
}

startServer();
