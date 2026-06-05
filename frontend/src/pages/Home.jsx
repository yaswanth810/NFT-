// src/pages/Home.jsx
// ─────────────────────────────────────────────────────────────────────────────
//  Home / Landing page with live on-chain stats
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ethers } from "ethers";
import { useWalletContext } from "../context/WalletContext";
import {
  CONTRACT_ADDRESSES, NFT_ABI, MARKETPLACE_ABI, SCAI_NETWORK,
} from "../constants/contracts";

const RPC = new ethers.JsonRpcProvider(SCAI_NETWORK.rpcUrls[0]);

const FEATURES = [
  {
    icon: "🎨",
    title: "Mint Instantly",
    desc: "Upload any image, add metadata, and mint your ERC-721 token on SCAI in seconds — powered by Pinata IPFS.",
  },
  {
    icon: "🛒",
    title: "Buy & Sell",
    desc: "List your NFTs at any price in SCAI tokens. A transparent 2% marketplace fee applies to every sale.",
  },
  {
    icon: "⛓️",
    title: "SCAI Native",
    desc: "Built exclusively on SCAI Mainnet (Chain ID: 34). All transactions settle in native SCAI tokens.",
  },
  {
    icon: "🔒",
    title: "Non-Custodial",
    desc: "NFTs are escrowed in the smart contract during listing — your assets stay on-chain, never with us.",
  },
];

// ── Live stats fetcher ─────────────────────────────────────────────────────────

async function fetchLiveStats() {
  try {
    const nft = new ethers.Contract(CONTRACT_ADDRESSES.NFTMarketplace, NFT_ABI, RPC);
    const mk  = new ethers.Contract(CONTRACT_ADDRESSES.Marketplace,    MARKETPLACE_ABI, RPC);

    const [totalMinted, soldEvents, listedEvents, cancelledEvents] = await Promise.all([
      nft.totalMinted().catch(() => 0n),
      mk.queryFilter(mk.filters.Sold(),       0, "latest").catch(() => []),
      mk.queryFilter(mk.filters.Listed(),     0, "latest").catch(() => []),
      mk.queryFilter(mk.filters.Cancelled(),  0, "latest").catch(() => []),
    ]);

    // Total volume = sum of all Sold event prices
    const totalVolume = soldEvents.reduce(
      (acc, ev) => acc + (ev.args?.price ?? 0n), 0n
    );

    // Active listings = Listed minus (Sold + Cancelled) by (nftContract, tokenId)
    const soldKeys      = new Set(soldEvents.map(e      => `${e.args.nftContract}-${e.args.tokenId}`));
    const cancelledKeys = new Set(cancelledEvents.map(e => `${e.args.nftContract}-${e.args.tokenId}`));
    const activeListings = listedEvents.filter(e => {
      const key = `${e.args.nftContract}-${e.args.tokenId}`;
      return !soldKeys.has(key) && !cancelledKeys.has(key);
    });

    return {
      totalMinted:    Number(totalMinted),
      totalVolume,
      activeListings: activeListings.length,
    };
  } catch {
    return { totalMinted: 0, totalVolume: 0n, activeListings: 0 };
  }
}

// ── Animated counter ───────────────────────────────────────────────────────────

function AnimatedStat({ value, label, sub, loading }) {
  return (
    <div className="text-center">
      {loading ? (
        <div className="skeleton h-10 w-24 rounded-full mx-auto mb-2" />
      ) : (
        <p className="text-4xl sm:text-5xl font-black gradient-text">{value}</p>
      )}
      <p className="text-sm font-semibold text-scai-text mt-1">{label}</p>
      {sub && <p className="text-xs text-scai-muted mt-0.5">{sub}</p>}
    </div>
  );
}

