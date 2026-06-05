// scripts/interact.js
// ─────────────────────────────────────────────────────────────────────────────
//  Post-deployment interaction script
//  Demonstrates: mint → approve → listNFT → getListing → calculateFee
//
//  Run against SCAI Mainnet:
//    npx hardhat run scripts/interact.js --network scai
//
//  Run against local Hardhat node (for testing):
//    npx hardhat node                                          (terminal 1)
//    npx hardhat run scripts/interact.js --network localhost   (terminal 2)
//
//  Reads deployed addresses from deployments/deployedAddresses.json.
//  Edit DEMO_PRICE to change the listing price used in the demo.
// ─────────────────────────────────────────────────────────────────────────────

const { ethers, network } = require("hardhat");
const fs   = require("fs");
const path = require("path");

// ── Config ────────────────────────────────────────────────────────────────────
const ADDRESSES_FILE = path.join(__dirname, "../deployments/deployedAddresses.json");
const EXPLORER_BASE  = process.env.SCAI_EXPLORER_URL || "https://explorer.securechain.ai";
const DEMO_PRICE     = ethers.parseEther("5");       // 5 SCAI listing price
const DEMO_TOKEN_URI = "ipfs://QmDemoNFTMetadata";   // metadata URI for the demo mint

// Live deployed addresses on SCAI Mainnet (Chain ID: 34) — 2026-06-05
//   NFTMarketplace : 0x3c47a525EB1B5F470abc06A98829F078E302e245
//   Marketplace    : 0xE6d9eb0559db3f31Ce92C3886c75F208bb4f7e2C

// ── Helpers ───────────────────────────────────────────────────────────────────
function banner(text) {
  const line = "─".repeat(60);
  console.log(`\n${line}\n  ${text}\n${line}`);
}

function explorerAddr(addr) { return `${EXPLORER_BASE}/address/${addr}`; }
function explorerTx(hash)   { return `${EXPLORER_BASE}/tx/${hash}`; }

function loadAddresses() {
  if (!fs.existsSync(ADDRESSES_FILE)) {
    throw new Error(
      "deployedAddresses.json not found.\n" +
      "Run deploy.js first:\n" +
      "  npx hardhat run scripts/deploy.js --network scai"
    );
  }
  const all     = JSON.parse(fs.readFileSync(ADDRESSES_FILE, "utf8"));
  const records = Array.isArray(all) ? all : [all];

  // Prefer a record matching the current network; fall back to the last entry
  const match = records.filter(r => r.network === network.name);
  const record = match.length ? match[match.length - 1] : records[records.length - 1];

  if (!record?.contracts?.NFTMarketplace?.address || !record?.contracts?.Marketplace?.address) {
    throw new Error("Incomplete deployment record. Re-run deploy.js.");
  }
  return record;
}

// ── ABIs ──────────────────────────────────────────────────────────────────────
const NFT_ABI = [
  "function mint(address to, string memory tokenURI) external payable returns (uint256)",
  "function mintFee() external view returns (uint256)",
  "function totalMinted() external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function approve(address to, uint256 tokenId) external",
  "event Minted(address indexed to, uint256 indexed tokenId, string tokenURI, uint256 feePaid)",
];

