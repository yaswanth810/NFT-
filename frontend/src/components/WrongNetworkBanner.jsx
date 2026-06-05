// src/components/WrongNetworkBanner.jsx
import { useWalletContext } from "../context/WalletContext";
import { SCAI_CHAIN_ID } from "../constants/contracts";

export default function WrongNetworkBanner() {
  const { isConnected, chainId, connectWallet } = useWalletContext();

  if (!isConnected || chainId === SCAI_CHAIN_ID) return null;

  return (
    <div className="bg-scai-warn/10 border-b border-scai-warn/30 px-4 py-2.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <svg className="w-4 h-4 text-scai-warn flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-sm text-scai-warn font-medium">
            Wrong network detected. Please switch to{" "}
            <span className="font-bold">SCAI Mainnet (Chain ID: 34)</span>.
          </p>
        </div>
        <button
          onClick={connectWallet}
          className="flex-shrink-0 text-xs font-semibold text-scai-warn border border-scai-warn/50 px-3 py-1.5 rounded-lg hover:bg-scai-warn/10 transition-colors"
        >
          Switch Network
        </button>
      </div>
    </div>
  );
}