export default function Home() {
  const { isConnected, connectWallet, isConnecting } = useWalletContext();
  const [stats,        setStats]        = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => {
    fetchLiveStats().then(s => { setStats(s); setStatsLoading(false); });
  }, []);

  const fmtVol = (wei) => {
    try { return parseFloat(ethers.formatEther(wei)).toFixed(2); }
    catch { return "0.00"; }
  };

  return (
    <div className="overflow-x-hidden">

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative max-w-7xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-20 sm:pb-28 text-center">

        {/* Glowing orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute top-0 left-1/4 w-72 sm:w-96 h-72 sm:h-96 bg-scai-primary/20 rounded-full blur-3xl -translate-y-1/2" />
          <div className="absolute top-1/3 right-1/4 w-56 sm:w-72 h-56 sm:h-72 bg-scai-accent/10 rounded-full blur-3xl" />
        </div>

        {/* Ether Authority logo above hero */}
        <div className="relative flex justify-center mb-8">
          <img
            src="/ether-authority-logo.svg"
            alt="Ether Authority"
            className="h-10 sm:h-12 opacity-80"
          />
        </div>

        {/* Network live badge */}
        <div className="relative inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-scai-primary/10 border border-scai-primary/30 mb-6 animate-fade-in">
          <span className="w-1.5 h-1.5 rounded-full bg-scai-success animate-pulse-dot" />
          <span className="text-xs font-semibold text-scai-plit">Live on SCAI Mainnet ⚡ · Chain ID 34</span>
        </div>

        {/* Headline */}
        <h1 className="relative text-4xl sm:text-5xl lg:text-7xl font-black tracking-tight gradient-text mb-5 animate-slide-up leading-[1.05]">
          Mint, Buy &amp; Trade<br className="hidden sm:block" /> NFTs on SCAI Mainnet
        </h1>

        <p className="relative text-base sm:text-lg text-scai-label max-w-2xl mx-auto mb-10 animate-fade-in leading-relaxed px-2">
          A fully on-chain, non-custodial NFT marketplace. Your assets live on IPFS.
          Your trades settle in native SCAI tokens. Built by{" "}
          <span className="text-scai-plit font-semibold">Ether Authority</span>.
        </p>

        {/* CTA buttons */}
        <div className="relative flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up">
          <Link to="/explore" className="btn-primary text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-3.5 w-full sm:w-auto">
            Explore Marketplace
          </Link>
          <Link to="/mint" className="btn-outline text-sm sm:text-base px-6 sm:px-8 py-3 sm:py-3.5 w-full sm:w-auto">
            Mint NFT
          </Link>
        </div>

        {/* Contract chips */}
        <div className="relative mt-10 flex flex-wrap justify-center gap-2 sm:gap-3 animate-fade-in">
          {[
            { label: "NFTMarketplace", addr: `${CONTRACT_ADDRESSES.NFTMarketplace.slice(0,10)}…` },
            { label: "Marketplace",    addr: `${CONTRACT_ADDRESSES.Marketplace.slice(0,10)}…`    },
          ].map(c => (
            <div key={c.label} className="flex items-center gap-2 glass-card px-3 py-1.5 rounded-full text-xs">
              <span className="text-scai-muted">{c.label}</span>
              <span className="font-mono text-scai-plit">{c.addr}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Live Stats bar ───────────────────────────────────────────────────── */}
      <section className="border-y border-white/[0.06] bg-white/[0.02]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10 grid grid-cols-3 gap-4 sm:gap-8">
          <AnimatedStat
            loading={statsLoading}
            value={stats ? stats.totalMinted.toLocaleString() : "—"}
            label="NFTs Minted"
            sub="On SCAI Mainnet"
          />
          <AnimatedStat
            loading={statsLoading}
            value={stats ? `${fmtVol(stats.totalVolume)} SCAI` : "—"}
            label="Total Volume"
            sub="All-time sales"
          />
          <AnimatedStat
            loading={statsLoading}
            value={stats ? stats.activeListings.toLocaleString() : "—"}
            label="Active Listings"
            sub="Available now"
          />
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="text-center mb-12 sm:mb-14">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-scai-text mb-3">
            Everything you need to trade NFTs
          </h2>
          <p className="text-scai-muted max-w-xl mx-auto text-sm">
            A fully on-chain, non-custodial NFT marketplace — no middlemen, no surprises.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {FEATURES.map(f => (
            <div key={f.title} className="glass-card p-5 sm:p-6 hover:border-scai-primary/30 transition-all duration-300 hover:-translate-y-1 group">
              <div className="text-3xl sm:text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">{f.icon}</div>
              <h3 className="font-bold text-scai-text mb-2 text-sm sm:text-base">{f.title}</h3>
              <p className="text-xs sm:text-sm text-scai-muted leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <div className="glass-card p-6 sm:p-8 border border-scai-primary/20">
          <h2 className="text-xl sm:text-2xl font-extrabold gradient-text text-center mb-8">How it works</h2>
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-8">
            {[
              { n: "01", title: "Mint",   desc: "Upload your image + metadata to IPFS, then mint your ERC-721 on SCAI Mainnet." },
              { n: "02", title: "List",   desc: "Set your price in SCAI tokens. The NFT is safely escrowed in the marketplace contract." },
              { n: "03", title: "Earn",   desc: "Buyer pays the listing price. You receive 98% instantly on-chain — no delays." },
            ].map(step => (
              <div key={step.n} className="relative">
                <span className="text-5xl sm:text-6xl font-black text-scai-primary/10 absolute -top-2 -left-1">{step.n}</span>
                <div className="relative pt-5 sm:pt-6">
                  <h3 className="font-bold text-scai-text text-base sm:text-lg mb-2">{step.title}</h3>
                  <p className="text-xs sm:text-sm text-scai-muted leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ───────────────────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 pb-16 sm:pb-24">
        <div className="relative overflow-hidden rounded-2xl bg-primary-gradient p-8 sm:p-12 text-center shadow-glow-primary">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute top-0 right-0 w-56 sm:w-72 h-56 sm:h-72 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-40 sm:w-48 h-40 sm:h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
          </div>
          <div className="relative">
            {/* Ether Authority logo in CTA */}
            <img src="/ether-authority-logo.svg" alt="Ether Authority" className="h-8 sm:h-10 mx-auto mb-5 brightness-0 invert opacity-80" />
            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">Start creating today</h2>
            <p className="text-white/70 mb-8 max-w-md mx-auto text-sm sm:text-base">
              Connect MetaMask and mint your first NFT on SCAI Mainnet in under 2 minutes. Zero coding required.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
              {!isConnected ? (
                <button
                  onClick={connectWallet}
                  disabled={isConnecting}
                  className="bg-white text-scai-primary font-bold px-6 sm:px-8 py-3 rounded-xl hover:bg-white/90 transition-all hover:-translate-y-0.5 active:scale-95 disabled:opacity-60"
                >
                  {isConnecting ? "Connecting…" : "Connect Wallet"}
                </button>
              ) : (
                <Link to="/mint" className="bg-white text-scai-primary font-bold px-6 sm:px-8 py-3 rounded-xl hover:bg-white/90 transition-all hover:-translate-y-0.5 active:scale-95 text-center">
                  Mint My First NFT
                </Link>
              )}
              <Link to="/explore" className="border border-white/40 text-white font-bold px-6 sm:px-8 py-3 rounded-xl hover:bg-white/10 transition-all hover:-translate-y-0.5 active:scale-95 text-center text-sm sm:text-base">
                Browse Marketplace
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
