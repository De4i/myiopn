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

  // 4. Deploy Custom Reward Tokens NBLAD and DE4I
  const erc20Factory = new ethers.ContractFactory(erc20Artifact.abi, erc20Artifact.evm.bytecode.object, wallet);
  
  console.log("Deploying customized NBLAD Reward Token standard ERC-20...");
  const nbladContract = await erc20Factory.deploy("Nebula Blade", "NBLAD", 1000000000n); // 1 Billion tokens
  await nbladContract.waitForDeployment();
  const NBLAD = await nbladContract.getAddress();
  console.log(`NBLAD Reward Token deployed securely at: ${NBLAD}`);

  console.log("Deploying customized DE4I Reward Token standard ERC-20...");
  const de4iContract = await erc20Factory.deploy("Deity Quantum", "DE4I", 1000000000n); // 1 Billion tokens
  await de4iContract.waitForDeployment();
  const DE4I = await de4iContract.getAddress();
  console.log(`DE4I Reward Token deployed securely at: ${DE4I}`);

  // 5. Deploy DEX Main Contract with newly generated reward coords
  console.log("Deploying upgraded myIOPN_DEX contract on-chain...");
  const dexFactory = new ethers.ContractFactory(dexArtifact.abi, dexArtifact.evm.bytecode.object, wallet);
  const dexContract = await dexFactory.deploy(USDC, USDT, NBLAD, DE4I);
  await dexContract.waitForDeployment();
  const DEX = await dexContract.getAddress();
  console.log(`myIOPN_DEX contract deployed securely at: ${DEX}`);

  // 6. Fund the DEX contract with NBLAD and DE4I from our newly minted supply!
  console.log("Funding newly deployed myIOPN_DEX staking rewards pool with 50,000,000 NBLAD and 50,000,000 DE4I...");
  
  const transferAmt = ethers.parseUnits("50000000", 18);
  const txFundNblad = await (nbladContract as any).transfer(DEX, transferAmt);
  await txFundNblad.wait();
  console.log("Funded NBLAD reward pool with 50,000,000 tokens of 18 decimals on-chain.");

  const txFundDe4i = await (de4iContract as any).transfer(DEX, transferAmt);
  await txFundDe4i.wait();
  console.log("Funded DE4I reward pool with 50,000,000 tokens of 18 decimals on-chain.");

  // 7. Approve assets and add initial pool liquidities
  console.log("=== INITIATING PROTOCOL LIQUIDITY RESERVES INJECTION ===");

  const erc20AbiSimple = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)"
  ];
  
  const usdcInstance = new ethers.Contract(USDC, erc20AbiSimple, wallet);
  const usdtInstance = new ethers.Contract(USDT, erc20AbiSimple, wallet);
  const nbladInstance = new ethers.Contract(NBLAD, erc20AbiSimple, wallet);
  const de4iInstance = new ethers.Contract(DE4I, erc20AbiSimple, wallet);
  
  const dexWithLiquidity = new ethers.Contract(DEX, [
    "function addLiquidity(address tokenA, address tokenB, uint256 amountA, uint256 amountB) external returns (uint256)"
  ], wallet);

  // A. Approve USDT / USDC
  console.log("Approving USDC & USDT for initial stable pool liquidity...");
  const usdcApprovalAmt = ethers.parseUnits("5000000", 18);
  const usdtApprovalAmt = ethers.parseUnits("5000000", 18);
  
  const approveUsdcTx = await usdcInstance.approve(DEX, usdcApprovalAmt);
  await approveUsdcTx.wait();
  
  const approveUsdtTx = await usdtInstance.approve(DEX, usdtApprovalAmt);
  await approveUsdtTx.wait();
  
  console.log("USDC and USDT approved successfully.");
  
  // B. Add Liquidity for USDC & USDT (1:1 stable pair)
  console.log("Adding 5,000,000 USDC and 5,000,000 USDT liquidity (1:1 Stable Pool on-chain)...");
  const liqUsdcUsdtTx = await dexWithLiquidity.addLiquidity(USDC, USDT, usdcApprovalAmt, usdtApprovalAmt);
  await liqUsdcUsdtTx.wait();
  console.log("Core USDC_USDT on-chain stable pool reserves structured successfully!");

  // C. Add Liquidity for NBLAD & USDC (500,000 NBLAD and 100,000 USDC)
  console.log("Approving and adding 500,000 NBLAD + 100,000 USDC pool reserves...");
  const nbladLiqAmt = ethers.parseUnits("500000", 18);
  const usdcLiqAmt = ethers.parseUnits("100000", 18);
  
  const approveNbladTx = await nbladInstance.approve(DEX, nbladLiqAmt);
  await approveNbladTx.wait();
  const approveUsdcForNbladTx = await usdcInstance.approve(DEX, usdcLiqAmt);
  await approveUsdcForNbladTx.wait();
  
  const liqNbladUsdcTx = await dexWithLiquidity.addLiquidity(NBLAD, USDC, nbladLiqAmt, usdcLiqAmt);
  await liqNbladUsdcTx.wait();
  console.log("NBLAD_USDC on-chain reserves structured successfully!");

  // D. Add Liquidity for DE4I & USDT (400,000 DE4I and 60,000 USDT)
  console.log("Approving and adding 400,000 DE4I + 60,000 USDT pool reserves...");
  const de4iLiqAmt = ethers.parseUnits("400000", 18);
  const usdtLiqAmtForDe4i = ethers.parseUnits("60000", 18);
  
  const approveDe4iTx = await de4iInstance.approve(DEX, de4iLiqAmt);
  await approveDe4iTx.wait();
  const approveUsdtForDe4iTx = await usdtInstance.approve(DEX, usdtLiqAmtForDe4i);
  await approveUsdtForDe4iTx.wait();
  
  const liqDe4iUsdtTx = await dexWithLiquidity.addLiquidity(DE4I, USDT, de4iLiqAmt, usdtLiqAmtForDe4i);
  await liqDe4iUsdtTx.wait();
  console.log("DE4I_USDT on-chain reserves structured successfully!");

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
