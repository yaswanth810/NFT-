// src/pages/MyNFTs.jsx
// ─────────────────────────────────────────────────────────────────────────────
//  My NFTs — shows ERC-721 tokens owned by the connected wallet on SCAI Mainnet
//
//  Data flow:
//  1. JsonRpcProvider → NFTMarketplace.Transfer events filtered to `account`
//  2. ownerOf() per tokenId to confirm current ownership
//  3. tokenURI() → IPFS metadata fetch (name, description, image)
//  4. Marketplace.getListing() to detect active listings
//
//  Actions:
//  • List for sale   → approve(marketplace, tokenId) → listNFT(nft, id, price)
//  • Cancel listing  → cancelListing(nft, id)
//  Each tx is linked to https://explorer.securechain.ai/tx/<txHash>
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { ethers } from "ethers";
import { Link } from "react-router-dom";
import { useWalletContext } from "../context/WalletContext";
import {
  CONTRACT_ADDRESSES, NFT_ABI, MARKETPLACE_ABI,
  EXPLORER_BASE, SCAI_NETWORK, SCAI_CHAIN_ID,
} from "../constants/contracts";

// ── Read-only provider for event / view queries ───────────────────────────────
const RPC = new ethers.JsonRpcProvider(SCAI_NETWORK.rpcUrls[0]);

// ── Helpers ───────────────────────────────────────────────────────────────────
const shorten = (addr) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
const fmtSCAI = (wei) => {
  try { return parseFloat(ethers.formatEther(wei)).toFixed(4); }
  catch { return "0.0000"; }
};
const resolveImg = (url) => {
  if (!url) return null;
  return url.startsWith("ipfs://")
    ? `https://gateway.pinata.cloud/ipfs/${url.slice(7)}`
    : url;
};
const txLink = (hash) => `${EXPLORER_BASE}/tx/${hash}`;

async function fetchMeta(uri) {
  if (!uri) return {};
  try {
    const url = uri.startsWith("ipfs://")
      ? `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}` : uri;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return res.ok ? await res.json() : {};
  } catch { return {}; }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="glass-card overflow-hidden">
      <div className="skeleton aspect-square" />
      <div className="p-4 space-y-2.5">
        <div className="skeleton h-4 rounded-full w-3/4" />
        <div className="skeleton h-3 rounded-full w-1/2" />
        <div className="skeleton h-9 rounded-xl w-full mt-4" />
      </div>
    </div>
  );
}

