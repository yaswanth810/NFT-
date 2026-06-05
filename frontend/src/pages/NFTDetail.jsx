// src/pages/NFTDetail.jsx
// ─────────────────────────────────────────────────────────────────────────────
//  NFT Detail Page — /nft/:tokenId
//
//  Sections:
//  ① Hero: large image + core metadata (name, description, token ID, contract)
//  ② Owner / Price / Action panel
//  ③ Transaction History timeline (Listed / Sold / Cancelled / Minted events)
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ethers } from "ethers";
import { useWalletContext } from "../context/WalletContext";
import {
  CONTRACT_ADDRESSES, NFT_ABI, MARKETPLACE_ABI,
  EXPLORER_BASE, SCAI_NETWORK,
} from "../constants/contracts";

// ── Read-only provider ────────────────────────────────────────────────────────
const RPC = new ethers.JsonRpcProvider(SCAI_NETWORK.rpcUrls[0]);

// ── Helpers ───────────────────────────────────────────────────────────────────
const shorten  = (addr) => addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "—";
const fmtSCAI  = (wei)  => { try { return parseFloat(ethers.formatEther(wei)).toFixed(4); } catch { return "0.0000"; } };
const txLink   = (h)    => `${EXPLORER_BASE}/tx/${h}`;
const addrLink = (a)    => `${EXPLORER_BASE}/address/${a}`;
const resolveImg = (url) => {
  if (!url) return null;
  return url.startsWith("ipfs://")
    ? `https://gateway.pinata.cloud/ipfs/${url.slice(7)}`
    : url;
};

async function fetchMeta(uri) {
  if (!uri) return {};
  try {
    const url = uri.startsWith("ipfs://")
      ? `https://gateway.pinata.cloud/ipfs/${uri.slice(7)}` : uri;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    return res.ok ? await res.json() : {};
  } catch { return {}; }
}

async function getBlockTime(blockNumber) {
  try {
    const block = await RPC.getBlock(blockNumber);
    return block?.timestamp ?? null;
  } catch { return null; }
}

function tsToDate(ts) {
  if (!ts) return "—";
  return new Date(Number(ts) * 1000).toLocaleString();
}

// ── Event type config ─────────────────────────────────────────────────────────
const EVENT_META = {
  Minted:    { label: "Minted",    color: "text-scai-primary",  bg: "bg-scai-primary/10",  border: "border-scai-primary/30",  icon: "✦" },
  Listed:    { label: "Listed",    color: "text-scai-accent",   bg: "bg-scai-accent/10",   border: "border-scai-accent/30",   icon: "⊞" },
  Sold:      { label: "Sold",      color: "text-scai-success",  bg: "bg-scai-success/10",  border: "border-scai-success/30",  icon: "✓" },
  Cancelled: { label: "Cancelled", color: "text-scai-warn",     bg: "bg-scai-warn/10",     border: "border-scai-warn/30",     icon: "✕" },
  Transfer:  { label: "Transfer",  color: "text-scai-plit",     bg: "bg-scai-primary/5",   border: "border-scai-primary/20",  icon: "→" },
};