const MARKETPLACE_ABI = [
  "function listNFT(address nftContract, uint256 tokenId, uint256 price) external",
  "function buyNFT(address nftContract, uint256 tokenId) external payable",
  "function cancelListing(address nftContract, uint256 tokenId) external",
  "function getListing(address nftContract, uint256 tokenId) external view returns (tuple(address seller, uint256 price, bool active))",
  "function calculateFee(uint256 price) external pure returns (uint256)",
  "function isListed(address nftContract, uint256 tokenId) external view returns (bool)",
  "function MARKETPLACE_FEE_BPS() external view returns (uint256)",
  "event Listed(address indexed seller, address indexed nftContract, uint256 indexed tokenId, uint256 price)",
  "event Sold(address indexed buyer, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 price, uint256 marketplaceFee, uint256 sellerProceeds)",
];

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  banner("NFT Marketplace — Interaction Script");

  // ── Load signers & deployment record ──────────────────────────────────────
  const signers = await ethers.getSigners();
  const seller  = signers[0];
  const buyer   = signers.length > 1 ? signers[1] : signers[0];

  const record          = loadAddresses();
  const nftAddress      = record.contracts.NFTMarketplace.address;
  const marketplaceAddr = record.contracts.Marketplace.address;

  console.log(`  Network         : ${network.name}`);
  console.log(`  NFTMarketplace  : ${nftAddress}`);
  console.log(`  Marketplace     : ${marketplaceAddr}`);
  console.log(`  Seller (signer) : ${seller.address}`);
  console.log(`  Buyer           : ${buyer.address}`);

  // ── Connect contracts ──────────────────────────────────────────────────────
  const nft  = new ethers.Contract(nftAddress, NFT_ABI, seller);
  const mk   = new ethers.Contract(marketplaceAddr, MARKETPLACE_ABI, seller);

  // ── 1. Read on-chain state ─────────────────────────────────────────────────
  banner("Step 1 — Read Contract State");

  const mintFee  = await nft.mintFee();
  const feeBps   = await mk.MARKETPLACE_FEE_BPS();
  const minted   = await nft.totalMinted();

  console.log(`  Mint fee        : ${ethers.formatEther(mintFee)} SCAI`);
  console.log(`  Marketplace fee : ${feeBps} bps (${Number(feeBps) / 100}%)`);
  console.log(`  Total minted    : ${minted} tokens`);

  // ── 2. Mint a new NFT ──────────────────────────────────────────────────────
  banner("Step 2 — Mint NFT");
  console.log(`  Minting to  : ${seller.address}`);
  console.log(`  Token URI   : ${DEMO_TOKEN_URI}`);
  console.log(`  Fee paid    : ${ethers.formatEther(mintFee)} SCAI`);

  const mintTx      = await nft.mint(seller.address, DEMO_TOKEN_URI, { value: mintFee });
  console.log(`  Tx sent     : ${explorerTx(mintTx.hash)}`);
  const mintReceipt = await mintTx.wait();

  // Parse the Minted event to get the real tokenId
  let tokenId = null;
  for (const log of mintReceipt.logs) {
    try {
      const parsed = nft.interface.parseLog(log);
      if (parsed?.name === "Minted") {
        tokenId = parsed.args.tokenId;
        break;
      }
    } catch {}
  }

  if (tokenId === null) throw new Error("Could not parse Minted event — check ABI.");

  console.log(`  ✅ Minted token #${tokenId}`);
  console.log(`     Owner      : ${await nft.ownerOf(tokenId)}`);
  console.log(`     Token URI  : ${await nft.tokenURI(tokenId)}`);

  // ── 3. Approve Marketplace to transfer the token ───────────────────────────
  banner("Step 3 — Approve Marketplace");
  const approveTx = await nft.approve(marketplaceAddr, tokenId);
  await approveTx.wait();
  console.log(`  ✅ Marketplace approved to transfer token #${tokenId}`);

  // ── 4. List the NFT ────────────────────────────────────────────────────────
  banner("Step 4 — List NFT");
  console.log(`  Listing token #${tokenId} at ${ethers.formatEther(DEMO_PRICE)} SCAI`);

  const listTx      = await mk.listNFT(nftAddress, tokenId, DEMO_PRICE);
  console.log(`  Tx sent       : ${explorerTx(listTx.hash)}`);
  const listReceipt = await listTx.wait();
  console.log(`  ✅ NFT listed`);

  // ── 5. Read the listing ────────────────────────────────────────────────────
  banner("Step 5 — Read Listing via getListing()");

  const listing = await mk.getListing(nftAddress, tokenId);
  console.log(`  Listing.seller : ${listing.seller}`);
  console.log(`  Listing.price  : ${ethers.formatEther(listing.price)} SCAI`);
  console.log(`  Listing.active : ${listing.active}`);

  const fee            = await mk.calculateFee(listing.price);
  const sellerProceeds = listing.price - fee;
  console.log(`  Fee (2%)       : ${ethers.formatEther(fee)} SCAI`);
  console.log(`  Seller gets    : ${ethers.formatEther(sellerProceeds)} SCAI`);

  // ── 6. Buy the NFT (buyer account) ────────────────────────────────────────
  // Only run this step when there's a distinct buyer account and sufficient balance
  const buyerBalance = await ethers.provider.getBalance(buyer.address);

  if (buyer.address !== seller.address && buyerBalance >= listing.price) {
    banner("Step 6 — Buy NFT");

    const mkAsBuyer = mk.connect(buyer);
    console.log(`  Buyer         : ${buyer.address}`);
    console.log(`  Paying        : ${ethers.formatEther(listing.price)} SCAI`);

    const buyTx      = await mkAsBuyer.buyNFT(nftAddress, tokenId, { value: listing.price });
    console.log(`  Tx sent       : ${explorerTx(buyTx.hash)}`);
    await buyTx.wait();

    console.log(`  ✅ Purchase complete`);
    console.log(`     New owner  : ${await nft.ownerOf(tokenId)}`);

    const updatedListing = await mk.getListing(nftAddress, tokenId);
    console.log(`     Listing active: ${updatedListing.active}`);
  } else {
    banner("Step 6 — Buy NFT (SKIPPED)");
    console.log("  Skipped: either buyer === seller or insufficient buyer balance.");
    console.log("  To cancel the demo listing:");
    console.log(`    await marketplace.cancelListing("${nftAddress}", ${tokenId})`);
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  banner("Interaction Script Complete ✅");
  console.log(`  NFTMarketplace  : ${explorerAddr(nftAddress)}`);
  console.log(`  Marketplace     : ${explorerAddr(marketplaceAddr)}`);
  console.log();
}

main().catch((err) => {
  console.error("\n❌ Interaction script failed:", err.message || err);
  process.exitCode = 1;
});
