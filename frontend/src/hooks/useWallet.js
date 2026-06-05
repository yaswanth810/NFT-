// src/hooks/useWallet.js
// ─────────────────────────────────────────────────────────────────────────────
// Custom hook — MetaMask wallet connection for SCAI Mainnet
//
// Provides:
//   connectWallet()   — prompts MetaMask, switches/adds SCAI network
//   disconnectWallet() — clears state
//   account           — connected address (string | null)
//   chainId           — current chain ID (number | null)
//   provider          — ethers BrowserProvider
//   signer            — ethers Signer
//   isConnected       — boolean
//   isCorrectNetwork  — boolean (chainId === 34)
//   isConnecting      — boolean
//   error             — string | null
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback } from "react";
import { ethers } from "ethers";
import { SCAI_CHAIN_ID, SCAI_CHAIN_ID_HEX, SCAI_NETWORK } from "../constants/contracts";

const STORAGE_KEY = "scai_wallet_connected";

export function useWallet() {
  const [account,      setAccount]      = useState(null);
  const [chainId,      setChainId]      = useState(null);
  const [provider,     setProvider]     = useState(null);
  const [signer,       setSigner]       = useState(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error,        setError]        = useState(null);

  const isConnected     = Boolean(account);
  const isCorrectNetwork = chainId === SCAI_CHAIN_ID;

  // ── Internal: build provider/signer from window.ethereum ──────────────────
  const _initProvider = useCallback(async () => {
    const _provider = new ethers.BrowserProvider(window.ethereum);
    const _signer   = await _provider.getSigner();
    const { chainId: cid } = await _provider.getNetwork();
    setProvider(_provider);
    setSigner(_signer);
    setChainId(Number(cid));
    return { _provider, _signer };
  }, []);

  // ── Switch / add SCAI network ──────────────────────────────────────────────
  const _ensureSCAINetwork = useCallback(async () => {
    const currentChain = await window.ethereum.request({ method: "eth_chainId" });
    if (currentChain === SCAI_CHAIN_ID_HEX) return;

    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: SCAI_CHAIN_ID_HEX }],
      });
    } catch (switchErr) {
      // 4902 = chain not added to MetaMask yet
      if (switchErr.code === 4902) {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [SCAI_NETWORK],
        });
      } else {
        throw switchErr;
      }
    }
  }, []);

  // ── Connect ────────────────────────────────────────────────────────────────
  const connectWallet = useCallback(async () => {
    if (!window.ethereum) {
      setError("MetaMask is not installed. Please install it to continue.");
      return;
    }
    setIsConnecting(true);
    setError(null);
    try {
      // 1. Request accounts
      const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
      if (!accounts.length) throw new Error("No accounts returned.");

      // 2. Switch / add SCAI Mainnet
      await _ensureSCAINetwork();

      // 3. Build provider & signer
      await _initProvider();
      setAccount(accounts[0]);

      // 4. Persist intent
      localStorage.setItem(STORAGE_KEY, "true");
    } catch (err) {
      console.error("connectWallet:", err);
      setError(err.message || "Connection failed.");
    } finally {
      setIsConnecting(false);
    }
  }, [_ensureSCAINetwork, _initProvider]);

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const disconnectWallet = useCallback(() => {
    setAccount(null);
    setChainId(null);
    setProvider(null);
    setSigner(null);
    setError(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // ── Auto-reconnect on page reload ─────────────────────────────────────────
  useEffect(() => {
    const autoReconnect = async () => {
      if (!window.ethereum) return;
      if (!localStorage.getItem(STORAGE_KEY)) return;

      try {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length) {
          setAccount(accounts[0]);
          await _initProvider();
        } else {
          localStorage.removeItem(STORAGE_KEY);
        }
      } catch (err) {
        console.warn("Auto-reconnect failed:", err);
      }
    };
    autoReconnect();
  }, [_initProvider]);

  // ── Listen for account / chain changes ────────────────────────────────────
  useEffect(() => {
    if (!window.ethereum) return;

    const onAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
      } else {
        setAccount(accounts[0]);
        _initProvider();
      }
    };

    const onChainChanged = (chainIdHex) => {
      setChainId(parseInt(chainIdHex, 16));
      _initProvider();
    };

    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged",    onChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", onAccountsChanged);
      window.ethereum.removeListener("chainChanged",    onChainChanged);
    };
  }, [disconnectWallet, _initProvider]);

  return {
    account,
    chainId,
    provider,
    signer,
    isConnected,
    isCorrectNetwork,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
  };
}
