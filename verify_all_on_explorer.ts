import fs from "fs";
import path from "path";
import { ethers } from "ethers";

async function main() {
  console.log("=== INITIATING IOPN SMART CONTRACT EXPLORER VERIFICATION ===");

  const provider = new ethers.JsonRpcProvider("https://testnet-rpc.iopn.tech");
  
  // Addresses
  const DEX = "0x4e35Cdd63AbFB79Fe357ae6172b8A9E592D7Ce2f";
  const NBLAD = "0x12F9A5DF81967257d623dce5859e3b0a67ae81cf";
  const DE4I = "0xB399A547792fdE76920cc41A8B13F0E3F50E2004";
  const GreatIOPN = "0x61f03a6d594218001C315Dd278B9024Ec4182235";

  const USDC = "0xAe69efe47ad3b3AEE2Be0c3A6eeA2bA9bc4a9284";
  const USDT = "0xd79Cf114127bE55bDD96b608662109B277DaBF8d";

  // Check solc compiler version
  const compilerVersion = "v0.8.35+commit.47b9dedd";
  console.log(`Compiler version being used: ${compilerVersion}`);

  // 1. Read Solidity sources
  const erc20SourcePath = path.join(process.cwd(), "contracts", "TestERC20.sol");
  const dexSourcePath = path.join(process.cwd(), "contracts", "myIOPN_DEX.sol");

  if (!fs.existsSync(erc20SourcePath) || !fs.existsSync(dexSourcePath)) {
    console.error("Critical: Contract source files are missing. Cannot proceed with verification.");
    process.exit(1);
  }

  const erc20Source = fs.readFileSync(erc20SourcePath, "utf8");
  const dexSource = fs.readFileSync(dexSourcePath, "utf8");

  // 2. Setup ABI Coder
  const abiCoder = ethers.AbiCoder.defaultAbiCoder();

  // Encode constructor args
  // TestERC20: constructor(string memory _name, string memory _symbol, uint256 _initialSupply)
  const nbladArgsHex = abiCoder.encode(
    ["string", "string", "uint256"],
    ["Nebula Blade", "NBLAD", 1000000000n]
  ).replace("0x", "");

  const de4iArgsHex = abiCoder.encode(
    ["string", "string", "uint256"],
    ["Deity Quantum", "DE4I", 1000000000n]
  ).replace("0x", "");

  const greatIopnArgsHex = abiCoder.encode(
    ["string", "string", "uint256"],
    ["Great IOPN", "GIOPN", 1000000000n] // Best guess standard setup in case GreatIOPN is also TestERC20
  ).replace("0x", "");

  // myIOPN_DEX: constructor(address _usdc, address _usdt, address _nblad, address _de4i)
  const dexArgsHex = abiCoder.encode(
    ["address", "address", "address", "address"],
    [USDC, USDT, NBLAD, DE4I]
  ).replace("0x", "");

  const contractsToVerify = [
    {
      name: "Nebula Blade Token (NBLAD)",
      address: NBLAD,
      contractName: "TestERC20",
      source: erc20Source,
      constructorArgs: nbladArgsHex,
    },
    {
      name: "Deity Quantum Token (DE4I)",
      address: DE4I,
      contractName: "TestERC20",
      source: erc20Source,
      constructorArgs: de4iArgsHex,
    },
    {
      name: "myIOPN_DEX Router & Staking Engine",
      address: DEX,
      contractName: "myIOPN_DEX",
      source: dexSource,
      constructorArgs: dexArgsHex,
    },
    {
      name: "Great IOPN (GIOPN - as TestERC20 fallback)",
      address: GreatIOPN,
      contractName: "TestERC20",
      source: erc20Source,
      constructorArgs: greatIopnArgsHex,
      optional: true,
    }
  ];

  const explorerApiUrl = "https://explorer.iopn.tech/api";
  console.log(`Explorer API verification URL: ${explorerApiUrl}`);

  for (const c of contractsToVerify) {
    console.log(`\n---------------------------------------`);
    console.log(`SUBMITTING VERIFICATION FOR: ${c.name}`);
    console.log(`Contract Address : ${c.address}`);
    console.log(`Contract Name    : ${c.contractName}`);
    console.log(`Optimizer Runs   : 200 (Enabled)`);
    console.log(`Constructor Args : ${c.constructorArgs ? c.constructorArgs.substring(0, 50) + "..." : "None"}`);

    // Build URLSearchParams standard Etherscan/Blockscout compatibility POST payload
    const params = new URLSearchParams();
    params.append("apikey", "any_dummy_api_key");
    params.append("module", "contract");
    params.append("action", "verify");
    params.append("contractaddress", c.address);
    params.append("sourceCode", c.source);
    params.append("contractname", c.contractName);
    params.append("compilerversion", compilerVersion);
    params.append("optimizationUsed", "1");
    params.append("runs", "200");
    if (c.constructorArgs) {
      params.append("constructorArguements", c.constructorArgs);
    }
    params.append("codeformat", "solidity-single-file");

    try {
      const response = await fetch(explorerApiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });

      if (!response.ok) {
        console.warn(`[HTTP ERROR] Response status: ${response.status} for ${c.name}`);
        const textResult = await response.text();
        console.warn(`Response content: ${textResult}`);
        continue;
      }

      const result: any = await response.json();
      console.log(`[EXPLORER REPLY] Status: ${result.status} | Messages: ${result.message || "No Status Code"}`);
      if (result.result) {
        console.log(`[EXPLORER RESULT]: ${result.result}`);
      }
    } catch (err: any) {
      console.error(`Verification submission failed for ${c.name}:`, err.message);
    }
  }

  console.log("\n===============================================");
  console.log("SMART CONTRACT VERIFICATION SUBMISSIONS COMPLETE");
  console.log("Notes:");
  console.log("1. Please allow the block explorer indexing database 1-2 minutes to compile and tag the verify status in UI.");
  console.log("2. You can visit: https://explorer.iopn.tech/address/<contract_address> to verify code tabs interactively!");
  console.log("===============================================");
}

main().catch(err => {
  console.error("Verification execution failure:", err);
  process.exit(1);
});
