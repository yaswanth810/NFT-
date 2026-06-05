// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// ─────────────────────────────────────────────────────────────────────────────
//  Marketplace.sol
//  NFT Marketplace Logic Contract
//  Compatible with SCAI Mainnet (Chain ID: 34, EVM-compatible)
//  Payments in native SCAI token
// ─────────────────────────────────────────────────────────────────────────────

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/utils/ERC721Holder.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title  Marketplace
 * @notice Decentralized NFT marketplace for listing, buying, and cancelling
 *         ERC-721 tokens.  All settlement uses the native SCAI token.
 *
 * @dev    Key design decisions
 *         ─────────────────────
 *         • Listings are keyed by (nftContract, tokenId) so any ERC-721
 *           collection can be listed without pre-registration.
 *         • On {listNFT} the NFT is transferred into escrow (this contract).
 *           This eliminates the risk of a seller transferring the token after
 *           listing and before a buyer calls {buyNFT}.
 *         • {buyNFT} is protected by {ReentrancyGuard} because it sends SCAI
 *           to both the seller and (on overpay) back to the buyer.
 *         • A 2 % marketplace fee is deducted from every sale and sent
 *           directly to the contract owner.
 *
 * Deployment (SCAI Mainnet)
 * ─────────────────────────
 *   Network : SCAI Mainnet
 *   Chain ID: 34
 *   Currency: SCAI (native)
 */
