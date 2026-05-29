import { ethers } from "ethers";

async function main() {
  const provider = new ethers.JsonRpcProvider("https://testnet-rpc.iopn.tech");
  const faucetSigner = "0x5EA060321bC75C5e82B60Ff6E3F5482Fc6F04213";

  const USDC = "0xAe69efe47ad3b3AEE2Be0c3A6eeA2bA9bc4a9284";
  const USDT = "0xd79Cf114127bE55bDD96b608662109B277DaBF8d";
  const NBLAD = "0x0258FaE58d52f8AD4508beEF1c40342b2E0CeD32";
  const DE4I = "0x605B6EDD6A38f1D66C32E2A1D5d91DC2e9F12e44";

  const erc20Abi = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)"
  ];

  const usdc = new ethers.Contract(USDC, erc20Abi, provider);
  const usdt = new ethers.Contract(USDT, erc20Abi, provider);
  const nblad = new ethers.Contract(NBLAD, erc20Abi, provider);
  const de4i = new ethers.Contract(DE4I, erc20Abi, provider);

  const usdcDec = await usdc.decimals();
  const usdtDec = await usdt.decimals();
  const nbladDec = await nblad.decimals();
  const de4iDec = await de4i.decimals();

  console.log(`USDC Decimals: ${usdcDec}`);
  console.log(`USDT Decimals: ${usdtDec}`);
  console.log(`NBLAD Decimals: ${nbladDec}`);
  console.log(`DE4I Decimals: ${de4iDec}`);

  const usdcBal = await usdc.balanceOf(faucetSigner);
  const usdtBal = await usdt.balanceOf(faucetSigner);
  const nbladBal = await nblad.balanceOf(faucetSigner);
  const de4iBal = await de4i.balanceOf(faucetSigner);

  console.log(`Faucet Signer USDC Balance: ${ethers.formatUnits(usdcBal, usdcDec)}`);
  console.log(`Faucet Signer USDT Balance: ${ethers.formatUnits(usdtBal, usdtDec)}`);
  console.log(`Faucet Signer NBLAD Balance: ${ethers.formatUnits(nbladBal, nbladDec)}`);
  console.log(`Faucet Signer DE4I Balance: ${ethers.formatUnits(de4iBal, de4iDec)}`);
  
  const nativeBal = await provider.getBalance(faucetSigner);
  console.log(`Faucet Signer Native Balance: ${ethers.formatEther(nativeBal)} OPN`);
}

main().catch(console.error);
