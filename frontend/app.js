// frontend/app.js
// ─────────────────────────────────────────────────────────────────────────────
//  SCAI NFT Marketplace — Frontend dApp
//  Contracts : NFTMarketplace.sol (ERC-721) + Marketplace.sol (marketplace logic)
//  Network   : SCAI Mainnet (Chain ID: 34)
//  ethers.js : v6 (loaded via CDN)
// ─────────────────────────────────────────────────────────────────────────────

// ── Contract Addresses ────────────────────────────────────────────────────────
// Populated automatically from deployments/deployedAddresses.json after deploy.
// You can also paste the addresses here manually.
const CONTRACT_ADDRESSES = {
  NFTMarketplace: "0x3c47a525EB1B5F470abc06A98829F078E302e245",  // SCAI Mainnet — deployed 2026-06-05
  Marketplace:    "0xE6d9eb0559db3f31Ce92C3886c75F208bb4f7e2C",  // SCAI Mainnet — deployed 2026-06-05
};

// ── SCAI Network Config ───────────────────────────────────────────────────────
const SCAI_NETWORK = {
  chainId:           "0x22",   // 34 decimal
  chainName:         "SCAI Mainnet",
  nativeCurrency:    { name: "SCAI", symbol: "SCAI", decimals: 18 },
  rpcUrls:           ["https://mainnet-rpc.scai.network"],
  blockExplorerUrls: ["https://explorer.securechain.ai"],
};

const EXPLORER_BASE = "https://explorer.securechain.ai";

// ── ABIs (human-readable — matches NFTMarketplace.sol + Marketplace.sol) ──────

