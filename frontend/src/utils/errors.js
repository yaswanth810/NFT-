// src/utils/errors.js
// ─────────────────────────────────────────────────────────────────────────────
//  Parse raw ethers.js / MetaMask errors into user-friendly toast messages
// ─────────────────────────────────────────────────────────────────────────────

export function parseContractError(err) {
  // User rejected the MetaMask popup
  if (
    err?.code === 4001 ||
    err?.code === "ACTION_REJECTED" ||
    err?.message?.toLowerCase().includes("user rejected") ||
    err?.message?.toLowerCase().includes("user denied")
  ) {
    return "Transaction cancelled — you rejected the MetaMask request.";
  }

  // Wrong network
  if (
    err?.code === 4902 ||
    err?.message?.toLowerCase().includes("chain") ||
    err?.message?.toLowerCase().includes("network") ||
    err?.message?.toLowerCase().includes("chainid")
  ) {
    return "Please switch to SCAI Mainnet (Chain ID: 34) in MetaMask.";
  }

  // Insufficient balance / funds
  if (
    err?.message?.toLowerCase().includes("insufficient funds") ||
    err?.message?.toLowerCase().includes("insufficient balance") ||
    err?.code === "INSUFFICIENT_FUNDS"
  ) {
    return "Insufficient SCAI balance to complete this transaction.";
  }

  // Gas estimation failed (usually a revert)
  if (
    err?.code === "UNPREDICTABLE_GAS_LIMIT" ||
    err?.message?.toLowerCase().includes("cannot estimate gas")
  ) {
    return "Transaction would fail — the contract rejected it. Check your inputs and try again.";
  }

  // Nonce too low / already known
  if (err?.message?.toLowerCase().includes("nonce")) {
    return "Transaction nonce error — please reset your MetaMask account activity and retry.";
  }

  // Custom Solidity revert reason (ethers v6 surfaces this in err.reason)
  if (err?.reason) return err.reason;

  // Revert data / error name
  if (err?.data?.message) return err.data.message;

  // Raw message fallback
  if (err?.message) {
    const msg = err.message;
    // Trim very long JSON error blobs
    return msg.length > 200 ? msg.slice(0, 197) + "…" : msg;
  }

  return "An unexpected error occurred. Please try again.";
}
