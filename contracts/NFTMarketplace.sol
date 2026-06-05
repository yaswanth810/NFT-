// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─────────────────────────────────────────────────────────────────────────────
//  NFTMarketplace.sol
//  ERC-721 NFT Token Contract
//  Compatible with SCAI Mainnet (Chain ID: 34, EVM: paris)
//  Payments in native SCAI token
//  OpenZeppelin: v4.9.x
// ─────────────────────────────────────────────────────────────────────────────

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";  // OZ v4: security/
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title  NFTMarketplace
 * @notice ERC-721 NFT token contract with open minting and an optional mint fee.
 *         All payments use the native SCAI token.
 *
 * @dev    Inherits OpenZeppelin v4 ERC721, Ownable, and ReentrancyGuard.
 *         tokenURI values are stored in a custom mapping so each token carries
 *         an independent IPFS / HTTPS metadata URI.
 *
 * Deployment (SCAI Mainnet)
 * ─────────────────────────
 *   Network  : SCAI Mainnet
 *   Chain ID : 34
 *   EVM      : paris
 *   Currency : SCAI (native)
 */
contract NFTMarketplace is ERC721, Ownable, ReentrancyGuard {
    using Strings for uint256;

    // ─────────────────────────────────────────────────────────────────────────
    // State variables
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Auto-incrementing token ID counter (starts at 1).
    uint256 private _tokenIdCounter;

    /**
     * @notice Optional fee (in native SCAI) required to mint a token.
     *         Set to 0 to allow free minting.
     */
    uint256 public mintFee;

    /**
     * @dev Per-token URI storage.
     *      Each token carries a fully independent metadata pointer
     *      (e.g. a unique IPFS CID per token).
     */
    mapping(uint256 => string) private _tokenURIs;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Emitted whenever a new token is minted.
     * @param to       Recipient address.
     * @param tokenId  Newly minted token ID.
     * @param uri      Metadata URI attached to the token.
     * @param feePaid  Mint fee paid (in SCAI wei); 0 when minting is free.
     */
    event Minted(
        address indexed to,
        uint256 indexed tokenId,
        string  uri,
        uint256 feePaid
    );

    /// @notice Emitted when the owner updates the mint fee.
    event MintFeeUpdated(uint256 oldFee, uint256 newFee);

    /// @notice Emitted when the owner withdraws accumulated mint fees.
    event FeesWithdrawn(address indexed to, uint256 amount);

    // ─────────────────────────────────────────────────────────────────────────
    // Custom errors
    // ─────────────────────────────────────────────────────────────────────────

    error InsufficientMintFee(uint256 required, uint256 sent);
    error EmptyTokenURI();
    error NothingToWithdraw();
    error WithdrawFailed();
    error RefundFailed();
    error NonexistentToken(uint256 tokenId);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @param name_     ERC-721 collection name   (e.g. "SCAI NFT Collection").
     * @param symbol_   ERC-721 collection symbol  (e.g. "SCAI").
     * @param mintFee_  Initial mint fee in SCAI wei (pass 0 for free minting).
     *
     * @dev  OZ v4: Ownable sets owner to msg.sender automatically — no arg needed.
     */
    constructor(
        string memory name_,
        string memory symbol_,
        uint256       mintFee_
    ) ERC721(name_, symbol_) {
        mintFee = mintFee_;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Core — Minting
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Mint a new ERC-721 token to `to` with the supplied metadata URI.
     *
     * @dev    Open to any caller.  When {mintFee} > 0 the caller must send at
     *         least that amount in native SCAI.  Any excess is refunded.
     *
     *         Parameter is named `uri_` (not `tokenURI`) to avoid shadowing the
     *         ERC-721 `tokenURI(uint256)` function.
     *
     * @param  to    Address that will own the newly minted token.
     * @param  uri_  Metadata URI (IPFS CID, HTTPS URL, etc.).
     * @return tokenId  The ID of the newly minted token.
     */
    function mint(address to, string memory uri_)
        external
        payable
        nonReentrant
        returns (uint256 tokenId)
    {
        if (bytes(uri_).length == 0)  revert EmptyTokenURI();
        if (msg.value < mintFee)      revert InsufficientMintFee(mintFee, msg.value);

        tokenId = ++_tokenIdCounter;
        _safeMint(to, tokenId);
        _tokenURIs[tokenId] = uri_;

        emit Minted(to, tokenId, uri_, mintFee);

        // Refund any excess SCAI
        uint256 excess = msg.value - mintFee;
        if (excess > 0) {
            (bool ok, ) = payable(msg.sender).call{value: excess}("");
            if (!ok) revert RefundFailed();
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // ERC-721 override — tokenURI storage mapping
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Returns the metadata URI for token `tokenId`.
     * @dev    Reads from the internal {_tokenURIs} mapping.
     *         OZ v4: uses _exists() instead of _ownerOf() to check validity.
     */
    function tokenURI(uint256 tokenId)
        public
        view
        override
        returns (string memory)
    {
        if (!_exists(tokenId)) revert NonexistentToken(tokenId);
        return _tokenURIs[tokenId];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Update the mint fee. Pass 0 to enable free minting.
    function setMintFee(uint256 newFee) external onlyOwner {
        emit MintFeeUpdated(mintFee, newFee);
        mintFee = newFee;
    }

    /// @notice Withdraw all accumulated mint fees to the owner's address.
    function withdrawFees() external onlyOwner nonReentrant {
        uint256 balance = address(this).balance;
        if (balance == 0) revert NothingToWithdraw();

        (bool ok, ) = payable(owner()).call{value: balance}("");
        if (!ok) revert WithdrawFailed();

        emit FeesWithdrawn(owner(), balance);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View helpers
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Total number of tokens minted so far.
    function totalMinted() external view returns (uint256) {
        return _tokenIdCounter;
    }

    /// @notice Returns true if `tokenId` has been minted and not yet burned.
    /// @dev    OZ v4: uses internal _exists() helper.
    function exists(uint256 tokenId) external view returns (bool) {
        return _exists(tokenId);
    }
}