/** NFTMarketplace.sol — ERC-721 with open mint */
const NFT_ABI = [
  // Core ERC-721
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function approve(address to, uint256 tokenId) external",
  "function getApproved(uint256 tokenId) external view returns (address)",
  "function isApprovedForAll(address owner, address operator) external view returns (bool)",
  "function setApprovalForAll(address operator, bool approved) external",
  // Custom
  "function mint(address to, string memory tokenURI) external payable returns (uint256)",
  "function mintFee() external view returns (uint256)",
  "function totalMinted() external view returns (uint256)",
  "function exists(uint256 tokenId) external view returns (bool)",
  "function setMintFee(uint256 newFee) external",
  "function withdrawFees() external",
  // Events
  "event Minted(address indexed to, uint256 indexed tokenId, string tokenURI, uint256 feePaid)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

/** Marketplace.sol — list / buy / cancel by (nftContract, tokenId) */
const MARKETPLACE_ABI = [
  // Core
  "function listNFT(address nftContract, uint256 tokenId, uint256 price) external",
  "function buyNFT(address nftContract, uint256 tokenId) external payable",
  "function cancelListing(address nftContract, uint256 tokenId) external",
  "function updatePrice(address nftContract, uint256 tokenId, uint256 newPrice) external",
  // Views
  "function getListing(address nftContract, uint256 tokenId) external view returns (tuple(address seller, uint256 price, bool active))",
  "function isListed(address nftContract, uint256 tokenId) external view returns (bool)",
  "function calculateFee(uint256 price) external pure returns (uint256)",
  "function MARKETPLACE_FEE_BPS() external view returns (uint256)",
  // Events
  "event Listed(address indexed seller, address indexed nftContract, uint256 indexed tokenId, uint256 price)",
  "event Sold(address indexed buyer, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 price, uint256 marketplaceFee, uint256 sellerProceeds)",
  "event Cancelled(address indexed seller, address indexed nftContract, uint256 indexed tokenId)",
  "event PriceUpdated(address indexed seller, address indexed nftContract, uint256 indexed tokenId, uint256 oldPrice, uint256 newPrice)",
];

// ── App State ─────────────────────────────────────────────────────────────────
let provider    = null;
let signer      = null;
let nftContract = null;   // NFTMarketplace instance
let marketplace = null;   // Marketplace instance
let userAddress = null;
let statusTimer = null;

// Tracks active listings: Map<`${nftAddr}-${tokenId}`, listingObj>
const activeListings = new Map();

// ── DOM Refs ──────────────────────────────────────────────────────────────────
const connectBtn     = document.getElementById("connectBtn");
const walletBar      = document.getElementById("walletBar");
const walletAddress  = document.getElementById("walletAddress");
const walletBalance  = document.getElementById("walletBalance");
const statusMsg      = document.getElementById("statusMsg");
const mintBtn        = document.getElementById("mintBtn");
const mintTokenURI   = document.getElementById("mintTokenURI");
const listBtn        = document.getElementById("listBtn");
const listTokenId    = document.getElementById("listTokenId");
const listPrice      = document.getElementById("listPrice");
const listingsGrid   = document.getElementById("listingsGrid");
const myListingsGrid = document.getElementById("myListingsGrid");
const refreshBtn     = document.getElementById("refreshBtn");
const statListings   = document.getElementById("statListings");
const statVolume     = document.getElementById("statVolume");

// ── Utility Helpers ───────────────────────────────────────────────────────────

function shortenAddr(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatEther(wei) {
  try { return ethers.formatEther(wei); }
  catch { return (Number(wei) / 1e18).toFixed(6); }
}

function explorerTxLink(hash) {
  return `${EXPLORER_BASE}/tx/${hash}`;
}

function showStatus(message, type = "info", durationMs = 5000) {
  clearTimeout(statusTimer);
  statusMsg.textContent = message;
  statusMsg.className   = `status-msg ${type}`;
  statusMsg.classList.remove("hidden");
  if (durationMs > 0) {
    statusTimer = setTimeout(() => statusMsg.classList.add("hidden"), durationMs);
  }
}

function setLoading(btn, isLoading, originalText = "") {
  if (isLoading) {
    btn.disabled  = true;
    btn.innerHTML = `<span class="spinner"></span> Processing…`;
  } else {
    btn.disabled  = false;
    btn.textContent = originalText;
  }
}

function requireContracts() {
  if (!CONTRACT_ADDRESSES.NFTMarketplace || !CONTRACT_ADDRESSES.Marketplace) {
    showStatus(
      "Contract addresses not set. Edit CONTRACT_ADDRESSES in app.js after deploying.",
      "error",
      0
    );
    return false;
  }
  return true;
}

// ── Network ───────────────────────────────────────────────────────────────────

async function ensureSCAINetwork() {
  const chainId = await window.ethereum.request({ method: "eth_chainId" });
  if (chainId === SCAI_NETWORK.chainId) return;

  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: SCAI_NETWORK.chainId }],
    });
  } catch (err) {
    // 4902 = chain not added yet
    if (err.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [SCAI_NETWORK],
      });
    } else {
      throw err;
    }
  }
}

// ── Wallet Connection ─────────────────────────────────────────────────────────

async function connectWallet() {
  if (!window.ethereum) {
    showStatus("MetaMask not detected. Please install MetaMask first.", "error", 0);
    return;
  }

  try {
    showStatus("Connecting wallet…", "pending", 0);
    await ensureSCAINetwork();

    provider    = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer      = await provider.getSigner();
    userAddress = await signer.getAddress();

    // Instantiate contracts if addresses are configured
    if (CONTRACT_ADDRESSES.NFTMarketplace) {
      nftContract = new ethers.Contract(CONTRACT_ADDRESSES.NFTMarketplace, NFT_ABI, signer);
    }
    if (CONTRACT_ADDRESSES.Marketplace) {
      marketplace = new ethers.Contract(CONTRACT_ADDRESSES.Marketplace, MARKETPLACE_ABI, signer);
    }

    // Update header UI
    const balance = await provider.getBalance(userAddress);
    walletAddress.textContent = shortenAddr(userAddress);
    walletBalance.textContent = parseFloat(formatEther(balance)).toFixed(4);
    walletBar.classList.remove("hidden");

    connectBtn.textContent = "Connected ✓";
    connectBtn.classList.replace("btn-primary", "btn-outline");

    showStatus(`Wallet connected: ${shortenAddr(userAddress)}`, "success");

    await refreshAllData();
  } catch (err) {
    console.error(err);
    showStatus(err.message || "Connection failed.", "error");
  }
}

