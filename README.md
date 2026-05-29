# 🌌 MyIOPN DeFi Portal & Smart Contract Studio

An elegant, highly optimized Web3 decentralized exchange, custom staking protocol, and Solidity Smart Contract deployer fully integrated on the **IOPN Testnet (Chain ID: 984)**. 

Built with **React**, **Vite**, **Tailwind CSS**, and **Ethers.js v6**, this portal serves as a complete decentralized financial ecosystem that interacts directly with your connected MetaMask or OKX Web3 browser wallet—running real transactions on-chain.

---

## 🚀 Core Features

### 1. 🪙 Real On-Chain Token Deployer (Smart Contract Studio)
Deploy standard, production-ready **ERC-20 Solidity contracts** directly to the IOPN blockchain.
* **Wallet-Signed Broadcasts**: No mock sandbox keys. Deployment payload bytecode is compiled in the frontend and broadcasted directly via your browser wallet (MetaMask/OKX) with an authentic transaction signature.
* **Instant Dex Ready**: Newly deployed custom tokens automatically seed a standard default pool pair combined with **USDT** (pre-funded with standard liquidity reserves) to enable instantaneous trading.
* **Live Registry**: Tracks your newly deployed tokens in a dedicated dashboard list, generating actual transaction hash references linked to the network explorer.

### 2. 🔀 Advanced AMM Swap & Pool Reserve Center
* **Liquidity Reservoirs**: Real-time asset pool balances directly read from the IOPN liquidity router contracts.
* **Optimal Trade Swapping**: High-speed, gas-optimized rate math calculations with customizable slippage thresholds and automatic coin routing.
* **Active Pairs**: Dynamic interactive tabs for major token lists including `OPN`, `USDC`, `USDT`, `NBLAD`, and `DE4I`.

### 3. 🎯 Multi-Asset Contract Importer
Keep track of any custom token deployed anywhere on the network, even beyond this portal:
* **Contract Address Querying**: Input any external ERC-20 contract address. The portal queries name, symbol, and decimal precision live from the chain.
* **Local Persistence**: Successfully imported custom tokens are persisted to browser `localStorage` and monitored dynamically, maintaining full on-chain balance queries for your address inside the dashboard.

### 4. 🌾 Yield Farming & Automatic Harvesting
Stake stablecoins to generate dual-yield rewards powered by the automated MasterChef compiler:
* **Staking Pool Matrix**: Stake `USDC` / `USDT` to gain active shares.
* **Dual-Incentive Distributions**: Multiplies rewards in high-performance reward assets (`NBLAD` and `DE4I`).
* **Intelligent Auto-Harvest**: Set custom thresholds to trigger automatic automated reward harvesting directly to your address if criteria are met.

---

## 🌐 IOPN Testnet Network Configuration
To test the portal's on-chain operations, configure your Web3 browser wallet using the parameters below:

| Parameter | Value |
| :--- | :--- |
| **Network Name** | IOPN Testnet |
| **New RPC URL** | `https://testnet-rpc.iopn.tech` |
| **Chain ID** | `984` |
| **Currency Symbol** | `OPN` |
| **Block Explorer** | `https://testnet-explorer.iopn.tech` *(or configured network gateway)* |

---

## ⛓️ Smart Contract Addresses Registry

All integrated DeFi functions parse directly through the verified production contracts deployed on the IOPN Testnet:

* 🧭 **DEX Router Address**:  
  `0x49336536b03B8bBafdAb01a8CADA65123a803770`
* 🪙 **USDC Token (USD Stablecoin)**:  
  `0xAe69efe47ad3b3AEE2Be0c3A6eeA2bA9bc4a9284`
* 🪙 **USDT Token (Tether USD Stablecoin)**:  
  `0xd79Cf114127bE55bDD96b608662109B277DaBF8d`
* ⚡ **NBLAD Token (Nebula Blade Yield Asset)**:  
  `0x0258FaE58d52f8AD4508beEF1c40342b2E0CeD32`
* 🔮 **DE4I Token (Deity Quantum Yield Asset)**:  
  `0x605B6EDD6A38f1D66C32E2A1D5d91DC2e9F12e44`
* 👨‍🍳 **MasterChef Staking Engine**:  
  `0x49336536b03B8bBafdAb01a8CADA65123a803770`
* 🚰 **Network Token Faucet**:  
  `0x49336536b03B8bBafdAb01a8CADA65123a803770`

---

## 🛠️ Tech Stack & Architecture

This application acts as a progressive Web3 interface prioritizing lightweight footprints and fast client response:

* **Frontend Framework**: [React 18+](https://react.dev/) + [Vite](https://vitejs.dev/) for extremely fast hot development reload in ESM mode.
* **EVM Connector Library**: [Ethers.js v6](https://docs.ethers.org/v6/) using `BrowserProvider` context wrappers to communicate with injected user wallets.
* **CSS Typography & Theme Styling**: [Tailwind CSS v4](https://tailwindcss.com/) implementing a high-contrast Cyberpunk/Slate style theme with dynamic transitions.
* **Animations**: Powered by `motion` (imported from `motion/react`) for smooth accordion expansions and interactive transaction feedbacks.
* **State Engines**: Responsive state synchronizations mapped directly with block-height listeners ensuring exact balance updates.

---

## 💻 Local Development Setup

To run this portal on your machine, follow these steps:

### Prerequisites
* [Node.js](https://nodejs.org/) (version 18 or above recommended)
* [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
* [MetaMask](https://metamask.io/) or [OKX Web3 Wallet](https://www.okx.com/web3) extension installed on your web browser.

### 1. Clone the repository
```bash
git clone <your-repository-url>
cd myiopn-defi-portal
```

### 2. Install standard dependencies
```bash
npm install
```

### 3. Run development mode
```bash
npm run dev
```
Open your browser and navigate to `http://localhost:3000` or the port displayed on your terminal.

### 4. Compiling the application for production
```bash
npm run build
```
This builds static artifacts packed completely inside `dist/` ready to host on platforms like GitHub Pages, Vercel, Netlify, or Cloud Run containers.

---

## ⚡ Safe & Secure

* **Private Key Privacy**: This dashboard **NEVER** requests your raw seed phrase or private keys. Contract compilation, allowance approvals, swaps, staking, and custom token deployments are fully authorized natively via browser JSON-RPC provider calls requiring your explicitly clicked approval inside your Web3 application.
* **Data Privacy**: Custom imported token addresses are stored strictly in your browser client's secure `localStorage`—no secondary telemetry servers read or store your wallet history.

Enjoy your trading experience on the IOPN Testnet! 🌌🚀