// ── Address chip ──────────────────────────────────────────────────────────────
function AddrChip({ addr, label }) {
  if (!addr || addr === ethers.ZeroAddress) return <span className="text-scai-muted italic text-xs">—</span>;
  return (
    <a
      href={addrLink(addr)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 font-mono text-xs text-scai-plit hover:text-scai-accent transition-colors"
      title={addr}
    >
      {label || shorten(addr)}
      <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
    </a>
  );
}

// ── Timeline event row ────────────────────────────────────────────────────────
function EventRow({ ev }) {
  const m = EVENT_META[ev.type] || EVENT_META.Transfer;
  return (
    <div className={`flex gap-4 p-4 rounded-xl border ${m.border} ${m.bg} animate-fade-in`}>
      {/* Icon */}
      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold border ${m.border} ${m.color}`}>
        {m.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1.5">
          <span className={`text-xs font-bold uppercase tracking-wider ${m.color}`}>{m.label}</span>
          {ev.price && (
            <span className="text-xs font-semibold text-scai-text bg-white/[0.06] px-2 py-0.5 rounded-full">
              {fmtSCAI(ev.price)} SCAI
            </span>
          )}
          <span className="text-xs text-scai-muted ml-auto">{tsToDate(ev.timestamp)}</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-xs">
          {ev.from && (
            <div className="flex items-center gap-1.5">
              <span className="text-scai-muted w-8 flex-shrink-0">From</span>
              <AddrChip addr={ev.from} />
            </div>
          )}
          {ev.to && (
            <div className="flex items-center gap-1.5">
              <span className="text-scai-muted w-8 flex-shrink-0">To</span>
              <AddrChip addr={ev.to} />
            </div>
          )}
        </div>

        {ev.txHash && (
          <a
            href={txLink(ev.txHash)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-scai-muted hover:text-scai-plit transition-colors font-mono"
          >
            Tx: {ev.txHash.slice(0, 14)}…
            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
          </a>
        )}
      </div>
    </div>
  );
}

// ── List-for-sale inline panel ─────────────────────────────────────────────────
function ListPanel({ tokenId, signer, onDone, addToast }) {
  const [price,   setPrice]   = useState("");
  const [status,  setStatus]  = useState("idle"); // idle | approving | listing | done | error
  const [approveTx, setApproveTx] = useState(null);
  const [listTx,    setListTx]    = useState(null);
  const [errMsg,    setErrMsg]    = useState(null);

  const busy = status === "approving" || status === "listing";

  const handleList = async () => {
    if (!price || Number(price) <= 0) return;
    const priceBig = ethers.parseEther(price);
    setErrMsg(null);
    try {
      const nftContract = new ethers.Contract(CONTRACT_ADDRESSES.NFTMarketplace, NFT_ABI, signer);
      const marketplace = new ethers.Contract(CONTRACT_ADDRESSES.Marketplace, MARKETPLACE_ABI, signer);

      setStatus("approving");
      const aTx     = await nftContract.approve(CONTRACT_ADDRESSES.Marketplace, BigInt(tokenId));
      const aReceipt= await aTx.wait();
      setApproveTx(aReceipt.hash);

      setStatus("listing");
      const lTx     = await marketplace.listNFT(CONTRACT_ADDRESSES.NFTMarketplace, BigInt(tokenId), priceBig);
      const lReceipt= await lTx.wait();
      setListTx(lReceipt.hash);
      setStatus("done");

      addToast({ type: "success", message: `NFT #${tokenId} listed at ${price} SCAI!`, link: txLink(lReceipt.hash), linkLabel: "View tx →", duration: 10000 });
      setTimeout(onDone, 1500);
    } catch (err) {
      setStatus("error");
      setErrMsg(err.reason || err.message || "Transaction failed.");
      addToast({ type: "error", message: err.reason || err.message || "Listing failed.", duration: 8000 });
    }
  };

  return (
    <div className="mt-4 p-4 bg-white/[0.03] border border-white/[0.08] rounded-xl space-y-3 animate-fade-in">
      <p className="text-sm font-semibold text-scai-text">List NFT for Sale</p>

      {/* Step tracker */}
      <div className="space-y-2">
        {[
          { key: "approving", done: approveTx, label: "Approve marketplace to transfer NFT", txHash: approveTx },
          { key: "listing",   done: listTx,    label: "List NFT on SCAI Marketplace",        txHash: listTx   },
        ].map((s, i) => (
          <div key={s.key} className="flex items-center gap-2.5 text-xs">
            <div className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center
              ${s.done ? "bg-scai-success text-white" : status === s.key ? "border-2 border-scai-primary animate-spin" : "border-2 border-white/20"}`}>
              {s.done
                ? <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                : status === s.key ? null : <span className="text-scai-muted">{i + 1}</span>}
            </div>
            <span className={s.done ? "text-scai-success" : status === s.key ? "text-scai-text" : "text-scai-muted"}>{s.label}</span>
            {s.txHash && (
              <a href={txLink(s.txHash)} target="_blank" rel="noopener noreferrer"
                className="ml-auto text-scai-primary hover:text-scai-plit text-[10px]">View ↗</a>
            )}
          </div>
        ))}
      </div>

      {/* Price input */}
      {(status === "idle" || status === "error") && (
        <div className="relative">
          <input
            type="number" min="0.0001" step="0.0001" placeholder="Enter price"
            value={price} onChange={e => setPrice(e.target.value)}
            className="form-input pr-16 text-sm"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-scai-muted">SCAI</span>
        </div>
      )}

      {errMsg && <p className="text-xs text-scai-error">{errMsg}</p>}

      {status !== "done" && (
        <button onClick={handleList} disabled={busy || !price || Number(price) <= 0} className="btn-primary w-full text-sm">
          {status === "approving" ? <><span className="spinner" /> Approving…</>
           : status === "listing" ? <><span className="spinner" /> Listing…</>
           : "Approve & List for Sale"}
        </button>
      )}
    </div>
  );
}

// ── Buy confirmation modal ────────────────────────────────────────────────────
function BuyModal({ nft, listing, onConfirm, onCancel, isPending }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div className="glass-card border border-white/10 w-full max-w-md p-6 animate-slide-up">
        <h2 className="text-xl font-bold text-scai-text mb-1">Confirm Purchase</h2>
        <p className="text-sm text-scai-muted mb-6">You are about to buy this NFT on SCAI Mainnet.</p>

        <div className="flex items-center gap-4 p-4 bg-white/[0.03] border border-white/[0.07] rounded-xl mb-5">
          {nft.imageUrl
            ? <img src={nft.imageUrl} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
            : <div className="w-16 h-16 rounded-lg bg-scai-primary/10 flex items-center justify-center text-2xl flex-shrink-0">◈</div>
          }
          <div>
            <p className="font-semibold text-scai-text">{nft.name || `NFT #${nft.tokenId}`}</p>
            <p className="text-xs text-scai-muted mt-0.5">Token #{nft.tokenId}</p>
            <p className="text-xs text-scai-muted mt-0.5 font-mono">Seller: {shorten(listing.seller)}</p>
          </div>
        </div>

        <div className="space-y-2 text-sm mb-6">
          <div className="flex justify-between">
            <span className="text-scai-muted">Price</span>
            <span className="text-scai-text font-medium">{fmtSCAI(listing.price)} SCAI</span>
          </div>
          <div className="flex justify-between">
            <span className="text-scai-muted">Marketplace fee (2%)</span>
            <span className="text-scai-muted">{fmtSCAI(listing.price * 200n / 10000n)} SCAI</span>
          </div>
          <div className="border-t border-white/[0.06] pt-2 flex justify-between font-bold">
            <span className="text-scai-text">You pay</span>
            <span className="text-scai-plit">{fmtSCAI(listing.price)} SCAI</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={onCancel} disabled={isPending} className="btn-outline flex-1">Cancel</button>
          <button onClick={onConfirm} disabled={isPending} className="btn-primary flex-1">
            {isPending ? <><span className="spinner" /> Confirming…</> : "Buy Now"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function NFTDetail({ addToast, dismissToast }) {
  const { tokenId }  = useParams();
  const navigate     = useNavigate();
  const { account, signer, isConnected, isCorrectNetwork, connectWallet } = useWalletContext();

  // Core NFT state
  const [nft,     setNft]     = useState(null);
  const [listing, setListing] = useState(null);   // { seller, price, active }
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error,   setError]   = useState(null);

  // Action state
  const [showListPanel, setShowListPanel] = useState(false);
  const [showBuyModal,  setShowBuyModal]  = useState(false);
  const [buyPending,    setBuyPending]    = useState(false);
  const [copied,        setCopied]        = useState(false);

  const isOwner  = nft && account && nft.owner?.toLowerCase() === account.toLowerCase();
  const isListed = listing?.active;

  // ── Fetch NFT data ──────────────────────────────────────────────────────────
  const fetchNFT = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const id  = BigInt(tokenId);
      const nftContract = new ethers.Contract(CONTRACT_ADDRESSES.NFTMarketplace, NFT_ABI, RPC);
      const mk  = new ethers.Contract(CONTRACT_ADDRESSES.Marketplace, MARKETPLACE_ABI, RPC);

      const [owner, uri] = await Promise.all([
        nftContract.ownerOf(id),
        nftContract.tokenURI(id),
      ]);

      const meta = await fetchMeta(uri);

      let listData = { active: false };
      try {
        const l = await mk.getListing(CONTRACT_ADDRESSES.NFTMarketplace, id);
        listData = l;
      } catch { /* not listed */ }

      setNft({
        tokenId,
        owner,
        name:        meta.name        || `NFT #${tokenId}`,
        description: meta.description || "",
        imageUrl:    resolveImg(meta.image),
        attributes:  meta.attributes  || [],
        uri,
      });
      setListing(listData);
    } catch (err) {
      console.error("fetchNFT:", err);
      setError(err.message?.includes("nonexistent") || err.message?.includes("invalid")
        ? `Token #${tokenId} does not exist on SCAI Mainnet.`
        : "Failed to load NFT data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [tokenId]);

  // ── Fetch event history ─────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const id  = BigInt(tokenId);
      const nftAddr  = CONTRACT_ADDRESSES.NFTMarketplace;
      const nftC = new ethers.Contract(nftAddr, NFT_ABI, RPC);
      const mk   = new ethers.Contract(CONTRACT_ADDRESSES.Marketplace, MARKETPLACE_ABI, RPC);

      const [mintedEvs, listedEvs, cancelledEvs, soldEvsFull, transferEvs] = await Promise.all([
        // Minted(address to, uint256 tokenId, ...)
        nftC.queryFilter(nftC.filters.Minted(null, id), 0, "latest").catch(() => []),
        // Listed(seller, nftContract, tokenId)
        mk.queryFilter(mk.filters.Listed(null, nftAddr, id), 0, "latest").catch(() => []),
        // Cancelled(seller, nftContract, tokenId)
        mk.queryFilter(mk.filters.Cancelled(null, nftAddr, id), 0, "latest").catch(() => []),
        // Sold — tokenId not indexed, filter by nftContract only
        mk.queryFilter(mk.filters.Sold(null, null, nftAddr), 0, "latest").catch(() => []),
        // ERC-721 Transfer(from, to, tokenId)
        nftC.queryFilter(nftC.filters.Transfer(null, null, id), 0, "latest").catch(() => []),
      ]);

      // Filter Sold events by tokenId manually
      const soldEvs = soldEvsFull.filter(e => e.args.tokenId.toString() === tokenId);

      // Build raw event list
      const raw = [
        ...mintedEvs.map(e => ({
          type: "Minted", blockNumber: e.blockNumber, txHash: e.transactionHash,
          from: null, to: e.args.to, price: null,
        })),
        ...listedEvs.map(e => ({
          type: "Listed", blockNumber: e.blockNumber, txHash: e.transactionHash,
          from: e.args.seller, to: null, price: e.args.price,
        })),
        ...soldEvs.map(e => ({
          type: "Sold", blockNumber: e.blockNumber, txHash: e.transactionHash,
          from: e.args.seller, to: e.args.buyer, price: e.args.price,
        })),
        ...cancelledEvs.map(e => ({
          type: "Cancelled", blockNumber: e.blockNumber, txHash: e.transactionHash,
          from: e.args.seller, to: null, price: null,
        })),
        // Filter out the genesis mint transfer (from=0x0) if we already have Minted event
        ...transferEvs
          .filter(e => e.args.from !== ethers.ZeroAddress)
          .map(e => ({
            type: "Transfer", blockNumber: e.blockNumber, txHash: e.transactionHash,
            from: e.args.from, to: e.args.to, price: null,
          })),
      ];

      // Sort by block number desc (newest first)
      raw.sort((a, b) => b.blockNumber - a.blockNumber);

      // Fetch timestamps in parallel (deduplicate block numbers)
      const uniqueBlocks = [...new Set(raw.map(e => e.blockNumber))];
      const times = await Promise.all(uniqueBlocks.map(b => getBlockTime(b)));
      const blockTime = Object.fromEntries(uniqueBlocks.map((b, i) => [b, times[i]]));

      setHistory(raw.map(e => ({ ...e, timestamp: blockTime[e.blockNumber] })));
    } catch (err) {
      console.error("fetchHistory:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, [tokenId]);

  useEffect(() => { fetchNFT(); }, [fetchNFT]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── Buy ──────────────────────────────────────────────────────────────────────
  const handleBuyConfirm = async () => {
    if (!signer || !listing) return;
    setBuyPending(true);
    const pid = addToast({ type: "pending", message: "Waiting for MetaMask…" });
    try {
      const mk = new ethers.Contract(CONTRACT_ADDRESSES.Marketplace, MARKETPLACE_ABI, signer);
      const tx = await mk.buyNFT(CONTRACT_ADDRESSES.NFTMarketplace, BigInt(tokenId), { value: listing.price });
      dismissToast(pid);
      const wid = addToast({ type: "pending", message: "Confirming transaction…" });
      const receipt = await tx.wait();
      dismissToast(wid);
      setShowBuyModal(false);
      addToast({ type: "success", message: `🎉 You now own NFT #${tokenId}!`, link: txLink(receipt.hash), linkLabel: "View Transaction →", duration: 12000 });
      await fetchNFT();
      await fetchHistory();
    } catch (err) {
      dismissToast(pid);
      addToast({ type: "error", message: err.reason || err.message || "Purchase failed.", duration: 8000 });
    } finally {
      setBuyPending(false);
    }
  };

  // ── Cancel listing ───────────────────────────────────────────────────────────
  const handleCancel = async () => {
    if (!signer) return;
    const pid = addToast({ type: "pending", message: `Cancelling listing for NFT #${tokenId}…` });
    try {
      const mk = new ethers.Contract(CONTRACT_ADDRESSES.Marketplace, MARKETPLACE_ABI, signer);
      const tx = await mk.cancelListing(CONTRACT_ADDRESSES.NFTMarketplace, BigInt(tokenId));
      const receipt = await tx.wait();
      dismissToast(pid);
      addToast({ type: "success", message: `Listing cancelled.`, link: txLink(receipt.hash), linkLabel: "View tx →" });
      await fetchNFT();
      await fetchHistory();
    } catch (err) {
      dismissToast(pid);
      addToast({ type: "error", message: err.reason || err.message || "Cancel failed.", duration: 8000 });
    }
  };

  // ── Share ────────────────────────────────────────────────────────────────────
  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  // ── Loading / error states ───────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid lg:grid-cols-2 gap-8">
          <div className="skeleton aspect-square rounded-2xl" />
          <div className="space-y-4 pt-4">
            <div className="skeleton h-8 rounded-full w-3/4" />
            <div className="skeleton h-5 rounded-full w-1/2" />
            <div className="skeleton h-32 rounded-xl w-full mt-6" />
            <div className="skeleton h-12 rounded-xl w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-24 text-center">
        <div className="text-6xl mb-6 opacity-20">⚠️</div>
        <h2 className="text-xl font-bold text-scai-text mb-3">NFT Not Found</h2>
        <p className="text-sm text-scai-muted mb-8">{error}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate(-1)} className="btn-outline">← Go Back</button>
          <Link to="/explore" className="btn-primary">Explore NFTs</Link>
        </div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────────
  return (
    <>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 animate-fade-in">

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-xs text-scai-muted mb-8">
          <Link to="/" className="hover:text-scai-text transition-colors">Home</Link>
          <span>/</span>
          <Link to="/explore" className="hover:text-scai-text transition-colors">Explore</Link>
          <span>/</span>
          <span className="text-scai-label font-medium">NFT #{tokenId}</span>
        </nav>

        {/* ── Top Grid: Image + Info ────────────────────────────────────────── */}
        <div className="grid lg:grid-cols-2 gap-8 mb-12">

          {/* Image */}
          <div className="relative">
            <div className="aspect-square rounded-2xl overflow-hidden bg-scai-bg2 border border-white/[0.08] shadow-card">
              {nft.imageUrl ? (
                <img src={nft.imageUrl} alt={nft.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-8xl text-scai-primary/20">◈</div>
              )}
            </div>

            {/* Network badge */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-scai-bg/80 backdrop-blur-sm border border-scai-success/30 text-xs font-semibold text-scai-success">
              <span className="w-1.5 h-1.5 rounded-full bg-scai-success animate-pulse-dot" />
              SCAI Mainnet
            </div>

            {/* Share button */}
            <button
              onClick={handleShare}
              className="absolute top-3 right-3 w-9 h-9 rounded-full bg-scai-bg/80 backdrop-blur-sm border border-white/10 flex items-center justify-center text-scai-muted hover:text-scai-text transition-colors"
              title="Copy page URL"
            >
              {copied
                ? <svg className="w-4 h-4 text-scai-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
              }
            </button>

            {copied && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-scai-success text-white text-xs font-semibold px-3 py-1.5 rounded-full animate-fade-in shadow-lg">
                Link copied!
              </div>
            )}
          </div>

          {/* Info panel */}
          <div className="flex flex-col">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h1 className="text-3xl font-extrabold text-scai-text leading-tight">{nft.name}</h1>
            </div>

            {/* Token ID */}
            <p className="text-sm text-scai-muted mb-4">
              <span className="font-mono">Token #{tokenId}</span>
            </p>

            {/* Description */}
            {nft.description && (
              <p className="text-sm text-scai-label leading-relaxed mb-6">{nft.description}</p>
            )}

            {/* Metadata rows */}
            <div className="space-y-3 mb-6 p-4 glass-card rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-scai-muted uppercase tracking-wider">Token ID</span>
                <span className="font-mono text-sm text-scai-text">#{tokenId}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-scai-muted uppercase tracking-wider">Contract</span>
                <AddrChip addr={CONTRACT_ADDRESSES.NFTMarketplace} label={shorten(CONTRACT_ADDRESSES.NFTMarketplace)} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-scai-muted uppercase tracking-wider">Owner</span>
                <div className="flex items-center gap-1.5">
                  {isOwner && <span className="badge bg-scai-primary/15 border border-scai-primary/30 text-scai-plit text-[10px] py-0.5">You</span>}
                  <AddrChip addr={nft.owner} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-scai-muted uppercase tracking-wider">Network</span>
                <span className="text-xs text-scai-success font-semibold flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-scai-success" />
                  SCAI Mainnet (34)
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-scai-muted uppercase tracking-wider">Standard</span>
                <span className="text-xs text-scai-text">ERC-721</span>
              </div>
            </div>

            {/* Price & action */}
            {isListed && (
              <div className="p-4 bg-scai-primary/5 border border-scai-primary/20 rounded-xl mb-4">
                <p className="text-xs text-scai-muted mb-1">Listed Price</p>
                <p className="text-3xl font-black gradient-text">{fmtSCAI(listing.price)} SCAI</p>
                <p className="text-xs text-scai-muted mt-1">≈ 2% marketplace fee applies</p>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-3 mt-auto">
              {!isConnected ? (
                <button onClick={connectWallet} className="btn-primary w-full py-3">
                  Connect Wallet to Buy / List
                </button>
              ) : !isCorrectNetwork ? (
                <button onClick={connectWallet} className="w-full py-3 rounded-xl font-semibold text-sm bg-scai-warn/10 border border-scai-warn/40 text-scai-warn hover:bg-scai-warn/20 transition-all">
                  ⚠️ Switch to SCAI Mainnet
                </button>
              ) : isOwner ? (
                isListed ? (
                  <button onClick={handleCancel} className="w-full py-3 rounded-xl font-semibold text-sm border border-scai-error/40 text-scai-error hover:bg-scai-error/10 transition-all">
                    Cancel Listing
                  </button>
                ) : (
                  <>
                    <button onClick={() => setShowListPanel(v => !v)} className="btn-primary w-full py-3">
                      {showListPanel ? "Hide" : "List for Sale"}
                    </button>
                    {showListPanel && (
                      <ListPanel
                        tokenId={tokenId}
                        signer={signer}
                        addToast={addToast}
                        onDone={async () => { setShowListPanel(false); await fetchNFT(); await fetchHistory(); }}
                      />
                    )}
                  </>
                )
              ) : isListed ? (
                <button onClick={() => setShowBuyModal(true)} className="btn-primary w-full py-3 text-base">
                  Buy Now — {fmtSCAI(listing.price)} SCAI
                </button>
              ) : (
                <div className="py-3 text-center text-sm text-scai-muted border border-white/[0.06] rounded-xl">
                  Not currently listed for sale
                </div>
              )}

              {/* Explorer link */}
              <a
                href={`${EXPLORER_BASE}/token/${CONTRACT_ADDRESSES.NFTMarketplace}?a=${tokenId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-outline w-full py-2.5 text-sm text-center"
              >
                View on SCAI Explorer ↗
              </a>
            </div>

            {/* Attributes */}
            {nft.attributes?.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-semibold text-scai-muted uppercase tracking-wider mb-3">Attributes</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {nft.attributes.map((attr, i) => (
                    <div key={i} className="p-2.5 bg-scai-primary/5 border border-scai-primary/20 rounded-lg text-center">
                      <p className="text-[10px] text-scai-primary uppercase tracking-wider truncate">{attr.trait_type}</p>
                      <p className="text-sm font-semibold text-scai-text mt-0.5 truncate">{String(attr.value)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Transaction History ───────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-scai-text">Transaction History</h2>
            <button
              onClick={fetchHistory}
              disabled={historyLoading}
              className="btn-outline text-xs px-3 py-1.5"
            >
              {historyLoading ? <span className="spinner !w-3 !h-3" /> : "↻"} Refresh
            </button>
          </div>

          {historyLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="glass-card p-10 text-center">
              <p className="text-scai-muted text-sm">No on-chain history found for this token yet.</p>
            </div>
          ) : (
            <div className="relative space-y-3">
              {/* Vertical timeline line */}
              <div className="absolute left-[18px] top-0 bottom-0 w-px bg-gradient-to-b from-scai-primary/30 via-white/10 to-transparent" />
              <div className="pl-4 space-y-3">
                {history.map((ev, i) => <EventRow key={i} ev={ev} />)}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Buy modal */}
      {showBuyModal && (
        <BuyModal
          nft={nft}
          listing={listing}
          onConfirm={handleBuyConfirm}
          onCancel={() => { if (!buyPending) setShowBuyModal(false); }}
          isPending={buyPending}
        />
      )}
    </>
  );
}
