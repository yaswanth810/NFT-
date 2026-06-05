# SCAI NFT Marketplace

> A fully on-chain, non-custodial NFT Marketplace built on **SCAI Mainnet (Chain ID: 34)**  
> Built by [**Ether Authority**](https://etherauthority.io)

![Ether Authority](./frontend/public/ether-authority-logo.svg)

---

## 📋 Project Overview

A decentralized NFT marketplace where users can:
- **Mint** ERC-721 NFTs with IPFS metadata via Pinata
- **List** NFTs for sale in native SCAI tokens
- **Buy** listed NFTs with a transparent 2% marketplace fee
- **Cancel** active listings at any time
- **View** full on-chain transaction history per NFT

All smart contracts are deployed on **SCAI Mainnet** and all currency is denominated in **SCAI tokens** (not ETH).

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Smart Contracts | Solidity 0.8.20, OpenZeppelin v4.9.6 |
| Contract Framework | Hardhat |
| Blockchain | SCAI Mainnet (EVM-compatible, Chain ID 34) |
| Frontend | React 18 + Vite 5 |
| Styling | Tailwind CSS v3 |
| Routing | React Router v6 |
| Wallet | ethers.js v6 + MetaMask (window.ethereum) |
| IPFS Storage | Pinata (pinFileToIPFS + pinJSONToIPFS) |
| Deployment | Vercel (frontend) |

---

## 🌐 SCAI Mainnet Details

| Parameter | Value |
|---|---|
| **Network Name** | SCAI Mainnet |
| **Chain ID** | 34 (0x22) |
| **RPC URL** | https://mainnet-rpc.scai.network |
| **Explorer** | https://explorer.securechain.ai |
| **Currency** | SCAI |
| **Decimals** | 18 |

> MetaMask will be automatically prompted to add SCAI Mainnet when you connect your wallet.

---

## 📄 Deployed Contracts (SCAI Mainnet)

| Contract | Address | Explorer |
|---|---|---|
| **NFTMarketplace** (ERC-721) | `0x3c47a525EB1B5F470abc06A98829F078E302e245` | [View ↗](https://explorer.securechain.ai/address/0x3c47a525EB1B5F470abc06A98829F078E302e245) |
| **Marketplace** (Logic) | `0xE6d9eb0559db3f31Ce92C3886c75F208bb4f7e2C` | [View ↗](https://explorer.securechain.ai/address/0xE6d9eb0559db3f31Ce92C3886c75F208bb4f7e2C) |

> Deployment record saved in `deployments/deployedAddresses.json`

---

## 📁 Project Structure

```
nft-marketplace/
├── contracts/
│   ├── NFTMarketplace.sol      # ERC-721 token contract with mint fee
│   ├── Marketplace.sol         # Listing / buying / cancelling logic
│   └── MarketplaceNFT.sol      # Alternative ERC-721 with URI storage
├── scripts/
│   ├── deploy.js               # Deploys both contracts to SCAI Mainnet
│   ├── verify.js               # Contract verification / ABI export
│   └── interact.js             # Post-deploy interaction demo
├── test/
│   ├── NFTMarketplace.test.js  # ERC-721 token unit tests
│   └── marketplace.test.js     # Marketplace integration tests
├── deployments/
│   └── deployedAddresses.json  # Auto-updated after each deploy
├── hardhat.config.js
├── .env                        # PRIVATE_KEY, SCAI_RPC_URL
└── frontend/                   # React + Vite + Tailwind dApp
    ├── public/
    │   └── ether-authority-logo.svg
    ├── src/
    │   ├── App.jsx
    │   ├── constants/contracts.js   # ABIs + addresses + network config
    │   ├── context/WalletContext.jsx
    │   ├── hooks/useWallet.js       # MetaMask + SCAI network switching
    │   ├── utils/pinata.js          # IPFS upload utilities
    │   ├── utils/errors.js          # User-friendly error messages
    │   ├── components/
    │   │   ├── Navbar.jsx
    │   │   ├── Footer.jsx
    │   │   ├── WrongNetworkBanner.jsx
    │   │   ├── ErrorBoundary.jsx
    │   │   └── Toast.jsx
    │   └── pages/
    │       ├── Home.jsx             # Hero + live stats
    │       ├── Explore.jsx          # Browse all listings
    │       ├── Mint.jsx             # Pinata upload + mint
    │       ├── MyNFTs.jsx           # Owned NFTs + list/cancel
    │       └── NFTDetail.jsx        # Per-token detail + history
    ├── vercel.json
    └── .env                         # VITE_PINATA_API_KEY, VITE_PINATA_SECRET, VITE_PINATA_JWT
```

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js 18+
- MetaMask browser extension
- SCAI Mainnet tokens (for gas)
- Pinata account (free at [app.pinata.cloud](https://app.pinata.cloud))

### 1. Clone and install

```bash
git clone <your-repo-url>
cd nft-marketplace
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:
```env
PRIVATE_KEY=your_wallet_private_key
SCAI_RPC_URL=https://mainnet-rpc.scai.network
SCAI_EXPLORER_URL=https://explorer.securechain.ai
```

### 3. Compile contracts

```bash
npm run compile
```

### 4. Run tests (local Hardhat network)

```bash
npm test
```

### 5. Deploy to SCAI Mainnet

```bash
npm run deploy
```

Output saves addresses to `deployments/deployedAddresses.json`.

---

## 🖥️ Frontend Setup

```bash
cd frontend
npm install
```

Create `frontend/.env`:
```env
VITE_PINATA_API_KEY=your_pinata_api_key
VITE_PINATA_SECRET=your_pinata_secret
VITE_PINATA_JWT=your_pinata_jwt_token
```

Start the dev server:
```bash
npm run dev
# Opens at http://localhost:3000
```

---

## 🌍 Deploy Frontend to Vercel

### Option A — Vercel CLI

```bash
cd frontend
npm install -g vercel
vercel --prod
```

### Option B — Vercel Dashboard

1. Push repo to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import repo
3. Set **Root Directory** to `frontend`
4. Add environment variables in **Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `VITE_PINATA_API_KEY` | Your Pinata API Key |
| `VITE_PINATA_SECRET` | Your Pinata Secret |
| `VITE_PINATA_JWT` | Your Pinata JWT Token |

5. Click **Deploy**

> `vercel.json` already includes the SPA rewrite rule for React Router.

---

## 🔑 Smart Contract Interfaces

### NFTMarketplace (ERC-721)

```solidity
function mint(address to, string memory uri_) external payable returns (uint256 tokenId)
function mintFee() external view returns (uint256)
function totalMinted() external view returns (uint256)
function setMintFee(uint256 newFee) external onlyOwner
function withdrawFees() external onlyOwner nonReentrant
```

### Marketplace

```solidity
function listNFT(address nftContract, uint256 tokenId, uint256 price) external
function buyNFT(address nftContract, uint256 tokenId) external payable
function cancelListing(address nftContract, uint256 tokenId) external
function getListing(address nftContract, uint256 tokenId) external view returns (Listing)
function MARKETPLACE_FEE_BPS() external view returns (uint256)  // 200 = 2%
```

---

## 🧪 Test Coverage

```
NFTMarketplace — Deployment        5 tests
NFTMarketplace — Minting (free)    6 tests
NFTMarketplace — Minting (paid)    5 tests
NFTMarketplace — tokenURI storage  4 tests
NFTMarketplace — exists()          3 tests
NFTMarketplace — setMintFee        5 tests
NFTMarketplace — withdrawFees      6 tests
NFTMarketplace — ERC-721 standard  4 tests
Marketplace — Listing              ✓
Marketplace — Buying               ✓
Marketplace — Cancelling           ✓
Marketplace — Fee calculation      ✓
```

---

## 🔗 Links

| Resource | URL |
|---|---|
| SCAI Explorer | https://explorer.securechain.ai |
| SCAI RPC | https://mainnet-rpc.scai.network |
| NFTMarketplace Contract | https://explorer.securechain.ai/address/0x3c47a525EB1B5F470abc06A98829F078E302e245 |
| Marketplace Contract | https://explorer.securechain.ai/address/0xE6d9eb0559db3f31Ce92C3886c75F208bb4f7e2C |
| Ether Authority | https://etherauthority.io |
| Pinata IPFS | https://pinata.cloud |

---

## 🛡️ Security Notes

- **Never commit `.env` files** — both `.env` files are in `.gitignore`
- The private key in `.env` controls the deployer wallet — keep it secret
- Pinata JWT has an expiry date — rotate it periodically
- The marketplace uses `ReentrancyGuard` on all fund-transferring functions
- NFTs are escrowed in the Marketplace contract during listings (non-custodial from user perspective)

---

## 📜 License

MIT © [Ether Authority](https://etherauthority.io)
