// src/pages/Explore.jsx
// ─────────────────────────────────────────────────────────────────────────────
//  Explore — Browse all active NFT listings from Marketplace.sol on SCAI Mainnet
//
//  Flow:
//  1. On mount, create a read-only JsonRpcProvider → Marketplace contract
//  2. queryFilter(Listed) → deduplicate by (nftContract, tokenId)
//  3. getListing() → filter active=true
//  4. tokenURI() → fetch IPFS metadata (name, description, image CID)
//  5. Render cards; sort by price / time
//  6. Buy click → confirm modal → buyNFT() with signer → toast
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import { useWalletContext } from "../context/WalletContext";
import {
  CONTRACT_ADDRESSES, MARKETPLACE_ABI, NFT_ABI,
  EXPLORER_BASE, SCAI_NETWORK,
} from "../constants/contracts";

// ── Helpers ────────────────────────────────────────────────────────────────────

const RPC_PROVIDER = new ethers.JsonRpcProvider(SCAI_NETWORK.rpcUrls[0]);

function shorten(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";
}

function formatSCAI(wei) {
  try { return parseFloat(ethers.formatEther(wei)).toFixed(4); }
  catch { return "0.0000"; }
}

/** Resolve ipfs:// → HTTPS gateway; pass-through for https:// */
function resolveImage(url) {
  if (!url) return null;
  if (url.startsWith("ipfs://")) {
    return `https://gateway.pinata.cloud/ipfs/${url.slice(7)}`;
  }
  return url;
}

/** Fetch JSON metadata from tokenURI (handles ipfs:// and https://) */
async function fetchMetadata(uri) {
  try {
    const url = uri.startsWith("ipfs://")
      ? `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}`
      : uri;
    const res  = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

// ── Skeleton card ─────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="glass-card overflow-hidden">
      <div className="skeleton aspect-square w-full" />
      <div className="p-4 space-y-2.5">
        <div className="skeleton h-4 rounded-full w-3/4" />
        <div className="skeleton h-3 rounded-full w-1/2" />
        <div className="skeleton h-8 rounded-lg w-full mt-3" />
      </div>
    </div>
  );
}

// ── NFT Card ──────────────────────────────────────────────────────────────────

