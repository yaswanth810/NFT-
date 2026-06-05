// src/App.jsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WalletProvider } from "./context/WalletContext";
import { useToast, ToastContainer } from "./components/Toast";
import ErrorBoundary from "./components/ErrorBoundary";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import WrongNetworkBanner from "./components/WrongNetworkBanner";
import Home      from "./pages/Home";
import Explore   from "./pages/Explore";
import Mint      from "./pages/Mint";
import MyNFTs    from "./pages/MyNFTs";
import NFTDetail from "./pages/NFTDetail";

function AppInner() {
  const { toasts, addToast, dismissToast, updateToast } = useToast();

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <WrongNetworkBanner />
      <main className="flex-1">
        <Routes>
          <Route path="/"             element={<Home />} />
          <Route path="/explore"      element={<Explore   addToast={addToast} dismissToast={dismissToast} updateToast={updateToast} />} />
          <Route path="/mint"         element={<Mint      addToast={addToast} dismissToast={dismissToast} updateToast={updateToast} />} />
          <Route path="/my-nfts"      element={<MyNFTs    addToast={addToast} />} />
          <Route path="/nft/:tokenId" element={<NFTDetail addToast={addToast} dismissToast={dismissToast} updateToast={updateToast} />} />
        </Routes>
      </main>
      <Footer />
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <WalletProvider>
          <AppInner />
        </WalletProvider>
      </ErrorBoundary>
    </BrowserRouter>
  );
}