contract Marketplace is ERC721Holder, Ownable, ReentrancyGuard {

    // ─────────────────────────────────────────────────────────────────────────
    // Constants
    // ─────────────────────────────────────────────────────────────────────────

    /// @notice Basis points denominator (10 000 = 100 %).
    uint256 public constant BASIS_POINTS = 10_000;

    /// @notice Marketplace fee in basis points — 200 bp = 2 %.
    uint256 public constant MARKETPLACE_FEE_BPS = 200;

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Describes a single NFT listing on the marketplace.
     *
     * @param seller  Address of the account that listed the NFT.
     * @param price   Listing price in native SCAI wei.
     * @param active  True while the listing is live; false after a sale or
     *                cancellation.
     */
    struct Listing {
        address seller;
        uint256 price;
        bool    active;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev listings[nftContract][tokenId] => Listing
     *      Outer key: ERC-721 contract address.
     *      Inner key: token ID within that contract.
     */
    mapping(address => mapping(uint256 => Listing)) private _listings;

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Emitted when an NFT is listed for sale.
     * @param seller      Address of the seller.
     * @param nftContract ERC-721 contract address.
     * @param tokenId     Token ID being listed.
     * @param price       Asking price in SCAI wei.
     */
    event Listed(
        address indexed seller,
        address indexed nftContract,
        uint256 indexed tokenId,
        uint256         price
    );

    /**
     * @notice Emitted when a listed NFT is successfully purchased.
     * @param buyer            Address of the buyer.
     * @param seller           Address of the seller.
     * @param nftContract      ERC-721 contract address.
     * @param tokenId          Token ID that was sold.
     * @param price            Final sale price in SCAI wei.
     * @param marketplaceFee   2 % fee sent to the contract owner (SCAI wei).
     * @param sellerProceeds   Amount forwarded to the seller (SCAI wei).
     */
    event Sold(
        address indexed buyer,
        address indexed seller,
        address indexed nftContract,
        uint256         tokenId,
        uint256         price,
        uint256         marketplaceFee,
        uint256         sellerProceeds
    );

    /**
     * @notice Emitted when a seller cancels their listing.
     * @param seller      Address of the seller.
     * @param nftContract ERC-721 contract address.
     * @param tokenId     Token ID whose listing was cancelled.
     */
    event Cancelled(
        address indexed seller,
        address indexed nftContract,
        uint256 indexed tokenId
    );

    /**
     * @notice Emitted when the price of an active listing is updated.
     * @param seller      Address of the seller.
     * @param nftContract ERC-721 contract address.
     * @param tokenId     Token ID.
     * @param oldPrice    Previous price in SCAI wei.
     * @param newPrice    Updated price in SCAI wei.
     */
    event PriceUpdated(
        address indexed seller,
        address indexed nftContract,
        uint256 indexed tokenId,
        uint256         oldPrice,
        uint256         newPrice
    );

    // ─────────────────────────────────────────────────────────────────────────
    // Custom errors
    // ─────────────────────────────────────────────────────────────────────────

    error PriceMustBeAboveZero();
    error MarketplaceNotApproved();
    error NotTokenOwner();
    error ListingNotActive(address nftContract, uint256 tokenId);
    error NotSeller(address nftContract, uint256 tokenId);
    error InsufficientPayment(uint256 required, uint256 sent);
    error FeeSendFailed();
    error SellerPayFailed();
    error RefundFailed();

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor() Ownable() {}

    // ─────────────────────────────────────────────────────────────────────────
    // Core marketplace functions
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice List an ERC-721 NFT for sale at a fixed SCAI price.
     *
     * @dev    The caller must have approved this contract (either via
     *         {IERC721-approve} or {IERC721-setApprovalForAll}) before calling.
     *         The NFT is immediately escrowed into this contract to prevent
     *         front-running or double-listing.
     *
     * @param nftContract Address of the ERC-721 collection.
     * @param tokenId     ID of the token to list.
     * @param price       Listing price in native SCAI wei (must be > 0).
     */
    function listNFT(
        address nftContract,
        uint256 tokenId,
        uint256 price
    ) external {
        if (price == 0) revert PriceMustBeAboveZero();

        IERC721 nft = IERC721(nftContract);

        // Caller must own the token
        if (nft.ownerOf(tokenId) != msg.sender) revert NotTokenOwner();

        // This contract must be approved to transfer the token
        bool approved =
            nft.getApproved(tokenId) == address(this) ||
            nft.isApprovedForAll(msg.sender, address(this));
        if (!approved) revert MarketplaceNotApproved();

        // Transfer NFT into escrow
        nft.safeTransferFrom(msg.sender, address(this), tokenId);

        // Record listing
        _listings[nftContract][tokenId] = Listing({
            seller: msg.sender,
            price:  price,
            active: true
        });

        emit Listed(msg.sender, nftContract, tokenId, price);
    }

    /**
     * @notice Purchase a listed NFT by sending the exact (or more) SCAI.
     *
     * @dev    Protected by {ReentrancyGuard}.
     *         Flow:
     *           1. Validate listing is active and payment ≥ price.
     *           2. Mark listing inactive (checks-effects-interactions).
     *           3. Calculate 2 % marketplace fee and seller proceeds.
     *           4. Transfer NFT to buyer.
     *           5. Send fee to owner, proceeds to seller.
     *           6. Refund any SCAI sent above the listing price.
     *
     * @param nftContract Address of the ERC-721 collection.
     * @param tokenId     ID of the token to purchase.
     */
    function buyNFT(address nftContract, uint256 tokenId)
        external
        payable
        nonReentrant
    {
        Listing storage listing = _listings[nftContract][tokenId];

        if (!listing.active)      revert ListingNotActive(nftContract, tokenId);
        if (msg.value < listing.price) revert InsufficientPayment(listing.price, msg.value);

        // ── Cache values before state mutation ───────────────────────────────
        address seller = listing.seller;
        uint256 price  = listing.price;

        // ── Checks-Effects: mark inactive before any external calls ──────────
        listing.active = false;

        // ── Calculate fee split ──────────────────────────────────────────────
        uint256 marketplaceFee  = (price * MARKETPLACE_FEE_BPS) / BASIS_POINTS;
        uint256 sellerProceeds  = price - marketplaceFee;

        // ── Interactions ─────────────────────────────────────────────────────

        // Transfer NFT from escrow to buyer
        IERC721(nftContract).safeTransferFrom(address(this), msg.sender, tokenId);

        // Send 2 % fee to contract owner
        (bool feeSent, ) = payable(owner()).call{value: marketplaceFee}("");
        if (!feeSent) revert FeeSendFailed();

        // Send remaining 98 % to seller
        (bool sellerPaid, ) = payable(seller).call{value: sellerProceeds}("");
        if (!sellerPaid) revert SellerPayFailed();

        // Refund any overpayment to buyer
        uint256 excess = msg.value - price;
        if (excess > 0) {
            (bool refunded, ) = payable(msg.sender).call{value: excess}("");
            if (!refunded) revert RefundFailed();
        }

        emit Sold(
            msg.sender,
            seller,
            nftContract,
            tokenId,
            price,
            marketplaceFee,
            sellerProceeds
        );
    }

    /**
     * @notice Cancel an active listing and reclaim the escrowed NFT.
     *
     * @dev    Only the original seller (or the contract owner for emergency
     *         delistings) may cancel a listing.
     *
     * @param nftContract Address of the ERC-721 collection.
     * @param tokenId     ID of the token to delist.
     */
    function cancelListing(address nftContract, uint256 tokenId) external {
        Listing storage listing = _listings[nftContract][tokenId];

        if (!listing.active) revert ListingNotActive(nftContract, tokenId);
        if (listing.seller != msg.sender && owner() != msg.sender)
            revert NotSeller(nftContract, tokenId);

        address seller = listing.seller;

        // Mark inactive before external call
        listing.active = false;

        // Return escrowed NFT to the seller
        IERC721(nftContract).safeTransferFrom(address(this), seller, tokenId);

        emit Cancelled(seller, nftContract, tokenId);
    }

    /**
     * @notice Update the price of an active listing.
     *
     * @dev    Only callable by the original seller.
     *
     * @param nftContract Address of the ERC-721 collection.
     * @param tokenId     ID of the listed token.
     * @param newPrice    New asking price in native SCAI wei (must be > 0).
     */
    function updatePrice(
        address nftContract,
        uint256 tokenId,
        uint256 newPrice
    ) external {
        if (newPrice == 0) revert PriceMustBeAboveZero();

        Listing storage listing = _listings[nftContract][tokenId];

        if (!listing.active)              revert ListingNotActive(nftContract, tokenId);
        if (listing.seller != msg.sender) revert NotSeller(nftContract, tokenId);

        uint256 oldPrice  = listing.price;
        listing.price     = newPrice;

        emit PriceUpdated(msg.sender, nftContract, tokenId, oldPrice, newPrice);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // View / pure helpers
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Retrieve the listing details for a given NFT.
     *
     * @param nftContract Address of the ERC-721 collection.
     * @param tokenId     ID of the token to query.
     * @return listing    {Listing} struct: seller, price, active.
     *
     * @dev    Returns the struct even for inactive listings so callers can
     *         inspect historical data on-chain.
     */
    function getListing(address nftContract, uint256 tokenId)
        external
        view
        returns (Listing memory listing)
    {
        listing = _listings[nftContract][tokenId];
    }

    /**
     * @notice Calculate the exact marketplace fee for a given sale price.
     * @param  price Sale price in SCAI wei.
     * @return fee   2 % of `price` in SCAI wei.
     */
    function calculateFee(uint256 price) external pure returns (uint256 fee) {
        fee = (price * MARKETPLACE_FEE_BPS) / BASIS_POINTS;
    }

    /**
     * @notice Returns true if an NFT is currently listed and available for sale.
     * @param nftContract Address of the ERC-721 collection.
     * @param tokenId     ID of the token.
     */
    function isListed(address nftContract, uint256 tokenId)
        external
        view
        returns (bool)
    {
        return _listings[nftContract][tokenId].active;
    }
}