// ── List step indicator ───────────────────────────────────────────────────────
function ListStep({ step, label, status, txHash }) {
  const icons = {
    idle:    <div className="w-5 h-5 rounded-full border-2 border-white/20 flex-shrink-0" />,
    loading: <span className="spinner !w-5 !h-5 flex-shrink-0" />,
    done:    <svg className="w-5 h-5 text-scai-success flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
    error:   <svg className="w-5 h-5 text-scai-error flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
  };
  const textColor = { idle: "text-scai-muted", loading: "text-scai-text", done: "text-scai-success", error: "text-scai-error" };
  return (
    <div className="flex items-center gap-3">
      {icons[status]}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${textColor[status]}`}>
          <span className="text-scai-muted text-xs mr-1.5">{step}.</span>{label}
        </p>
        {txHash && status === "done" && (
          <a href={txLink(txHash)} target="_blank" rel="noopener noreferrer"
            className="text-xs text-scai-primary hover:text-scai-plit flex items-center gap-1 mt-0.5 transition-colors">
            View on Explorer ↗
          </a>
        )}
      </div>
    </div>
  );
}

// ── NFT Card ──────────────────────────────────────────────────────────────────
function NFTCard({ nft, signer, onRefresh, addToast }) {
  const [imgErr,    setImgErr]    = useState(false);
  const [showForm,  setShowForm]  = useState(false);      // price input form
  const [price,     setPrice]     = useState("");
  const [isBusy,    setIsBusy]    = useState(false);
  const [steps, setSteps] = useState({
    approve: { status: "idle", txHash: null },
    list:    { status: "idle", txHash: null },
    cancel:  { status: "idle", txHash: null },
  });
  const [flowError, setFlowError] = useState(null);

  const setStep = (key, patch) =>
    setSteps(prev => ({ ...prev, [key]: { ...prev[key], ...patch } }));

  const showingSteps = Object.values(steps).some(s => s.status !== "idle");

  // ── List for sale flow ──────────────────────────────────────────────────────
  const handleList = async () => {
    if (!price || Number(price) <= 0) return;
    if (!signer) return;
    const priceBig = ethers.parseEther(price);

    setIsBusy(true);
    setFlowError(null);
    setSteps({
      approve: { status: "idle", txHash: null },
      list:    { status: "idle", txHash: null },
      cancel:  { status: "idle", txHash: null },
    });

    try {
      const nftContract = new ethers.Contract(CONTRACT_ADDRESSES.NFTMarketplace, NFT_ABI, signer);
      const marketplace = new ethers.Contract(CONTRACT_ADDRESSES.Marketplace, MARKETPLACE_ABI, signer);

      // Step 1 — approve
      setStep("approve", { status: "loading" });
      const approveTx = await nftContract.approve(CONTRACT_ADDRESSES.Marketplace, BigInt(nft.tokenId));
      const approveReceipt = await approveTx.wait();
      setStep("approve", { status: "done", txHash: approveReceipt.hash });

      // Step 2 — listNFT
      setStep("list", { status: "loading" });
      const listTx = await marketplace.listNFT(
        CONTRACT_ADDRESSES.NFTMarketplace,
        BigInt(nft.tokenId),
        priceBig
      );
      const listReceipt = await listTx.wait();
      setStep("list", { status: "done", txHash: listReceipt.hash });

      addToast({
        type:      "success",
        message:   `NFT #${nft.tokenId} listed at ${price} SCAI!`,
        link:      txLink(listReceipt.hash),
        linkLabel: "View Transaction →",
        duration:  10000,
      });

      setPrice("");
      setShowForm(false);
      await onRefresh();
    } catch (err) {
      const msg = err.reason || err.message || "Transaction failed.";
      setFlowError(msg);
      // Mark the in-progress step as errored
      setSteps(prev => {
        const updated = { ...prev };
        for (const k of Object.keys(updated)) {
          if (updated[k].status === "loading") updated[k] = { ...updated[k], status: "error" };
        }
        return updated;
      });
      addToast({ type: "error", message: msg, duration: 8000 });
    } finally {
      setIsBusy(false);
    }
  };

  // ── Cancel listing flow ─────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!signer) return;
    setIsBusy(true);
    setFlowError(null);
    setSteps({
      approve: { status: "idle", txHash: null },
      list:    { status: "idle", txHash: null },
      cancel:  { status: "loading", txHash: null },
    });

    try {
      const marketplace = new ethers.Contract(CONTRACT_ADDRESSES.Marketplace, MARKETPLACE_ABI, signer);
      const tx      = await marketplace.cancelListing(
        CONTRACT_ADDRESSES.NFTMarketplace,
        BigInt(nft.tokenId)
      );
      const receipt = await tx.wait();
      setStep("cancel", { status: "done", txHash: receipt.hash });

      addToast({
        type:      "success",
        message:   `Listing for NFT #${nft.tokenId} cancelled.`,
        link:      txLink(receipt.hash),
        linkLabel: "View Transaction →",
      });
      await onRefresh();
    } catch (err) {
      const msg = err.reason || err.message || "Cancel failed.";
      setFlowError(msg);
      setStep("cancel", { status: "error" });
      addToast({ type: "error", message: msg, duration: 8000 });
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div className="nft-card group animate-fade-in flex flex-col">
      {/* Image */}
      <div className="aspect-square overflow-hidden bg-scai-bg2 relative flex-shrink-0">
        {nft.imageUrl && !imgErr ? (
          <img
            src={nft.imageUrl}
            alt={nft.name || `NFT #${nft.tokenId}`}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={() => setImgErr(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-5xl text-scai-primary/20">◈</div>
        )}

        {/* Status badges */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {nft.isListed && (
            <span className="badge bg-scai-success/15 border border-scai-success/30 text-scai-success text-[10px]">
              <span className="w-1 h-1 rounded-full bg-scai-success animate-pulse-dot" />
              Listed
            </span>
          )}
        </div>

        {/* Token ID chip */}
        <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm rounded-full px-2 py-0.5 text-[10px] font-mono text-white/70">
          #{nft.tokenId}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className="font-semibold text-scai-text text-sm line-clamp-1 mb-0.5">
          {nft.name || `NFT #${nft.tokenId}`}
        </h3>
        <p className="text-xs text-scai-muted line-clamp-2 mb-3 flex-1">
          {nft.description || "No description provided."}
        </p>

        {/* Listed price info */}
        {nft.isListed && (
          <div className="flex justify-between text-xs mb-3 p-2.5 bg-scai-success/5 border border-scai-success/20 rounded-lg">
            <span className="text-scai-muted">Listed at</span>
            <span className="font-bold text-scai-success">{fmtSCAI(nft.listingPrice)} SCAI</span>
          </div>
        )}

        {/* Tx progress (shown during/after listing or cancel) */}
        {showingSteps && (
          <div className="mb-3 p-3 bg-white/[0.03] border border-white/[0.07] rounded-xl space-y-2.5 animate-fade-in">
            {nft.isListed || steps.cancel.status !== "idle" ? (
              <ListStep step={1} label="Cancel listing" {...steps.cancel} />
            ) : (
              <>
                <ListStep step={1} label="Approve marketplace" {...steps.approve} />
                <ListStep step={2} label="List NFT on marketplace" {...steps.list} />
              </>
            )}
            {flowError && (
              <p className="text-xs text-scai-error mt-1 pt-2 border-t border-white/[0.06]">{flowError}</p>
            )}
          </div>
        )}

        {/* Price input form */}
        {showForm && !nft.isListed && (
          <div className="mb-3 space-y-2 animate-fade-in">
            <div className="relative">
              <input
                type="number"
                min="0.0001"
                step="0.0001"
                placeholder="0.00"
                value={price}
                onChange={e => setPrice(e.target.value)}
                className="form-input text-sm pr-16"
                autoFocus
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-scai-muted font-bold">SCAI</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { setShowForm(false); setPrice(""); setSteps({ approve: { status: "idle", txHash: null }, list: { status: "idle", txHash: null }, cancel: { status: "idle", txHash: null } }); setFlowError(null); }}
                disabled={isBusy}
                className="btn-outline flex-1 text-xs py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleList}
                disabled={isBusy || !price || Number(price) <= 0}
                className="btn-primary flex-1 text-xs py-2"
              >
                {isBusy
                  ? <><span className="spinner" /> Working…</>
                  : steps.approve.status === "done" ? "Listing…" : "Approve & List"
                }
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!showForm && (
          nft.isListed ? (
            <button
              onClick={handleCancel}
              disabled={isBusy}
              className={`w-full text-xs py-2.5 rounded-xl font-semibold border transition-all duration-200
                border-scai-error/40 text-scai-error hover:bg-scai-error/10 active:scale-95
                disabled:opacity-40 disabled:cursor-not-allowed`}
            >
              {isBusy
                ? <span className="flex items-center justify-center gap-2"><span className="spinner !border-scai-error/30 !border-t-scai-error" /> Cancelling…</span>
                : "Cancel Listing"
              }
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => { setShowForm(true); setFlowError(null); setSteps({ approve: { status: "idle", txHash: null }, list: { status: "idle", txHash: null }, cancel: { status: "idle", txHash: null } }); }}
                disabled={isBusy}
                className="btn-primary flex-1 text-xs py-2.5"
              >
                List for Sale
              </button>
              <a
                href={`${EXPLORER_BASE}/token/${CONTRACT_ADDRESSES.NFTMarketplace}?a=${nft.tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline px-3 text-xs py-2.5"
                title="View on Explorer"
              >
                ↗
              </a>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function MyNFTs({ addToast }) {
  const { account, signer, isConnected, isCorrectNetwork, connectWallet, chainId } =
    useWalletContext();

  const [nfts,    setNfts]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [filter,  setFilter]  = useState("all"); // "all" | "listed" | "unlisted"
  const fetchedFor = useRef(null);

  // ── Fetch owned NFTs ────────────────────────────────────────────────────────
  //
  //  Strategy (avoids RPC block-range limit that broke queryFilter):
  //  1. totalMinted() → how many tokens exist
  //  2. Batch ownerOf() calls (10 at a time) to find tokens owned by addr
  //  3. Fetch tokenURI → IPFS metadata for matched tokens
  //  4. getListing() for listing status
  //
  const fetchMyNFTs = useCallback(async (addr) => {
    setLoading(true);
    setError(null);

    try {
      const nftContract = new ethers.Contract(CONTRACT_ADDRESSES.NFTMarketplace, NFT_ABI, RPC);
      const marketplace = new ethers.Contract(CONTRACT_ADDRESSES.Marketplace, MARKETPLACE_ABI, RPC);

      // ── Step 1: total supply ───────────────────────────────────────────────
      let total = 0n;
      try {
        total = await nftContract.totalMinted();
      } catch (e) {
        console.error("totalMinted() failed:", e);
        setError("Could not read NFT supply from contract. Check your RPC connection.");
        return;
      }

      if (total === 0n) {
        setNfts([]);
        return;
      }

      // ── Step 2: batched ownerOf (10 at a time) ────────────────────────────
      const allIds   = Array.from({ length: Number(total) }, (_, i) => String(i + 1));
      const ownedIds = [];
      const BATCH    = 10;

      for (let i = 0; i < allIds.length; i += BATCH) {
        const batch = allIds.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(id => nftContract.ownerOf(BigInt(id)))
        );
        batch.forEach((id, j) => {
          const r = results[j];
          if (r.status === "fulfilled" && r.value.toLowerCase() === addr.toLowerCase()) {
            ownedIds.push(id);
          }
        });
      }

      if (ownedIds.length === 0) {
        setNfts([]);
        return;
      }

      // ── Step 3: metadata + listing status (parallel) ──────────────────────
      const resolved = await Promise.allSettled(
        ownedIds.map(async (id) => {
          // tokenURI → IPFS metadata
          let meta = {};
          try {
            const uri = await nftContract.tokenURI(BigInt(id));
            meta = await fetchMeta(uri);
          } catch { /* metadata unavailable — show card without it */ }

          // Listing state
          let isListed = false, listingPrice = 0n;
          try {
            const listing = await marketplace.getListing(
              CONTRACT_ADDRESSES.NFTMarketplace, BigInt(id)
            );
            isListed     = listing.active;
            listingPrice = listing.price;
          } catch { /* token not listed — that's fine */ }

          return {
            tokenId:     id,
            name:        meta.name        || null,
            description: meta.description || null,
            imageUrl:    resolveImg(meta.image),
            isListed,
            listingPrice,
          };
        })
      );

      const owned = resolved
        .filter(r => r.status === "fulfilled" && r.value)
        .map(r => r.value)
        .sort((a, b) => Number(b.tokenId) - Number(a.tokenId)); // newest first

      setNfts(owned);
    } catch (err) {
      console.error("fetchMyNFTs:", err);
      setError(
        err?.message?.includes("network") || err?.message?.includes("fetch")
          ? "Network error — check your internet connection and try again."
          : "Failed to load your NFTs. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);


  useEffect(() => {
    if (isConnected && isCorrectNetwork && account && fetchedFor.current !== account) {
      fetchedFor.current = account;
      fetchMyNFTs(account);
    }
  }, [isConnected, isCorrectNetwork, account, fetchMyNFTs]);

  // ── Filter ──────────────────────────────────────────────────────────────────
  const displayed = nfts.filter(n => {
    if (filter === "listed")   return n.isListed;
    if (filter === "unlisted") return !n.isListed;
    return true;
  });

  const listedCount   = nfts.filter(n => n.isListed).length;
  const unlistedCount = nfts.filter(n => !n.isListed).length;

  // ── Guard: not connected ────────────────────────────────────────────────────
  if (!isConnected) {
    return (
      <section className="max-w-lg mx-auto px-4 sm:px-6 py-24 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-scai-primary/10 border border-scai-primary/20 flex items-center justify-center text-4xl mb-6">
          🖼️
        </div>
        <h1 className="text-2xl font-extrabold gradient-text mb-3">My NFTs</h1>
        <p className="text-scai-muted text-sm max-w-xs mb-8">
          Connect your MetaMask wallet to view your minted NFTs and manage your listings on SCAI Mainnet.
        </p>
        <button onClick={connectWallet} className="btn-primary px-10 py-3">
          Connect Wallet
        </button>
      </section>
    );
  }

  // ── Guard: wrong network ────────────────────────────────────────────────────
  if (!isCorrectNetwork) {
    return (
      <section className="max-w-lg mx-auto px-4 sm:px-6 py-24 flex flex-col items-center text-center">
        <div className="w-20 h-20 rounded-2xl bg-scai-warn/10 border border-scai-warn/20 flex items-center justify-center text-4xl mb-6">
          ⚠️
        </div>
        <h2 className="text-xl font-bold text-scai-text mb-2">Wrong Network</h2>
        <p className="text-scai-muted text-sm max-w-xs mb-2">
          You are connected to Chain ID <span className="font-mono text-scai-warn">{chainId}</span>.
          Please switch to <span className="font-semibold text-scai-text">SCAI Mainnet (Chain ID: 34)</span>.
        </p>
        <p className="text-xs text-scai-muted mb-8">
          MetaMask will prompt you to add / switch the network automatically.
        </p>
        <button onClick={connectWallet} className="btn-primary px-10 py-3">
          Switch to SCAI Mainnet
        </button>
      </section>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 py-10">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold gradient-text mb-1">My NFTs</h1>
          <a
            href={`${EXPLORER_BASE}/address/${account}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-mono text-scai-muted hover:text-scai-plit transition-colors"
          >
            {shorten(account)} ↗
          </a>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { fetchedFor.current = null; fetchMyNFTs(account); }}
            disabled={loading}
            className="btn-outline text-sm"
          >
            {loading
              ? <span className="spinner" />
              : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
            }
            Refresh
          </button>
          <Link to="/mint" className="btn-primary text-sm">
            + Mint New NFT
          </Link>
        </div>
      </div>

      {/* Stats bar */}
      {!loading && nfts.length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Total",    value: nfts.length,    key: "all"      },
            { label: "Listed",   value: listedCount,    key: "listed"   },
            { label: "Unlisted", value: unlistedCount,  key: "unlisted" },
          ].map(s => (
            <button
              key={s.key}
              onClick={() => setFilter(s.key)}
              className={`glass-card p-4 text-center transition-all duration-200 rounded-xl
                ${filter === s.key
                  ? "border-scai-primary/50 bg-scai-primary/5"
                  : "hover:border-white/20"}`}
            >
              <p className={`text-2xl font-black ${filter === s.key ? "gradient-text" : "text-scai-text"}`}>
                {s.value}
              </p>
              <p className="text-xs text-scai-muted mt-0.5">{s.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="glass-card border border-scai-error/30 p-4 mb-6 flex items-center gap-3 animate-fade-in">
          <svg className="w-5 h-5 text-scai-error flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-scai-error flex-1">{error}</p>
          <button
            onClick={() => { fetchedFor.current = null; fetchMyNFTs(account); }}
            className="text-xs text-scai-muted hover:text-scai-text transition-colors"
          >
            Retry →
          </button>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} />)}
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="text-6xl mb-4 opacity-20">🖼️</div>
          <h3 className="text-lg font-semibold text-scai-label mb-2">
            {filter !== "all" ? `No ${filter} NFTs` : "No NFTs found"}
          </h3>
          <p className="text-sm text-scai-muted max-w-xs mb-8">
            {filter !== "all"
              ? `Switch the filter to see all your NFTs.`
              : "You haven't minted any NFTs to this wallet yet."}
          </p>
          {filter === "all"
            ? <Link to="/mint" className="btn-primary">Mint Your First NFT</Link>
            : <button onClick={() => setFilter("all")} className="btn-outline">Show All NFTs</button>
          }
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {displayed.map(nft => (
            <NFTCard
              key={nft.tokenId}
              nft={nft}
              signer={signer}
              onRefresh={() => fetchMyNFTs(account)}
              addToast={addToast}
            />
          ))}
        </div>
      )}
    </section>
  );
}
