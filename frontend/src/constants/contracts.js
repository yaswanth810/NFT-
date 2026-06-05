// src/constants/contracts.js
// ─────────────────────────────────────────────────────────────────────────────
// SCAI Mainnet — deployed 2026-06-05
// ─────────────────────────────────────────────────────────────────────────────

export const SCAI_CHAIN_ID = 34;
export const SCAI_CHAIN_ID_HEX = "0x22";

export const SCAI_NETWORK = {
  chainId: SCAI_CHAIN_ID_HEX,
  chainName: "SCAI Mainnet",
  nativeCurrency: { name: "SCAI", symbol: "SCAI", decimals: 18 },
  rpcUrls: ["https://mainnet-rpc.scai.network"],
  blockExplorerUrls: ["https://explorer.securechain.ai"],
};

export const EXPLORER_BASE = "https://explorer.securechain.ai";

export const CONTRACT_ADDRESSES = {
  NFTMarketplace: "0x3c47a525EB1B5F470abc06A98829F078E302e245",
  Marketplace:    "0xE6d9eb0559db3f31Ce92C3886c75F208bb4f7e2C",
};

// ── ABIs ──────────────────────────────────────────────────────────────────────

export const NFT_ABI = [
  "function mint(address to, string memory uri_) external payable returns (uint256)",
  "function mintFee() external view returns (uint256)",
  "function totalMinted() external view returns (uint256)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function approve(address to, uint256 tokenId) external",
  "function getApproved(uint256 tokenId) external view returns (address)",
  "function isApprovedForAll(address owner, address operator) external view returns (bool)",
  "function setApprovalForAll(address operator, bool approved) external",
  "function exists(uint256 tokenId) external view returns (bool)",
  "event Minted(address indexed to, uint256 indexed tokenId, string uri, uint256 feePaid)",
  "event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)",
];

export const MARKETPLACE_ABI = [
  "function listNFT(address nftContract, uint256 tokenId, uint256 price) external",
  "function buyNFT(address nftContract, uint256 tokenId) external payable",
  "function cancelListing(address nftContract, uint256 tokenId) external",
  "function updatePrice(address nftContract, uint256 tokenId, uint256 newPrice) external",
  "function getListing(address nftContract, uint256 tokenId) external view returns (tuple(address seller, uint256 price, bool active))",
  "function isListed(address nftContract, uint256 tokenId) external view returns (bool)",
  "function calculateFee(uint256 price) external pure returns (uint256)",
  "function MARKETPLACE_FEE_BPS() external view returns (uint256)",
  "event Listed(address indexed seller, address indexed nftContract, uint256 indexed tokenId, uint256 price)",
  "event Sold(address indexed buyer, address indexed seller, address indexed nftContract, uint256 tokenId, uint256 price, uint256 marketplaceFee, uint256 sellerProceeds)",
  "event Cancelled(address indexed seller, address indexed nftContract, uint256 indexed tokenId)",
];