// ── Mint NFT ──────────────────────────────────────────────────────────────────

async function handleMint() {
  if (!signer)         { showStatus("Connect your wallet first.", "error"); return; }
  if (!requireContracts()) return;
  if (!nftContract)    { showStatus("NFT contract not initialised.", "error"); return; }

  const uri = mintTokenURI.value.trim();
  if (!uri) { showStatus("Enter a Token URI (ipfs://… or https://…).", "error"); return; }

  setLoading(mintBtn, true);
  try {
    const fee = await nftContract.mintFee();
    showStatus("Waiting for wallet approval…", "pending", 0);

    // mint(address to, string memory tokenURI)
    const tx = await nftContract.mint(userAddress, uri, { value: fee });
    showStatus(`Tx sent — ${shortenAddr(tx.hash)}`, "pending", 0);

    const receipt = await tx.wait();

    // Parse the Minted event to get the new tokenId
    let tokenId = "?";
    for (const log of receipt.logs) {
      try {
        const parsed = nftContract.interface.parseLog(log);
        if (parsed?.name === "Minted") tokenId = parsed.args.tokenId.toString();
      } catch {}
    }

    showStatus(`✅ NFT #${tokenId} minted! Tx: ${shortenAddr(receipt.hash)}`, "success");
    mintTokenURI.value = "";
  } catch (err) {
    console.error(err);
    showStatus(err.reason || err.message || "Mint failed.", "error");
  } finally {
    setLoading(mintBtn, false, "Mint NFT");
  }
}

// ── List NFT ──────────────────────────────────────────────────────────────────

async function handleList() {
  if (!signer)         { showStatus("Connect your wallet first.", "error"); return; }
  if (!requireContracts()) return;
  if (!nftContract || !marketplace) { showStatus("Contracts not initialised.", "error"); return; }

  const tokenId  = listTokenId.value.trim();
  const priceVal = listPrice.value.trim();
  if (!tokenId || !priceVal) { showStatus("Enter both Token ID and Price.", "error"); return; }

  setLoading(listBtn, true, "Approve & List");
  try {
    const tokenIdBig     = BigInt(tokenId);
    const priceBig       = ethers.parseEther(priceVal);
    const nftAddress     = await nftContract.getAddress();
    const marketplaceAddr = await marketplace.getAddress();

    // ── Step 1: Approve marketplace to transfer this token ───────────────────
    showStatus("Step 1/2 — Approving marketplace…", "pending", 0);
    const approveTx = await nftContract.approve(marketplaceAddr, tokenIdBig);
    await approveTx.wait();

    // ── Step 2: listNFT(nftContract, tokenId, price) ─────────────────────────
    showStatus("Step 2/2 — Listing NFT…", "pending", 0);
    const listTx  = await marketplace.listNFT(nftAddress, tokenIdBig, priceBig);
    const receipt = await listTx.wait();

    showStatus(`✅ NFT #${tokenId} listed at ${priceVal} SCAI! Tx: ${shortenAddr(receipt.hash)}`, "success");
    listTokenId.value = "";
    listPrice.value   = "";

    await refreshAllData();
  } catch (err) {
    console.error(err);
    showStatus(err.reason || err.message || "Listing failed.", "error");
  } finally {
    setLoading(listBtn, false, "Approve & List");
  }
}

// ── Buy NFT ───────────────────────────────────────────────────────────────────

async function handleBuy(nftAddress, tokenId, price) {
  if (!signer || !marketplace) { showStatus("Connect your wallet first.", "error"); return; }

  const btnId = `buy-btn-${nftAddress}-${tokenId}`;
  const btn   = document.getElementById(btnId);
  if (btn) setLoading(btn, true);

  try {
    showStatus(`Buying NFT #${tokenId}…`, "pending", 0);

    // buyNFT(address nftContract, uint256 tokenId) payable
    const tx      = await marketplace.buyNFT(nftAddress, BigInt(tokenId), { value: price });
    showStatus(`Tx sent — ${shortenAddr(tx.hash)}`, "pending", 0);
    const receipt = await tx.wait();

    showStatus(`✅ NFT #${tokenId} purchased! Tx: ${shortenAddr(receipt.hash)}`, "success");
    await refreshAllData();
  } catch (err) {
    console.error(err);
    showStatus(err.reason || err.message || "Purchase failed.", "error");
  } finally {
    if (btn) setLoading(btn, false, "Buy");
  }
}

