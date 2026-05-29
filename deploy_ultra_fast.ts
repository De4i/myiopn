import solc from "solc";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";

async function main() {
  console.log("=== STARTING ULTRA-FAST DEX SYSTEM UPGRADE ===");

  // 1. Setup provider and wallet
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
  
  const provider = new ethers.JsonRpcProvider("https://testnet-rpc.iopn.tech", undefined, {
    staticNetwork: true
  });
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Securing wallet connection: ${wallet.address}`);

  // Existing deployed tokens
  const USDC = "0xAe69efe47ad3b3AEE2Be0c3A6eeA2bA9bc4a9284";
  const USDT = "0xd79Cf114127bE55bDD96b608662109B277DaBF8d";
  const NBLAD = "0x12F9A5DF81967257d623dce5859e3b0a67ae81cf";
  const DE4I = "0xB399A547792fdE76920cc41A8B13F0E3F50E2004";

  // 2. Compile myIOPN_DEX source
  console.log("Compiling myIOPN_DEX.sol with solc...");
  const dexPath = path.join(process.cwd(), "contracts", "myIOPN_DEX.sol");
  const dexSource = fs.readFileSync(dexPath, "utf8");

  const input = {
    language: "Solidity",
    sources: { "myIOPN_DEX.sol": { content: dexSource } },
    settings: {
      outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
      optimizer: { enabled: true, runs: 200 }
    },
  };

  const compiled = JSON.parse(solc.compile(JSON.stringify(input)));
  if (compiled.errors) {
    for (const error of compiled.errors) {
      if (error.severity === "error") {
        console.error("Compile Error:", error.formattedMessage);
        process.exit(1);
      }
    }
  }

  const dexArtifact = compiled.contracts["myIOPN_DEX.sol"]["myIOPN_DEX"];
  console.log("Compilation complete!");

  // 3. Deploy Upgraded DEX Contract
  console.log("Deploying upgraded DEX Smart Contract with 1:1 Stable swap...");
  const dexFactory = new ethers.ContractFactory(dexArtifact.abi, dexArtifact.evm.bytecode.object, wallet);
  const dexContract = await dexFactory.deploy(USDC, USDT, NBLAD, DE4I, {
    gasLimit: 5000000
  });
  await dexContract.waitForDeployment();
  const DEX = await dexContract.getAddress();
  console.log(`DEX Smart Contract deployed at: ${DEX}`);

  // 4. Concurrently Fund Rewards and Approve Pools
  console.log("Fetching current standard wallet nonce...");
  let nonce = await wallet.getNonce();
  console.log(`Starting parallel transfers and approvals at nonce: ${nonce}`);

  const nbladInt = new ethers.Contract(NBLAD, [
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function approve(address spender, uint256 amount) external returns (bool)"
  ], wallet);
  const de4iInt = new ethers.Contract(DE4I, [
    "function transfer(address to, uint256 amount) external returns (bool)",
    "function approve(address spender, uint256 amount) external returns (bool)"
  ], wallet);
  const usdcInt = new ethers.Contract(USDC, [
    "function approve(address spender, uint256 amount) external returns (bool)"
  ], wallet);
  const usdtInt = new ethers.Contract(USDT, [
    "function approve(address spender, uint256 amount) external returns (bool)"
  ], wallet);

  const fundAmt = ethers.parseUnits("50000000", 18);
  const liqAmt = ethers.parseUnits("5000000", 18);
  const nbladLiqAmt = ethers.parseUnits("500000", 18);
  const usdcLiqAmt = ethers.parseUnits("100000", 18);
  const de4iLiqAmt = ethers.parseUnits("400000", 18);
  const usdtLiqAmtForDe4i = ethers.parseUnits("60000", 18);

  const maxVal = ethers.MaxUint256;

  const [
    txFundNblad,
    txFundDe4i,
    txApproveUsdc,
    txApproveUsdt,
    txApproveNblad,
    txApproveDe4i
  ] = await Promise.all([
    nbladInt.transfer(DEX, fundAmt, { gasLimit: 150000, nonce: nonce++ }),
    de4iInt.transfer(DEX, fundAmt, { gasLimit: 150000, nonce: nonce++ }),
    usdcInt.approve(DEX, maxVal, { gasLimit: 100000, nonce: nonce++ }),
    usdtInt.approve(DEX, maxVal, { gasLimit: 100000, nonce: nonce++ }),
    nbladInt.approve(DEX, maxVal, { gasLimit: 100000, nonce: nonce++ }),
    de4iInt.approve(DEX, maxVal, { gasLimit: 100000, nonce: nonce++ })
  ]);

  console.log("Waiting for parallel transfers and spend authorizations to be mined...");
  await Promise.all([
    txFundNblad.wait(),
    txFundDe4i.wait(),
    txApproveUsdc.wait(),
    txApproveUsdt.wait(),
    txApproveNblad.wait(),
    txApproveDe4i.wait()
  ]);
  console.log("Successfully authorized and funded new DEX rewards and pool allowances!");

  // 5. Concurrently Inject reserves into all three pools
  console.log(`Starting parallel pool liquidities injection at nonce: ${nonce}`);
  const dexWithLiq = new ethers.Contract(DEX, [
    "function addLiquidity(address tokenA, address tokenB, uint256 amountA, uint256 amountB) external returns (uint256)"
  ], wallet);

  const [
    txAddLiq,
    txAddNbladUsdcLiq,
    txAddDe4iUsdtLiq
  ] = await Promise.all([
    dexWithLiq.addLiquidity(USDC, USDT, liqAmt, liqAmt, { gasLimit: 300000, nonce: nonce++ }),
    dexWithLiq.addLiquidity(NBLAD, USDC, nbladLiqAmt, usdcLiqAmt, { gasLimit: 300000, nonce: nonce++ }),
    dexWithLiq.addLiquidity(DE4I, USDT, de4iLiqAmt, usdtLiqAmtForDe4i, { gasLimit: 300000, nonce: nonce++ })
  ]);

  console.log("Waiting for liquidity injections to settle on-chain...");
  await Promise.all([
    txAddLiq.wait(),
    txAddNbladUsdcLiq.wait(),
    txAddDe4iUsdtLiq.wait()
  ]);
  console.log("All three on-chain liquidity pools successfully established!");

  // 6. Write address mapping to deployed_addresses.json
  const deployedObj = {
    DEX,
    USDC,
    USDT,
    NBLAD,
    DE4I,
    deployedTimestamp: Date.now(),
    deployedBy: wallet.address,
    txHash: dexContract.deploymentTransaction()?.hash
  };

  const jsonPath = path.join(process.cwd(), "deployed_addresses.json");
  fs.writeFileSync(jsonPath, JSON.stringify(deployedObj, null, 2), "utf8");
  console.log(`Saved coordinates into ${jsonPath}`);

  // 7. Inline update src/types.ts
  const typesPath = path.join(process.cwd(), "src", "types.ts");
  if (fs.existsSync(typesPath)) {
    let typesContent = fs.readFileSync(typesPath, "utf8");
    typesContent = typesContent
      .replace(/DEX:\s*"0x[0-9a-fA-F]+"/g, `DEX: "${DEX}"`)
      .replace(/Masterchef:\s*"0x[0-9a-fA-F]+"/g, `Masterchef: "${DEX}"`)
      .replace(/Faucet:\s*"0x[0-9a-fA-F]+"/g, `Faucet: "${DEX}"`)
      .replace(/Pair:\s*"0x[0-9a-fA-F]+"/g, `Pair: "${DEX}"`);
    fs.writeFileSync(typesPath, typesContent, "utf8");
    console.log("Successfully updated src/types.ts with the new DEX coordinate.");
  }

  console.log("=== COMPLETED DEX SYSTEM UPGRADE SUCCESSFULLY ===");
}

main().catch((err) => {
  console.error("Upgrade process encountered a critical failure:", err);
  process.exit(1);
});
