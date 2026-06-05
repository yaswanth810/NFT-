// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";  // OZ v4: security/

/**
 * @title  MarketplaceNFT
 * @notice ERC-721 NFT contract with minting capabilities for the NFT Marketplace.
 *         Integrates with the Marketplace contract for listing and trading.
 *
 * @dev    Compatible with OpenZeppelin v4.9.x and SCAI Mainnet (Chain ID: 34, EVM: paris).
 *         Payments in native SCAI token.
 */
contract MarketplaceNFT is ERC721URIStorage, Ownable, ReentrancyGuard {

    // ──────────────────────────────────────────────────────────────────────────
    // State Variables
    // ──────────────────────────────────────────────────────────────────────────

    uint256 private _tokenIdCounter;

    /// @notice Minting fee in SCAI wei (0 = free minting).
    uint256 public mintFee;

    /// @notice Maximum token supply (0 = unlimited).
    uint256 public maxSupply;

    // ──────────────────────────────────────────────────────────────────────────
    // Events
    // ──────────────────────────────────────────────────────────────────────────

    event NFTMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event MintFeeUpdated(uint256 oldFee, uint256 newFee);
    event MaxSupplyUpdated(uint256 oldMax, uint256 newMax);

    // ──────────────────────────────────────────────────────────────────────────
    // Constructor
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * @param name_      ERC-721 collection name.
     * @param symbol_    ERC-721 collection symbol.
     * @param mintFee_   Initial mint fee in SCAI wei (0 = free).
     * @param maxSupply_ Maximum token supply (0 = unlimited).
     *
     * @dev  OZ v4: Ownable sets owner to msg.sender automatically — no arg needed.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256 mintFee_,
        uint256 maxSupply_
    ) ERC721(name_, symbol_) {
        mintFee   = mintFee_;
        maxSupply = maxSupply_;
    }

    // ──────────────────────────────────────────────────────────────────────────
    // External / Public Functions
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * @notice Mint a new NFT to the caller.
     * @param tokenURI_ Metadata URI (IPFS or HTTPS).
     * @return newTokenId The ID of the newly minted token.
     */
    function mint(string calldata tokenURI_)
        external
        payable
        nonReentrant
        returns (uint256 newTokenId)
    {
        require(msg.value >= mintFee, "MarketplaceNFT: insufficient mint fee");
        if (maxSupply > 0) {
            require(_tokenIdCounter < maxSupply, "MarketplaceNFT: max supply reached");
        }

        newTokenId = ++_tokenIdCounter;
        _safeMint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, tokenURI_);

        // Refund excess payment
        if (msg.value > mintFee) {
            (bool success, ) = payable(msg.sender).call{value: msg.value - mintFee}("");
            require(success, "MarketplaceNFT: refund failed");
        }

        emit NFTMinted(msg.sender, newTokenId, tokenURI_);
    }

    /**
     * @notice Owner-only mint directly to a specific address (e.g. airdrops).
     */
    function ownerMint(address to, string calldata tokenURI_)
        external
        onlyOwner
        returns (uint256 newTokenId)
    {
        if (maxSupply > 0) {
            require(_tokenIdCounter < maxSupply, "MarketplaceNFT: max supply reached");
        }

        newTokenId = ++_tokenIdCounter;
        _safeMint(to, newTokenId);
        _setTokenURI(newTokenId, tokenURI_);

        emit NFTMinted(to, newTokenId, tokenURI_);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Admin Functions
    // ──────────────────────────────────────────────────────────────────────────

    /// @notice Update the minting fee (owner only).
    function setMintFee(uint256 newFee) external onlyOwner {
        emit MintFeeUpdated(mintFee, newFee);
        mintFee = newFee;
    }

    /// @notice Update the maximum supply (owner only).
    function setMaxSupply(uint256 newMax) external onlyOwner {
        require(newMax == 0 || newMax >= _tokenIdCounter, "MarketplaceNFT: below current supply");
        emit MaxSupplyUpdated(maxSupply, newMax);
        maxSupply = newMax;
    }

    /// @notice Withdraw accumulated mint fees (owner only).
    function withdraw() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        require(balance > 0, "MarketplaceNFT: nothing to withdraw");
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "MarketplaceNFT: withdraw failed");
    }

    // ──────────────────────────────────────────────────────────────────────────
    // View Functions
    // ──────────────────────────────────────────────────────────────────────────

    /// @notice Total number of tokens minted so far.
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }

    /// @notice Check whether a token exists.
    /// @dev    OZ v4: uses internal _exists() — replaces the v5 _ownerOf() check.
    function exists(uint256 tokenId) external view returns (bool) {
        return _exists(tokenId);
    }
}
