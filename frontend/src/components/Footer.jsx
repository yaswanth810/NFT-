// src/components/Footer.jsx
import { Link } from "react-router-dom";
import { EXPLORER_BASE, CONTRACT_ADDRESSES } from "../constants/contracts";

const LINKS = {
  Marketplace: [
    { label: "Explore NFTs",  to: "/explore"  },
    { label: "Mint NFT",      to: "/mint"     },
    { label: "My NFTs",       to: "/my-nfts"  },
  ],
  Contracts: [
    {
      label: "NFTMarketplace",
      href:  `${EXPLORER_BASE}/address/${CONTRACT_ADDRESSES.NFTMarketplace}`,
    },
    {
      label: "Marketplace",
      href:  `${EXPLORER_BASE}/address/${CONTRACT_ADDRESSES.Marketplace}`,
    },
  ],
  Network: [
    { label: "SCAI Explorer", href: EXPLORER_BASE },
    { label: "SCAI RPC",      href: "https://mainnet-rpc.scai.network" },
    { label: "Chain ID: 34",  href: EXPLORER_BASE },
  ],
};

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-scai-bg2/60 backdrop-blur-sm mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-12 pb-8">

        {/* Top row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">

          {/* Brand */}
          <div className="lg:col-span-1">
            {/* Ether Authority logo */}
            <img
              src="/ether-authority-logo.svg"
              alt="Ether Authority"
              className="h-9 mb-4"
            />
            <p className="text-sm text-scai-muted leading-relaxed max-w-xs">
              A fully on-chain, non-custodial NFT marketplace built on{" "}
              <span className="text-scai-plit font-medium">SCAI Mainnet</span>.
              Powered by Ether Authority.
            </p>

            {/* Network badge */}
            <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-scai-success/10 border border-scai-success/30 text-xs font-semibold text-scai-success">
              <span className="w-1.5 h-1.5 rounded-full bg-scai-success animate-pulse-dot" />
              Live on SCAI Mainnet ⚡
            </div>
          </div>

          {/* Nav columns */}
          {Object.entries(LINKS).map(([title, items]) => (
            <div key={title}>
              <h3 className="text-xs font-bold uppercase tracking-widest text-scai-muted mb-4">
                {title}
              </h3>
              <ul className="space-y-2.5">
                {items.map((item) => (
                  <li key={item.label}>
                    {"to" in item ? (
                      <Link
                        to={item.to}
                        className="text-sm text-scai-label hover:text-scai-text transition-colors"
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <a
                        href={item.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-scai-label hover:text-scai-plit transition-colors inline-flex items-center gap-1"
                      >
                        {item.label}
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-white/[0.06] pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-scai-muted text-center sm:text-left">
            © {new Date().getFullYear()}{" "}
            <a
              href="https://etherauthority.io"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-scai-plit transition-colors font-medium"
            >
              Ether Authority
            </a>
            . All rights reserved. Deployed on SCAI Mainnet (Chain ID: 34).
          </p>

          <div className="flex items-center gap-3 text-xs text-scai-muted">
            <span className="font-mono">NFTMarketplace:</span>
            <a
              href={`${EXPLORER_BASE}/address/${CONTRACT_ADDRESSES.NFTMarketplace}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-scai-plit hover:text-scai-accent transition-colors"
            >
              {CONTRACT_ADDRESSES.NFTMarketplace.slice(0, 10)}…
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
