import solc from "solc";
import fs from "fs";
import path from "path";
import { ethers } from "ethers";

async function main() {
  console.log("=== STARTING ADVANCED DEPLOYMENT CODES ON IOPN TESTNET ===");

  // 1. Load Private Key from pk.txt
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
  console.log(`Deployer / Faucet Wallet Address: ${wallet.address}`);

  // 2. Read Solidity source codes
  const dexPath = path.join(process.cwd(), "contracts", "myIOPN_DEX.sol");
  const erc20Path = path.join(process.cwd(), "contracts", "TestERC20.sol");
  
  if (!fs.existsSync(dexPath) || !fs.existsSync(erc20Path)) {
    console.error("Solidity source code files are missing!");
    process.exit(1);
  }

  const dexSource = fs.readFileSync(dexPath, "utf8");
  const erc20Source = fs.readFileSync(erc20Path, "utf8");

  // 3. Compile sources
  console.log("Compiling contracts using solc compiler...");
  const input = {
    language: "Solidity",
    sources: {
      "myIOPN_DEX.sol": { content: dexSource },
      "TestERC20.sol": { content: erc20Source }
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
    let hasError = false;
    for (const error of compiled.errors) {
      console.log(`[${error.severity.toUpperCase()}] ${error.formattedMessage}`);
      if (error.severity === "error") {
        hasError = true;
      }
    }
    if (hasError) {
      console.error("Compilation failed due to Solidity compiler errors.");
      process.exit(1);
    }
  }

  const dexArtifact = compiled.contracts["myIOPN_DEX.sol"]["myIOPN_DEX"];
  const erc20Artifact = compiled.contracts["TestERC20.sol"]["TestERC20"];
  
  console.log("Solidity contracts compiled successfully.");

  // Original, funded USDC & USDT on IOPN Testnet
  const USDC = "0xAe69efe47ad3b3AEE2Be0c3A6eeA2bA9bc4a9284";
  const USDT = "0xd79Cf114127bE55bDD96b608662109B277DaBF8d";

  // 4. Deploy Custom Reward Tokens NBLAD and DE4I concurrently
  const erc20Factory = new ethers.ContractFactory(erc20Artifact.abi, erc20Artifact.evm.bytecode.object, wallet);
  let nonce = await wallet.getNonce();
  console.log(`Starting token deployments at nonce: ${nonce}`);

  const nbladDeployPromise = erc20Factory.deploy("Nebula Blade", "NBLAD", 1000000000n, { nonce: nonce++, gasLimit: 3000000 });
  const de4iDeployPromise = erc20Factory.deploy("Deity Quantum", "DE4I", 1000000000n, { nonce: nonce++, gasLimit: 3000000 });

  const [nbladContract, de4iContract] = await Promise.all([nbladDeployPromise, de4iDeployPromise]);

  console.log("Waiting for tokens to deploy on-chain...");
  await Promise.all([nbladContract.waitForDeployment(), de4iContract.waitForDeployment()]);

  const NBLAD = await nbladContract.getAddress();
  const DE4I = await de4iContract.getAddress();
  console.log(`NBLAD Reward Token deployed securely at: ${NBLAD}`);
  console.log(`DE4I Reward Token deployed securely at: ${DE4I}`);

  // 5. Deploy DEX Main Contract with newly generated reward coords
  console.log(`Deploying upgraded myIOPN_DEX contract on-chain at nonce: ${nonce}...`);
  const dexFactory = new ethers.ContractFactory(dexArtifact.abi, dexArtifact.evm.bytecode.object, wallet);
  const dexContract = await dexFactory.deploy(USDC, USDT, NBLAD, DE4I, { nonce: nonce++, gasLimit: 5000000 });
  await dexContract.waitForDeployment();
  const DEX = await dexContract.getAddress();
  console.log(`myIOPN_DEX contract deployed securely at: ${DEX}`);

  // 6. Fund the DEX contract and Approve spending in parallel!
  console.log(`Executing concurrent reward funding and asset approvals at nonce: ${nonce}...`);
  
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

  const transferAmt = ethers.parseUnits("50000000", 18);
  const maxVal = ethers.MaxUint256;

  const [
    txFundNblad,
    txFundDe4i,
    txApproveUsdc,
    txApproveUsdt,
    txApproveNblad,
    txApproveDe4i
  ] = await Promise.all([
    nbladInt.transfer(DEX, transferAmt, { nonce: nonce++, gasLimit: 150000 }),
    de4iInt.transfer(DEX, transferAmt, { nonce: nonce++, gasLimit: 150000 }),
    usdcInt.approve(DEX, maxVal, { nonce: nonce++, gasLimit: 150000 }),
    usdtInt.approve(DEX, maxVal, { nonce: nonce++, gasLimit: 150000 }),
    nbladInt.approve(DEX, maxVal, { nonce: nonce++, gasLimit: 150000 }),
    de4iInt.approve(DEX, maxVal, { nonce: nonce++, gasLimit: 150000 })
  ]);

  console.log("Waiting for transfers and approvals to clear...");
  await Promise.all([
    txFundNblad.wait(),
    txFundDe4i.wait(),
    txApproveUsdc.wait(),
    txApproveUsdt.wait(),
    txApproveNblad.wait(),
    txApproveDe4i.wait()
  ]);
  console.log("Reward funding and absolute approvals completed.");

  // 7. Inject pool liquidities in parallel!
  console.log(`Injecting pool liquidities concurrently at nonce: ${nonce}...`);
  const dexWithLiquidity = new ethers.Contract(DEX, [
    "function addLiquidity(address tokenA, address tokenB, uint256 amountA, uint256 amountB) external returns (uint256)"
  ], wallet);

  const liqUsdcUsdtAmt = ethers.parseUnits("5000000", 18); // 5M USDC and USDT
  const nbladLiqAmt = ethers.parseUnits("500000", 18);
  const usdcLiqAmt = ethers.parseUnits("100000", 18);
  const de4iLiqAmt = ethers.parseUnits("400000", 18);
  const usdtLiqAmtForDe4i = ethers.parseUnits("60000", 18);

  const [
    txAddLiq,
    txAddNbladUsdcLiq,
    txAddDe4iUsdtLiq
  ] = await Promise.all([
    dexWithLiquidity.addLiquidity(USDC, USDT, liqUsdcUsdtAmt, liqUsdcUsdtAmt, { nonce: nonce++, gasLimit: 300000 }),
    dexWithLiquidity.addLiquidity(NBLAD, USDC, nbladLiqAmt, usdcLiqAmt, { nonce: nonce++, gasLimit: 300000 }),
    dexWithLiquidity.addLiquidity(DE4I, USDT, de4iLiqAmt, usdtLiqAmtForDe4i, { nonce: nonce++, gasLimit: 300000 })
  ]);

  console.log("Waiting for pool liquidity setups to settle on-chain...");
  await Promise.all([
    txAddLiq.wait(),
    txAddNbladUsdcLiq.wait(),
    txAddDe4iUsdtLiq.wait()
  ]);
  console.log("All on-chain stable and reward token liquidities successfully established!");

  // Save coordinates to JSON
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

  // Inline update src/types.ts so React application is synced automatically
  const typesPath = path.join(process.cwd(), "src", "types.ts");
  if (fs.existsSync(typesPath)) {
    let typesContent = fs.readFileSync(typesPath, "utf8");
    typesContent = typesContent
      .replace(/DEX:\s*"0x[0-9a-fA-F]+"/g, `DEX: "${DEX}"`)
      .replace(/Masterchef:\s*"0x[0-9a-fA-F]+"/g, `Masterchef: "${DEX}"`)
      .replace(/Faucet:\s*"0x[0-9a-fA-F]+"/g, `Faucet: "${DEX}"`)
      .replace(/Pair:\s*"0x[0-9a-fA-F]+"/g, `Pair: "${DEX}"`)
      .replace(/NBLAD:\s*"0x[0-9a-fA-F]+"/g, `NBLAD: "${NBLAD}"`)
      .replace(/DE4I:\s*"0x[0-9a-fA-F]+"/g, `DE4I: "${DE4I}"`);
    fs.writeFileSync(typesPath, typesContent, "utf8");
    console.log("Successfully updated src/types.ts with custom NBLAD/DE4I/DEX coordinates.");
  }

  console.log("=== COMPLETED DEPLOYMENT CODES ===");
}

main().catch((err) => {
  console.error("Failure:", err);
  process.exit(1);
});
