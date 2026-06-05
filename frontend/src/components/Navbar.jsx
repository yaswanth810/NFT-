// src/components/Navbar.jsx
import { useState } from "react";
import { NavLink } from "react-router-dom";
import { useWalletContext } from "../context/WalletContext";

function shorten(addr) {
  return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";
}

const NAV_LINKS = [
  { to: "/",        label: "Home",    end: true  },
  { to: "/explore", label: "Explore", end: false },
  { to: "/mint",    label: "Mint",    end: false },
  { to: "/my-nfts", label: "My NFTs", end: false },
];

export default function Navbar() {
  const {
    account, isConnected, isCorrectNetwork,
    isConnecting, connectWallet, disconnectWallet,
  } = useWalletContext();

  const [menuOpen,     setMenuOpen]     = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] backdrop-blur-xl bg-scai-bg/80">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">

        {/* ── Logo: Ether Authority ─────────────────────────────────────────── */}
        <NavLink to="/" className="flex items-center gap-2.5 flex-shrink-0">
          <img
            src="/ether-authority-logo.svg"
            alt="Ether Authority"
            className="h-8 w-auto"
            style={{ maxWidth: 200 }}
          />
        </NavLink>

        {/* ── Desktop nav ──────────────────────────────────────────────────── */}
        <ul className="hidden md:flex items-center gap-1">
          {NAV_LINKS.map(({ to, label, end }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `px-4 py-2 rounded-lg text-sm font-medium transition-colors
                   ${isActive
                     ? "bg-scai-primary/15 text-scai-plit"
                     : "text-scai-label hover:text-scai-text hover:bg-white/[0.04]"
                   }`
                }
              >
                {label}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* ── Right side ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 sm:gap-3">

          {/* Network badge — desktop only */}
          {isConnected && (
            <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border
              ${isCorrectNetwork
                ? "bg-scai-success/10 border-scai-success/30 text-scai-success"
                : "bg-scai-error/10 border-scai-error/30 text-scai-error"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full
                ${isCorrectNetwork ? "bg-scai-success animate-pulse-dot" : "bg-scai-error"}`}
              />
              {isCorrectNetwork ? "SCAI Mainnet" : "Wrong Network"}
            </div>
          )}

          {/* Wallet button */}
          {!isConnected ? (
            <button
              onClick={connectWallet}
              disabled={isConnecting}
              className="btn-primary text-xs sm:text-sm"
            >
              {isConnecting
                ? <><span className="spinner" /><span className="hidden sm:inline">Connecting…</span></>
                : <><span className="hidden sm:inline">Connect Wallet</span><span className="sm:hidden">Connect</span></>
              }
            </button>
          ) : (
            <div className="relative">
              <button
                onClick={() => setShowDropdown(v => !v)}
                className="btn-outline text-xs sm:text-sm"
              >
                <span className="w-2 h-2 rounded-full bg-scai-success animate-pulse-dot" />
                {shorten(account)}
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showDropdown && (
                <div
                  className="absolute right-0 mt-2 w-56 glass-card shadow-card border border-white/[0.1] rounded-xl overflow-hidden animate-fade-in"
                  onBlur={() => setShowDropdown(false)}
                >
                  {/* Address */}
                  <div className="px-4 py-3 border-b border-white/[0.06]">
                    <p className="text-[10px] text-scai-muted uppercase tracking-wider">Connected</p>
                    <p className="text-xs font-mono text-scai-text mt-0.5 truncate">{account}</p>
                  </div>

                  {/* Network pill inside dropdown */}
                  <div className="px-4 py-2 border-b border-white/[0.06]">
                    <div className={`inline-flex items-center gap-1.5 text-xs font-semibold
                      ${isCorrectNetwork ? "text-scai-success" : "text-scai-error"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${isCorrectNetwork ? "bg-scai-success" : "bg-scai-error"}`} />
                      {isCorrectNetwork ? "SCAI Mainnet (34)" : "Wrong Network"}
                    </div>
                  </div>

                  <div className="p-1.5">
                    <a
                      href={`https://explorer.securechain.ai/address/${account}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-scai-label hover:text-scai-text hover:bg-white/[0.04] transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View on Explorer
                    </a>
                    <button
                      onClick={() => { disconnectWallet(); setShowDropdown(false); }}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-scai-error hover:bg-scai-error/10 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Disconnect
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-1.5 text-scai-label hover:text-scai-text transition-colors"
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              {menuOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>
      </nav>

      {/* ── Mobile menu ────────────────────────────────────────────────────── */}
      {menuOpen && (
        <div className="md:hidden border-t border-white/[0.06] bg-scai-bg2/95 animate-fade-in">
          {/* Ether Authority logo in mobile menu */}
          <div className="px-4 pt-4 pb-2 border-b border-white/[0.06]">
            <img src="/ether-authority-logo.svg" alt="Ether Authority" className="h-7 w-auto opacity-70" style={{ maxWidth: 180 }} />
          </div>
          <ul className="px-4 py-3 flex flex-col gap-1">
            {NAV_LINKS.map(({ to, label, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `block px-4 py-2.5 rounded-lg text-sm font-medium transition-colors
                     ${isActive ? "bg-scai-primary/15 text-scai-plit" : "text-scai-label hover:text-scai-text"}`
                  }
                >
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
          {/* Network badge in mobile menu */}
          {isConnected && (
            <div className="px-4 pb-4">
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border
                ${isCorrectNetwork
                  ? "bg-scai-success/10 border-scai-success/30 text-scai-success"
                  : "bg-scai-error/10 border-scai-error/30 text-scai-error"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isCorrectNetwork ? "bg-scai-success animate-pulse-dot" : "bg-scai-error"}`} />
                {isCorrectNetwork ? "SCAI Mainnet" : "Wrong Network"}
              </div>
            </div>
          )}
        </div>
      )}
    </header>
  );
}