// ── Cancel Listing ────────────────────────────────────────────────────────────

async function handleCancel(nftAddress, tokenId) {
  if (!signer || !marketplace) { showStatus("Connect your wallet first.", "error"); return; }

  const btnId = `cancel-btn-${nftAddress}-${tokenId}`;
  const btn   = document.getElementById(btnId);
  if (btn) setLoading(btn, true);

  try {
    showStatus(`Cancelling listing for NFT #${tokenId}…`, "pending", 0);

    // cancelListing(address nftContract, uint256 tokenId)
    const tx      = await marketplace.cancelListing(nftAddress, BigInt(tokenId));
    const receipt = await tx.wait();

    showStatus(`✅ Listing cancelled. Tx: ${shortenAddr(receipt.hash)}`, "success");
    await refreshAllData();
  } catch (err) {
    console.error(err);
    showStatus(err.reason || err.message || "Cancellation failed.", "error");
  } finally {
    if (btn) setLoading(btn, false, "Cancel");
  }
}

// ── Load Listings via Past Events ─────────────────────────────────────────────
// Marketplace.sol is keyed by (nftContract, tokenId) — not by a listing ID.
// We reconstruct the active listing set from Listed / Sold / Cancelled events.

async function fetchActiveListings() {
  if (!marketplace || !provider) return [];

  try {
    const nftAddress = CONTRACT_ADDRESSES.NFTMarketplace;
    const mkAddress  = CONTRACT_ADDRESSES.Marketplace;

    // Query Listed events (filter by our NFTMarketplace contract for simplicity)
    const filter   = marketplace.filters.Listed(null, nftAddress);
    const events   = await marketplace.queryFilter(filter, 0, "latest");

    // Build a set of active listings by checking current state on-chain
    const seen = new Set();
    const active = [];

    for (const ev of events) {
      const { tokenId } = ev.args;
      const key = `${nftAddress}-${tokenId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      try {
        const listing = await marketplace.getListing(nftAddress, tokenId);
        if (listing.active) {
          active.push({
            nftAddress,
            tokenId: tokenId.toString(),
            seller:  listing.seller,
            price:   listing.price,
          });
        }
      } catch {}
    }

    return active;
  } catch (err) {
    console.error("fetchActiveListings:", err);
    return [];
  }
}

async function loadAllListings() {
  if (!marketplace) {
    listingsGrid.innerHTML = '<p class="placeholder-text">Connect your wallet to browse listings.</p>';
    statListings.textContent = "—";
    return;
  }

  listingsGrid.innerHTML = '<p class="placeholder-text">Loading listings…</p>';

  const active = await fetchActiveListings();
  statListings.textContent = active.length;
  activeListings.clear();
  active.forEach(l => activeListings.set(`${l.nftAddress}-${l.tokenId}`, l));

  if (active.length === 0) {
    listingsGrid.innerHTML = '<p class="placeholder-text">No active listings yet. Be the first to list an NFT!</p>';
    return;
  }

  listingsGrid.innerHTML = active.map(l => renderCard(l, false)).join("");

  active.forEach(l => {
    const btn = document.getElementById(`buy-btn-${l.nftAddress}-${l.tokenId}`);
    if (btn) btn.addEventListener("click", () => handleBuy(l.nftAddress, l.tokenId, l.price));
  });
}

async function loadMyListings() {
  if (!marketplace || !userAddress) {
    myListingsGrid.innerHTML = '<p class="placeholder-text">Connect your wallet to see your listings.</p>';
    return;
  }

  const mine = [...activeListings.values()].filter(
    l => l.seller.toLowerCase() === userAddress.toLowerCase()
  );

  if (mine.length === 0) {
    myListingsGrid.innerHTML = '<p class="placeholder-text">You have no active listings.</p>';
    return;
  }

  myListingsGrid.innerHTML = mine.map(l => renderCard(l, true)).join("");

  mine.forEach(l => {
    const btn = document.getElementById(`cancel-btn-${l.nftAddress}-${l.tokenId}`);
    if (btn) btn.addEventListener("click", () => handleCancel(l.nftAddress, l.tokenId));
  });
}

async function refreshAllData() {
  await loadAllListings();
  await loadMyListings();

  // Refresh wallet balance
  if (provider && userAddress) {
    const balance = await provider.getBalance(userAddress);
    walletBalance.textContent = parseFloat(formatEther(balance)).toFixed(4);
  }
}

// ── NFT Card Renderer ─────────────────────────────────────────────────────────

function renderCard(item, isOwner = false) {
  const priceEth = formatEther(item.price);
  const isMine   = userAddress && item.seller.toLowerCase() === userAddress.toLowerCase();
  const cardKey  = `${item.nftAddress}-${item.tokenId}`;

  const actionBtn = (isMine || isOwner)
    ? `<button id="cancel-btn-${cardKey}" class="btn btn-danger btn-sm">Cancel</button>`
    : `<button id="buy-btn-${cardKey}" class="btn btn-primary btn-sm">Buy</button>`;

  return `
    <div class="nft-card" id="card-${cardKey}">
      <div class="nft-card-image">◈</div>
      <div class="nft-card-body">
        <p class="nft-card-id">Token #${item.tokenId}</p>
        <h3 class="nft-card-title">NFT #${item.tokenId}</h3>
        <p class="nft-card-seller" title="${item.seller}">Seller: ${shortenAddr(item.seller)}</p>
        <div class="nft-card-price">
          <span class="amount">${parseFloat(priceEth).toFixed(4)}</span>
          <span class="unit">SCAI</span>
        </div>
        <div class="nft-card-actions">${actionBtn}</div>
      </div>
    </div>`;
}

// ── Event Listeners ───────────────────────────────────────────────────────────

connectBtn.addEventListener("click", connectWallet);
mintBtn.addEventListener("click", handleMint);
listBtn.addEventListener("click", handleList);
refreshBtn.addEventListener("click", async () => {
  showStatus("Refreshing…", "info", 2000);
  await refreshAllData();
});

// Reload on account / network change
if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged",    () => window.location.reload());
}

// ── Load ethers.js v6 from CDN, then auto-load deployed addresses ─────────────

(function bootstrap() {
  const script = document.createElement("script");
  script.src = "https://cdnjs.cloudflare.com/ajax/libs/ethers/6.11.1/ethers.umd.min.js";
  script.crossOrigin = "anonymous";

  script.onload = async () => {
    console.log("✅ ethers.js v6 loaded");

    // Attempt to auto-load deployed addresses from deployedAddresses.json
    // (only works when served via a local server, not file://)
    try {
      const resp = await fetch("../deployments/deployedAddresses.json");
      if (resp.ok) {
        const records = await resp.json();
        const list = Array.isArray(records) ? records : [records];
        const latest = list.filter(r => r.network === "scai").at(-1);
        if (latest?.contracts) {
          if (latest.contracts.NFTMarketplace?.address)
            CONTRACT_ADDRESSES.NFTMarketplace = latest.contracts.NFTMarketplace.address;
          if (latest.contracts.Marketplace?.address)
            CONTRACT_ADDRESSES.Marketplace = latest.contracts.Marketplace.address;
          console.log("📄 Loaded deployed addresses from deployedAddresses.json");
          console.log("   NFTMarketplace:", CONTRACT_ADDRESSES.NFTMarketplace);
          console.log("   Marketplace   :", CONTRACT_ADDRESSES.Marketplace);
        }
      }
    } catch {
      console.info("ℹ️  Could not auto-load deployedAddresses.json — set addresses manually.");
    }
  };

  script.onerror = () =>
    showStatus("Failed to load ethers.js — check your internet connection.", "error", 0);

  document.head.appendChild(script);
})();
