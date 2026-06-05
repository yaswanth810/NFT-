// src/pages/Mint.jsx
// ─────────────────────────────────────────────────────────────────────────────
//  Mint NFT page
//  Flow: image upload → Pinata IPFS → metadata JSON upload → mint() on-chain
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useRef, useCallback } from "react";
import { ethers } from "ethers";
import { useWalletContext } from "../context/WalletContext";
import { CONTRACT_ADDRESSES, NFT_ABI, EXPLORER_BASE } from "../constants/contracts";
import { uploadFileToPinata, uploadJSONToPinata, ipfsToGateway } from "../utils/pinata";

const STEPS = ["Upload Image", "Upload Metadata", "Mint NFT", "Done"];

function StepIndicator({ current }) {
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((label, i) => (
        <div key={label} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all duration-300
              ${i < current  ? "bg-scai-primary border-scai-primary text-white"
              : i === current ? "bg-scai-primary/20 border-scai-primary text-scai-plit"
              :                 "bg-transparent border-white/20 text-scai-muted"}`}
            >
              {i < current
                ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                : i + 1
              }
            </div>
            <span className={`mt-1.5 text-[10px] font-medium hidden sm:block
              ${i <= current ? "text-scai-plit" : "text-scai-muted"}`}
            >
              {label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-px mx-2 transition-all duration-500
              ${i < current ? "bg-scai-primary" : "bg-white/10"}`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function StatusRow({ status, label, link, linkLabel }) {
  const icons = {
    idle:    <div className="w-4 h-4 rounded-full border-2 border-white/20" />,
    loading: <span className="spinner !w-4 !h-4" />,
    done:    <svg className="w-4 h-4 text-scai-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>,
    error:   <svg className="w-4 h-4 text-scai-error" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>,
  };
  const colors = { idle: "text-scai-muted", loading: "text-scai-text", done: "text-scai-success", error: "text-scai-error" };
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-shrink-0">{icons[status]}</div>
      <span className={`text-sm font-medium ${colors[status]}`}>{label}</span>
      {link && status === "done" && (
        <a href={link} target="_blank" rel="noopener noreferrer"
          className="ml-auto text-xs text-scai-primary hover:text-scai-plit transition-colors flex items-center gap-1">
          {linkLabel || "View"}
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      )}
    </div>
  );
}

export default function Mint({ addToast, dismissToast }) {
  const { account, signer, isConnected, connectWallet, isCorrectNetwork } = useWalletContext();

  // ── Form state ──────────────────────────────────────────────────────────────
  const [name,        setName]        = useState("");
  const [description, setDescription] = useState("");
  const [imageFile,   setImageFile]   = useState(null);
  const [imagePreview,setImagePreview]= useState(null);
  const [isDragging,  setIsDragging]  = useState(false);
  const fileRef = useRef(null);

  // ── Progress state ──────────────────────────────────────────────────────────
  const [step,        setStep]        = useState(-1);        // -1 = idle
  const [isMinting,   setIsMinting]   = useState(false);
  const [mintedId,    setMintedId]    = useState(null);
  const [txHash,      setTxHash]      = useState(null);
  const [imageCID,    setImageCID]    = useState(null);
  const [metaCID,     setMetaCID]     = useState(null);
  const [stepStatus,  setStepStatus]  = useState({ img: "idle", meta: "idle", mint: "idle" });
  const [errorMsg,    setErrorMsg]    = useState(null);

  const setStatus = (key, val) => setStepStatus(p => ({ ...p, [key]: val }));

  // ── Image selection ─────────────────────────────────────────────────────────
  const handleImageSelect = (file) => {
    if (!file || !file.type.startsWith("image/")) return;
    if (file.size > 20 * 1024 * 1024) { addToast({ type: "error", message: "Image must be under 20 MB." }); return; }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const onFileDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageSelect(file);
  }, []);

  // ── Main mint flow ──────────────────────────────────────────────────────────
  const handleMint = async (e) => {
    e.preventDefault();
    if (!imageFile) { addToast({ type: "error", message: "Please select an image." }); return; }
    if (!name.trim()) { addToast({ type: "error", message: "Please enter an NFT name." }); return; }
    if (!isConnected) { connectWallet(); return; }
    if (!isCorrectNetwork) { addToast({ type: "error", message: "Please switch to SCAI Mainnet first." }); return; }

    setIsMinting(true);
    setErrorMsg(null);
    setMintedId(null);
    setTxHash(null);
    setImageCID(null);
    setMetaCID(null);
    setStepStatus({ img: "idle", meta: "idle", mint: "idle" });
    setStep(0);

    // ── Step 1: Upload image to Pinata ───────────────────────────────────────
    let imgCID;
    try {
      setStatus("img", "loading");
      imgCID = await uploadFileToPinata(imageFile, `${name.trim()} — Image`);
      setImageCID(imgCID);
      setStatus("img", "done");
      setStep(1);
    } catch (err) {
      setStatus("img", "error");
      setErrorMsg(err.message);
      addToast({ type: "error", message: `Image upload failed: ${err.message}`, duration: 10000 });
      setIsMinting(false);
      return;
    }

    // ── Step 2: Upload metadata JSON to Pinata ───────────────────────────────
    let metaURI;
    try {
      setStatus("meta", "loading");
      const metadata = {
        name:        name.trim(),
        description: description.trim(),
        image:       `ipfs://${imgCID}`,
        attributes:  [],
      };
      const metaCIDVal = await uploadJSONToPinata(metadata, `${name.trim()} — Metadata`);
      setMetaCID(metaCIDVal);
      metaURI = `ipfs://${metaCIDVal}`;
      setStatus("meta", "done");
      setStep(2);
    } catch (err) {
      setStatus("meta", "error");
      setErrorMsg(err.message);
      addToast({ type: "error", message: `Metadata upload failed: ${err.message}`, duration: 10000 });
      setIsMinting(false);
      return;
    }

    // ── Step 3: Call mint(address, uri_) on NFTMarketplace ───────────────────
    try {
      setStatus("mint", "loading");
      const nft    = new ethers.Contract(CONTRACT_ADDRESSES.NFTMarketplace, NFT_ABI, signer);
      const fee    = await nft.mintFee();

      const pendingId = addToast({ type: "pending", message: "Waiting for MetaMask approval…" });
      const tx = await nft.mint(account, metaURI, { value: fee });
      dismissToast(pendingId);

      const waitId = addToast({ type: "pending", message: `Transaction sent — waiting for block confirmation…` });
      const receipt = await tx.wait();
      dismissToast(waitId);

      setTxHash(receipt.hash);

      // Parse Minted event to extract tokenId
      let tokenId = null;
      const iface = new ethers.Interface(NFT_ABI);
      for (const log of receipt.logs) {
        try {
          const parsed = iface.parseLog(log);
          if (parsed?.name === "Minted") { tokenId = parsed.args.tokenId.toString(); break; }
        } catch { /* skip */ }
      }
      setMintedId(tokenId);
      setStatus("mint", "done");
      setStep(3);

      addToast({
        type:      "success",
        message:   `🎉 NFT${tokenId ? ` #${tokenId}` : ""} minted successfully!`,
        link:      `${EXPLORER_BASE}/tx/${receipt.hash}`,
        linkLabel: "View Transaction →",
        duration:  15000,
      });
    } catch (err) {
      setStatus("mint", "error");
      setErrorMsg(err.reason || err.message || "Minting failed.");
      addToast({ type: "error", message: err.reason || err.message || "Minting failed.", duration: 10000 });
    } finally {
      setIsMinting(false);
    }
  };

  const reset = () => {
    setStep(-1);
    setName(""); setDescription(""); setImageFile(null); setImagePreview(null);
    setMintedId(null); setTxHash(null); setImageCID(null); setMetaCID(null);
    setStepStatus({ img: "idle", meta: "idle", mint: "idle" });
    setErrorMsg(null);
  };

  const isDone = step === 3;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <section className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold gradient-text mb-2">Mint NFT</h1>
        <p className="text-scai-muted text-sm">Upload your artwork to IPFS and mint it on SCAI Mainnet.</p>
      </div>

      {/* Connect wallet prompt */}
      {!isConnected && (
        <div className="glass-card border border-scai-primary/30 p-6 mb-8 flex flex-col sm:flex-row items-center gap-4 animate-fade-in">
          <div className="text-3xl">🔗</div>
          <div className="flex-1 text-center sm:text-left">
            <p className="font-semibold text-scai-text">Wallet not connected</p>
            <p className="text-sm text-scai-muted mt-0.5">Connect MetaMask to mint NFTs on SCAI Mainnet.</p>
          </div>
          <button onClick={connectWallet} className="btn-primary flex-shrink-0">Connect Wallet</button>
        </div>
      )}

      {/* Progress indicator (shown during/after minting) */}
      {step >= 0 && <StepIndicator current={step} />}

      {/* Success card */}
      {isDone && (
        <div className="glass-card border border-scai-success/30 p-6 mb-8 animate-slide-up">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-scai-success/20 flex items-center justify-center flex-shrink-0">
              <svg className="w-5 h-5 text-scai-success" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-scai-text">Minted successfully!</h2>
              {mintedId && <p className="text-sm text-scai-muted">Token ID: <span className="font-mono text-scai-plit">#{mintedId}</span></p>}
            </div>
          </div>
          <div className="space-y-2 text-sm">
            {imageCID && (
              <div className="flex justify-between">
                <span className="text-scai-muted">Image IPFS</span>
                <a href={ipfsToGateway(imageCID)} target="_blank" rel="noopener noreferrer"
                  className="text-scai-primary hover:text-scai-plit font-mono text-xs truncate max-w-[180px]">
                  ipfs://{imageCID.slice(0, 16)}…
                </a>
              </div>
            )}
            {metaCID && (
              <div className="flex justify-between">
                <span className="text-scai-muted">Metadata IPFS</span>
                <a href={ipfsToGateway(metaCID)} target="_blank" rel="noopener noreferrer"
                  className="text-scai-primary hover:text-scai-plit font-mono text-xs truncate max-w-[180px]">
                  ipfs://{metaCID.slice(0, 16)}…
                </a>
              </div>
            )}
            {txHash && (
              <div className="flex justify-between">
                <span className="text-scai-muted">Transaction</span>
                <a href={`${EXPLORER_BASE}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                  className="text-scai-primary hover:text-scai-plit font-mono text-xs">
                  {txHash.slice(0, 10)}… ↗
                </a>
              </div>
            )}
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={reset} className="btn-outline flex-1 text-sm">Mint Another</button>
            {txHash && (
              <a href={`${EXPLORER_BASE}/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                className="btn-primary flex-1 text-sm text-center">
                View on Explorer ↗
              </a>
            )}
          </div>
        </div>
      )}

      {/* Minting form */}
      {!isDone && (
        <form onSubmit={handleMint} className="glass-card p-6 space-y-6 animate-fade-in">

          {/* Image drop zone */}
          <div>
            <label className="form-label">NFT Image *</label>
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onFileDrop}
              className={`relative cursor-pointer border-2 border-dashed rounded-xl transition-all duration-200
                ${isDragging
                  ? "border-scai-primary bg-scai-primary/10 scale-[1.01]"
                  : imagePreview
                    ? "border-white/20 hover:border-scai-primary/50"
                    : "border-white/10 hover:border-scai-primary/40 hover:bg-white/[0.02]"
                }`}
            >
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="w-full max-h-72 object-cover rounded-xl" />
                  <div className="absolute inset-0 flex items-center justify-center rounded-xl opacity-0 hover:opacity-100 bg-black/50 transition-opacity">
                    <p className="text-sm text-white font-medium">Click to change</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                  <svg className="w-12 h-12 text-scai-muted mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm font-medium text-scai-label">Drag & drop or <span className="text-scai-primary">browse</span></p>
                  <p className="text-xs text-scai-muted mt-1">PNG, JPG, GIF, SVG · Max 20 MB</p>
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => handleImageSelect(e.target.files?.[0])}
              />
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="form-label">NFT Name *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Cosmic Voyager #1"
              maxLength={100}
              className="form-input"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="form-label">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe your NFT…"
              rows={3}
              maxLength={1000}
              className="form-input resize-none"
            />
            <p className="text-xs text-scai-muted mt-1 text-right">{description.length}/1000</p>
          </div>

          {/* Progress rows (shown while minting) */}
          {step >= 0 && (
            <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-1">
              <StatusRow status={stepStatus.img}  label="Upload image to IPFS via Pinata"
                link={imageCID ? ipfsToGateway(imageCID) : null} linkLabel="View on IPFS ↗" />
              <StatusRow status={stepStatus.meta} label="Upload metadata JSON to IPFS"
                link={metaCID ? ipfsToGateway(metaCID) : null} linkLabel="View on IPFS ↗" />
              <StatusRow status={stepStatus.mint} label="Mint NFT on SCAI Mainnet"
                link={txHash ? `${EXPLORER_BASE}/tx/${txHash}` : null} linkLabel="View Transaction ↗" />
            </div>
          )}

          {/* Error message */}
          {errorMsg && (
            <div className="flex items-start gap-2 p-3 bg-scai-error/10 border border-scai-error/30 rounded-xl animate-fade-in">
              <svg className="w-4 h-4 text-scai-error flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12A9 9 0 113 12a9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-scai-error">{errorMsg}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isMinting || !isConnected}
            className="btn-primary w-full text-sm py-3"
          >
            {isMinting ? (
              <><span className="spinner" /> {step === 0 ? "Uploading Image…" : step === 1 ? "Uploading Metadata…" : "Minting on SCAI…"}</>
            ) : !isConnected ? (
              "Connect Wallet to Mint"
            ) : (
              "Mint NFT on SCAI Mainnet"
            )}
          </button>

          <p className="text-center text-xs text-scai-muted">
            Your NFT will be minted to <span className="font-mono text-scai-label">{account ? `${account.slice(0,6)}…${account.slice(-4)}` : "your wallet"}</span> on SCAI Mainnet (Chain ID: 34)
          </p>
        </form>
      )}
    </section>
  );
}