function NFTCard({ listing, onBuy, myAddress }) {
  const [imgError, setImgError] = useState(false);
  const isMine = myAddress && listing.seller.toLowerCase() === myAddress.toLowerCase();

  return (
    <div className="nft-card group animate-fade-in">
      {/* Image — clickable to detail page */}
      <Link to={`/nft/${listing.tokenId}`} className="block aspect-square overflow-hidden bg-scai-bg2 relative">
        {listing.imageUrl && !imgError ? (
          <img
            src={listing.imageUrl}
            alt={listing.name || `NFT #${listing.tokenId}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl text-scai-primary/30">
            ◈
          </div>
        )}
        {/* Price pill */}
        <div className="absolute bottom-2 left-2 bg-scai-bg/80 backdrop-blur-sm border border-white/10 rounded-full px-2.5 py-1 text-xs font-bold text-white">
          {formatSCAI(listing.price)} SCAI
        </div>
      </Link>

      {/* Body */}
      <div className="p-4">
        <p className="text-[11px] text-scai-muted font-mono mb-1">Token #{listing.tokenId}</p>
        <h3 className="font-semibold text-scai-text text-sm leading-snug line-clamp-1 mb-0.5">
          {listing.name || `NFT #${listing.tokenId}`}
        </h3>
        <p className="text-xs text-scai-muted line-clamp-2 mb-3 min-h-[2rem]">
          {listing.description || "No description"}
        </p>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] text-scai-muted uppercase tracking-wider">Seller</p>
            <a
              href={`${EXPLORER_BASE}/address/${listing.seller}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-scai-label hover:text-scai-plit transition-colors"
            >
              {isMine ? "You" : shorten(listing.seller)}
            </a>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-scai-muted uppercase tracking-wider">Price</p>
            <p className="text-sm font-bold text-scai-plit">{formatSCAI(listing.price)} SCAI</p>
          </div>
        </div>

        {isMine ? (
          <button disabled className="w-full btn-outline opacity-40 cursor-not-allowed text-xs">
            Your Listing
          </button>
        ) : (
          <button
            onClick={() => onBuy(listing)}
            className="w-full btn-primary text-xs"
          >
            Buy Now
          </button>
        )}
      </div>
    </div>
  );
}

// ── Buy Confirm Modal ─────────────────────────────────────────────────────────

function BuyModal({ listing, onConfirm, onCancel, isPending }) {
  if (!listing) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="glass-card border border-white/10 w-full max-w-md p-6 animate-slide-up">
        <h2 className="text-lg font-bold text-scai-text mb-1">Confirm Purchase</h2>
        <p className="text-sm text-scai-muted mb-6">
          Review the details below before confirming your transaction.
        </p>

        {/* NFT preview */}
        <div className="flex items-center gap-4 p-4 bg-white/[0.03] border border-white/[0.07] rounded-xl mb-6">
          {listing.imageUrl ? (
            <img src={listing.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 rounded-lg bg-scai-primary/10 flex items-center justify-center text-2xl flex-shrink-0">◈</div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-scai-text truncate">{listing.name || `NFT #${listing.tokenId}`}</p>
            <p className="text-xs text-scai-muted mt-0.5">Token #{listing.tokenId}</p>
            <p className="text-xs text-scai-muted mt-0.5 font-mono">Seller: {shorten(listing.seller)}</p>
          </div>
        </div>

        {/* Price breakdown */}
        <div className="space-y-2 mb-6">
          <div className="flex justify-between text-sm">
            <span className="text-scai-muted">Price</span>
            <span className="text-scai-text font-medium">{formatSCAI(listing.price)} SCAI</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-scai-muted">Network fee</span>
            <span className="text-scai-muted">~0.001 SCAI (gas)</span>
          </div>
          <div className="border-t border-white/[0.06] pt-2 flex justify-between text-sm font-bold">
            <span className="text-scai-text">You pay</span>
            <span className="text-scai-plit">{formatSCAI(listing.price)} SCAI</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isPending} className="btn-outline flex-1">
            Cancel
          </button>
          <button onClick={onConfirm} disabled={isPending} className="btn-primary flex-1">
            {isPending ? <><span className="spinner" /> Confirming…</> : "Confirm Purchase"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sort / Filter bar ─────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: "newest",    label: "Newest First"  },
  { value: "price_asc", label: "Price: Low → High" },
  { value: "price_desc",label: "Price: High → Low" },
];

function sortListings(listings, sort) {
  const arr = [...listings];
  if (sort === "price_asc")  return arr.sort((a,b) => (a.price < b.price ? -1 : 1));
  if (sort === "price_desc") return arr.sort((a,b) => (a.price > b.price ? -1 : 1));
  return arr; // newest = original event order (already reversed)
}

// ── Main Explore component ────────────────────────────────────────────────────

export default function Explore({ addToast, dismissToast, updateToast }) {
  const { signer, account, isConnected, connectWallet } = useWalletContext();

  const [listings,    setListings]    = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(null);
  const [sort,        setSort]        = useState("newest");
  const [buyTarget,   setBuyTarget]   = useState(null);   // listing being purchased
  const [buyPending,  setBuyPending]  = useState(false);
  const [search,      setSearch]      = useState("");
  const fetchedRef = useRef(false);

  // ── Safe event query — tries progressively smaller block ranges ─────────────
  //
  //  Many RPCs (including SCAI) cap eth_getLogs to 2 000 – 10 000 blocks.
  //  We try: no-limit → 100 000 → 20 000 → 5 000 → 2 000 blocks back.
  //  The first range that succeeds is returned.
  //
  const safeQueryFilter = useCallback(async (contract, filter) => {
    let currentBlock = null;

    const LOOKBACKS = [null, 100_000, 20_000, 5_000, 2_000];

    for (const lookback of LOOKBACKS) {
      try {
        let fromBlock = 0;
        if (lookback !== null) {
          if (currentBlock === null) {
            currentBlock = await RPC_PROVIDER.getBlockNumber();
          }
          fromBlock = Math.max(0, currentBlock - lookback);
        }
        // Add a 12-second timeout so a hanging call doesn't stall the UI
        const events = await Promise.race([
          contract.queryFilter(filter, fromBlock, "latest"),
          new Promise((_, rej) =>
            setTimeout(() => rej(new Error("query timeout")), 12_000)
          ),
        ]);
        console.info(
          `queryFilter OK — fromBlock=${fromBlock} (lookback=${lookback ?? "all"}), ${events.length} events`
        );
        return events;
      } catch (e) {
        console.warn(
          `queryFilter failed (lookback=${lookback ?? "all"}): ${e.message}`
        );
      }
    }

    // All tiers exhausted — return empty array so the page still renders
    console.error("All queryFilter tiers failed. Returning [].");
    return [];
  }, []);

  // ── Fetch listings ──────────────────────────────────────────────────────────
  const fetchListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const marketplace = new ethers.Contract(
        CONTRACT_ADDRESSES.Marketplace,
        MARKETPLACE_ABI,
        RPC_PROVIDER
      );

      // 1. Fetch Listed events with RPC-safe block range
      const events = await safeQueryFilter(marketplace, marketplace.filters.Listed());

      if (events.length === 0) {
        // Could mean no listings OR the RPC returned nothing — show empty state
        setListings([]);
        return;
      }

      // 2. Deduplicate: keep latest event per (nftContract, tokenId)
      const seen = new Map();
      for (const ev of events) {
        const key = `${ev.args.nftContract}-${ev.args.tokenId}`;
        seen.set(key, ev); // later events overwrite earlier ones
      }

      // 3. For each unique listing, call getListing() and fetch metadata
      const results = await Promise.allSettled(
        [...seen.entries()].map(async ([, ev]) => {
          const { nftContract, tokenId } = ev.args;

          // Get live listing state from contract
          let listing;
          try {
            listing = await marketplace.getListing(nftContract, tokenId);
          } catch {
            return null;
          }
          if (!listing.active) return null; // sold or cancelled

          // Fetch metadata from NFT contract + IPFS
          const nft = new ethers.Contract(nftContract, NFT_ABI, RPC_PROVIDER);
          let meta = {};
          try {
            const uri = await nft.tokenURI(tokenId);
            meta = (await fetchMetadata(uri)) || {};
          } catch { /* metadata unavailable — card still renders */ }

          return {
            key:         `${nftContract}-${tokenId}`,
            nftContract,
            tokenId:     tokenId.toString(),
            seller:      listing.seller,
            price:       listing.price,
            name:        meta.name        || null,
            description: meta.description || null,
            imageUrl:    resolveImage(meta.image) || null,
            blockNumber: ev.blockNumber,
          };
        })
      );

      const active = results
        .filter(r => r.status === "fulfilled" && r.value !== null)
        .map(r => r.value)
        .reverse(); // newest block first

      setListings(active);
    } catch (err) {
      console.error("fetchListings:", err);
      setError(
        err?.message?.includes("network") || err?.message?.includes("fetch")
          ? "Network error — check your internet connection and try again."
          : "Failed to load listings. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [safeQueryFilter]);


  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    fetchListings();
  }, [fetchListings]);

  // ── Buy flow ────────────────────────────────────────────────────────────────
  const handleBuyConfirm = async () => {
    if (!signer || !buyTarget) return;
    setBuyPending(true);

    const pendingId = addToast({
      type: "pending",
      message: `Sending transaction for NFT #${buyTarget.tokenId}…`,
    });

    try {
      const marketplace = new ethers.Contract(
        CONTRACT_ADDRESSES.Marketplace,
        MARKETPLACE_ABI,
        signer
      );

      const tx = await marketplace.buyNFT(
        buyTarget.nftContract,
        BigInt(buyTarget.tokenId),
        { value: buyTarget.price }
      );

      dismissToast(pendingId);
      const waitId = addToast({ type: "pending", message: `Waiting for confirmation…` });

      const receipt = await tx.wait();
      dismissToast(waitId);
      setBuyTarget(null);

      addToast({
        type:      "success",
        message:   `🎉 You now own NFT #${buyTarget.tokenId}!`,
        link:      `${EXPLORER_BASE}/tx/${receipt.hash}`,
        linkLabel: "View Transaction →",
        duration:  12000,
      });

      // Remove bought listing from UI immediately
      setListings(prev => prev.filter(l => l.key !== buyTarget.key));
    } catch (err) {
      dismissToast(pendingId);
      addToast({
        type:    "error",
        message: err.reason || err.message || "Transaction failed.",
        duration: 8000,
      });
    } finally {
      setBuyPending(false);
    }
  };

  // ── Filtered + sorted listings ──────────────────────────────────────────────
  const displayed = sortListings(
    listings.filter(l => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        (l.name        || "").toLowerCase().includes(q) ||
        (l.description || "").toLowerCase().includes(q) ||
        l.tokenId.includes(q) ||
        l.seller.toLowerCase().includes(q)
      );
    }),
    sort
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-extrabold gradient-text mb-2">Explore NFTs</h1>
          <p className="text-scai-muted text-sm">
            Browse all active listings on SCAI Mainnet •{" "}
            <span className="text-scai-plit font-medium">{listings.length} listings</span>
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          {/* Search */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-scai-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, description or seller…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-input pl-9"
            />
          </div>

          {/* Sort */}
          <select
            value={sort}
            onChange={e => setSort(e.target.value)}
            className="form-input sm:w-52 bg-scai-bg2 cursor-pointer"
          >
            {SORT_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          {/* Refresh */}
          <button
            onClick={fetchListings}
            disabled={loading}
            className="btn-outline flex-shrink-0"
          >
            {loading
              ? <span className="spinner" />
              : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
            }
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="glass-card border border-scai-error/30 p-5 mb-8 flex items-start gap-3 animate-fade-in">
            <svg className="w-5 h-5 text-scai-error flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-scai-error">{error}</p>
              <button onClick={fetchListings} className="text-xs text-scai-muted hover:text-scai-text mt-1 transition-colors">
                Try again →
              </button>
            </div>
          </div>
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-6xl mb-4 opacity-20">◈</div>
            <h3 className="text-lg font-semibold text-scai-label mb-2">
              {search ? "No listings match your search" : "No active listings yet"}
            </h3>
            <p className="text-sm text-scai-muted max-w-xs">
              {search ? "Try a different search term." : "Be the first — mint and list an NFT!"}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {displayed.map(listing => (
                <NFTCard
                  key={listing.key}
                  listing={listing}
                  myAddress={account}
                  onBuy={(l) => {
                    if (!isConnected) { connectWallet(); return; }
                    setBuyTarget(l);
                  }}
                />
              ))}
            </div>

            {/* Connect prompt */}
            {!isConnected && (
              <div className="mt-8 glass-card border border-scai-primary/30 p-5 flex flex-col sm:flex-row items-center justify-between gap-4 animate-slide-up">
                <div>
                  <p className="font-semibold text-scai-text">Ready to buy?</p>
                  <p className="text-sm text-scai-muted mt-0.5">Connect your MetaMask wallet to purchase NFTs.</p>
                </div>
                <button onClick={connectWallet} className="btn-primary flex-shrink-0">
                  Connect Wallet
                </button>
              </div>
            )}
          </>
        )}
      </section>

      {/* Buy modal */}
      <BuyModal
        listing={buyTarget}
        onConfirm={handleBuyConfirm}
        onCancel={() => { if (!buyPending) setBuyTarget(null); }}
        isPending={buyPending}
      />
    </>
  );
}
