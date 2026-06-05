// scripts/deploy.js
// ─────────────────────────────────────────────────────────────────────────────
//  Deployment script — NFTMarketplace.sol + Marketplace.sol
//  Target network : SCAI Mainnet (Chain ID: 34)
//
//  Run:
//    npx hardhat run scripts/deploy.js --network scai
//
//  Output:
//    • Console logs for both contract addresses + explorer links
//    • deployments/deployedAddresses.json  (created / updated)
// ─────────────────────────────────────────────────────────────────────────────

const { ethers, network, artifacts } = require("hardhat");
const fs   = require("fs");
const path = require("path");

// ── Config ────────────────────────────────────────────────────────────────────
const EXPLORER_BASE  = process.env.SCAI_EXPLORER_URL || "https://explorer.securechain.ai";
const DEPLOYMENTS_DIR = path.join(__dirname, "../deployments");
const OUTPUT_FILE     = path.join(DEPLOYMENTS_DIR, "deployedAddresses.json");

// ── Helpers ───────────────────────────────────────────────────────────────────
function explorerLink(address) {
  return `${EXPLORER_BASE}/address/${address}`;
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function saveAddresses(data) {
  ensureDir(DEPLOYMENTS_DIR);

  // Load existing file (if any) so we can merge / append entries
  let existing = [];
  if (fs.existsSync(OUTPUT_FILE)) {
    try { existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, "utf8")); }
    catch { existing = []; }
    if (!Array.isArray(existing)) existing = [existing]; // handle legacy single-object format
  }

  // Replace entry for this network+timestamp key or push new one
  existing.push(data);
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(existing, null, 2));
}

// ── Banner ────────────────────────────────────────────────────────────────────
function banner(text) {
  const line = "─".repeat(60);
  console.log(`\n${line}\n  ${text}\n${line}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  banner("NFT Marketplace — Deployment Script");

  // ── Pre-flight checks ───────────────────────────────────────────────────────
  const chainId   = Number((await ethers.provider.getNetwork()).chainId);
  const [deployer] = await ethers.getSigners();
  const balance    = await ethers.provider.getBalance(deployer.address);

  console.log(`  Network   : ${network.name}`);
  console.log(`  Chain ID  : ${chainId}`);
  console.log(`  Deployer  : ${deployer.address}`);
  console.log(`  Balance   : ${ethers.formatEther(balance)} SCAI`);

  if (network.name === "scai" && chainId !== 34) {
    throw new Error(`Chain ID mismatch — expected 34, got ${chainId}`);
  }

  // ── Deploy NFTMarketplace ────────────────────────────────────────────────────
  banner("1 / 2  →  Deploying NFTMarketplace.sol");

  const NFTMarketplaceFactory = await ethers.getContractFactory("NFTMarketplace");
  console.log("  Sending deployment transaction…");

  const nftMarketplace = await NFTMarketplaceFactory.deploy(
    "SCAI NFT Collection", // name
    "SCAI",                // symbol
    0n                     // mintFee — 0 = free minting
  );
  await nftMarketplace.waitForDeployment();

  const nftAddress = await nftMarketplace.getAddress();
  const nftTxHash  = nftMarketplace.deploymentTransaction().hash;

  console.log(`  ✅ NFTMarketplace deployed`);
  console.log(`     Address : ${nftAddress}`);
  console.log(`     Tx Hash : ${nftTxHash}`);
  console.log(`     Explorer: ${explorerLink(nftAddress)}`);

  // ── Deploy Marketplace ───────────────────────────────────────────────────────
  banner("2 / 2  →  Deploying Marketplace.sol");

  const MarketplaceFactory = await ethers.getContractFactory("Marketplace");
  console.log("  Sending deployment transaction…");

  const marketplace = await MarketplaceFactory.deploy();
  await marketplace.waitForDeployment();

  const marketplaceAddress = await marketplace.getAddress();
  const marketplaceTxHash  = marketplace.deploymentTransaction().hash;

  console.log(`  ✅ Marketplace deployed`);
  console.log(`     Address : ${marketplaceAddress}`);
  console.log(`     Tx Hash : ${marketplaceTxHash}`);
  console.log(`     Explorer: ${explorerLink(marketplaceAddress)}`);

  // ── Save deployedAddresses.json ──────────────────────────────────────────────
  banner("Saving deployment record");

  const record = {
    network:     "scai",
    chainId:     34,
    deployedAt:  new Date().toISOString(),
    deployer:    deployer.address,
    contracts: {
      NFTMarketplace: {
        address: nftAddress,
        txHash:  nftTxHash,
        explorer: explorerLink(nftAddress),
        constructorArgs: ["SCAI NFT Collection", "SCAI", "0"],
      },
      Marketplace: {
        address: marketplaceAddress,
        txHash:  marketplaceTxHash,
        explorer: explorerLink(marketplaceAddress),
        constructorArgs: [],
      },
    },
  };

  saveAddresses(record);
  console.log(`  📄 Saved → deployments/deployedAddresses.json`);

  // ── Final summary ────────────────────────────────────────────────────────────
  banner("Deployment Complete — Summary");
  console.log(`  NFTMarketplace : ${nftAddress}`);
  console.log(`  Marketplace    : ${marketplaceAddress}`);
  console.log();
  console.log("  Explorer links:");
  console.log(`    NFTMarketplace → ${explorerLink(nftAddress)}`);
  console.log(`    Marketplace    → ${explorerLink(marketplaceAddress)}`);
  console.log();
  console.log("  Next step — verify contracts:");
  console.log("    npx hardhat run scripts/verify.js --network scai");
  console.log();
}

main().catch((err) => {
  console.error("\n❌ Deployment failed:", err.message || err);
  process.exitCode = 1;
});
