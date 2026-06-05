// test/marketplace.test.js
// ─────────────────────────────────────────────────────────────────────────────
//  Full integration test suite — NFTMarketplace.sol + Marketplace.sol
//  Runs on the Hardhat local network (no live chain required).
//
//  Covers:
//    ✓ Minting an NFT
//    ✓ Listing the NFT on the marketplace
//    ✓ Buying the NFT with a second account
//    ✓ Ownership transfer verification
//    ✓ SCAI token (native) balance change assertions
//    ✓ 2% marketplace fee routing to the owner
//    ✓ Edge-cases: double-buy, cancel, insufficient payment, re-list
//
//  Stack: ethers.js v6 + Chai + Hardhat Network Helpers
// ─────────────────────────────────────────────────────────────────────────────

const { expect }     = require("chai");
const { ethers }     = require("hardhat");
const {
  loadFixture,
  setBalance,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// ─────────────────────────────────────────────────────────────────────────────
// Shared fixture — deploy both contracts and mint token #1 to `seller`
// ─────────────────────────────────────────────────────────────────────────────
async function deployFixture() {
  // Accounts
  // owner   → deployer / marketplace fee recipient
  // seller  → mints NFT and lists it
  // buyer   → purchases the listing
  // other   → unrelated third party (used in access-control tests)
  const [owner, seller, buyer, other] = await ethers.getSigners();

  // ── Deploy NFTMarketplace (ERC-721) ─────────────────────────────────────────
  const NFTMarketplaceFactory = await ethers.getContractFactory("NFTMarketplace");
  const nftContract = await NFTMarketplaceFactory.deploy(
    "SCAI NFT Collection",
    "SCAI",
    0n // free minting
  );
  await nftContract.waitForDeployment();

  // ── Deploy Marketplace ───────────────────────────────────────────────────────
  const MarketplaceFactory = await ethers.getContractFactory("Marketplace");
  const marketplace = await MarketplaceFactory.deploy();
  await marketplace.waitForDeployment();

  // ── Mint token #1 to seller ─────────────────────────────────────────────────
  // mintFee = 0, so no value required
  await nftContract.connect(seller).mint(seller.address, "ipfs://QmToken1Metadata");
  // tokenId = 1

  return { nftContract, marketplace, owner, seller, buyer, other };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: list token #1 from `seller` at a given price
// ─────────────────────────────────────────────────────────────────────────────
async function listToken(nftContract, marketplace, seller, price) {
  const marketplaceAddress = await marketplace.getAddress();
  // Approve marketplace as operator for token #1
  await nftContract.connect(seller).approve(marketplaceAddress, 1n);
  // List
  await marketplace.connect(seller).listNFT(
    await nftContract.getAddress(),
    1n,
    price
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. NFTMarketplace — Minting
// ─────────────────────────────────────────────────────────────────────────────
describe("NFTMarketplace — Minting", function () {

  it("should mint token #1 to the seller", async function () {
    const { nftContract, seller } = await loadFixture(deployFixture);
    expect(await nftContract.ownerOf(1n)).to.equal(seller.address);
  });

  it("should store the correct tokenURI", async function () {
    const { nftContract } = await loadFixture(deployFixture);
    expect(await nftContract.tokenURI(1n)).to.equal("ipfs://QmToken1Metadata");
  });

  it("should increment totalMinted to 1 after minting", async function () {
    const { nftContract } = await loadFixture(deployFixture);
    expect(await nftContract.totalMinted()).to.equal(1n);
  });

  it("should mint to a recipient address different from the caller", async function () {
    const { nftContract, seller, other } = await loadFixture(deployFixture);
    // seller mints token #2 directly to `other`
    await nftContract.connect(seller).mint(other.address, "ipfs://QmToken2");
    expect(await nftContract.ownerOf(2n)).to.equal(other.address);
  });

  it("should collect mint fee and allow owner withdrawal", async function () {
    const { nftContract, owner, buyer } = await loadFixture(deployFixture);
    const FEE = ethers.parseEther("0.5");

    // Owner updates fee to 0.5 SCAI
    await nftContract.connect(owner).setMintFee(FEE);

    // buyer mints with exact fee
    await nftContract.connect(buyer).mint(buyer.address, "ipfs://QmFeeToken", { value: FEE });

    // owner withdraws
    await expect(nftContract.connect(owner).withdrawFees())
      .to.changeEtherBalance(owner, FEE);
  });

  it("should revert if insufficient mint fee is sent", async function () {
    const { nftContract, owner, buyer } = await loadFixture(deployFixture);
    await nftContract.connect(owner).setMintFee(ethers.parseEther("1"));

    await expect(
      nftContract.connect(buyer).mint(buyer.address, "ipfs://QmX", {
        value: ethers.parseEther("0.5"),
      })
    ).to.be.revertedWithCustomError(nftContract, "InsufficientMintFee");
  });

  it("should revert if tokenURI is empty", async function () {
    const { nftContract, seller } = await loadFixture(deployFixture);
    await expect(
      nftContract.connect(seller).mint(seller.address, "")
    ).to.be.revertedWithCustomError(nftContract, "EmptyTokenURI");
  });

  it("should refund excess SCAI paid above the mint fee", async function () {
    const { nftContract, owner, buyer } = await loadFixture(deployFixture);
    const FEE  = ethers.parseEther("0.1");
    const SENT = ethers.parseEther("1.0"); // overpay by 0.9 SCAI

    await nftContract.connect(owner).setMintFee(FEE);

    // Only FEE should leave the buyer's account (plus gas — use approx matcher)
    await expect(
      nftContract.connect(buyer).mint(buyer.address, "ipfs://QmRefund", { value: SENT })
    ).to.changeEtherBalance(buyer, -FEE, { includeFee: false }); // approx ignores gas
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Marketplace — Listing
// ─────────────────────────────────────────────────────────────────────────────
describe("Marketplace — Listing", function () {
  const PRICE = ethers.parseEther("10"); // 10 SCAI

  it("should list an NFT and emit the Listed event", async function () {
    const { nftContract, marketplace, seller } = await loadFixture(deployFixture);
    const nftAddress = await nftContract.getAddress();

    await nftContract.connect(seller).approve(await marketplace.getAddress(), 1n);

    await expect(
      marketplace.connect(seller).listNFT(nftAddress, 1n, PRICE)
    )
      .to.emit(marketplace, "Listed")
      .withArgs(seller.address, nftAddress, 1n, PRICE);
  });

  it("should escrow the NFT into the marketplace contract on listing", async function () {
    const { nftContract, marketplace, seller } = await loadFixture(deployFixture);
    await listToken(nftContract, marketplace, seller, PRICE);

    const marketplaceAddress = await marketplace.getAddress();
    expect(await nftContract.ownerOf(1n)).to.equal(marketplaceAddress);
  });

  it("should store correct Listing struct values", async function () {
    const { nftContract, marketplace, seller } = await loadFixture(deployFixture);
    await listToken(nftContract, marketplace, seller, PRICE);

    const listing = await marketplace.getListing(await nftContract.getAddress(), 1n);
    expect(listing.seller).to.equal(seller.address);
    expect(listing.price).to.equal(PRICE);
    expect(listing.active).to.be.true;
  });

  it("should revert if price is zero", async function () {
    const { nftContract, marketplace, seller } = await loadFixture(deployFixture);
    await nftContract.connect(seller).approve(await marketplace.getAddress(), 1n);

    await expect(
      marketplace.connect(seller).listNFT(await nftContract.getAddress(), 1n, 0n)
    ).to.be.revertedWithCustomError(marketplace, "PriceMustBeAboveZero");
  });

  it("should revert if marketplace is not approved", async function () {
    const { nftContract, marketplace, seller } = await loadFixture(deployFixture);

    await expect(
      marketplace.connect(seller).listNFT(await nftContract.getAddress(), 1n, PRICE)
    ).to.be.revertedWithCustomError(marketplace, "MarketplaceNotApproved");
  });

  it("should revert if caller does not own the token", async function () {
    const { nftContract, marketplace, buyer } = await loadFixture(deployFixture);
    await nftContract.connect(buyer).approve(await marketplace.getAddress(), 1n).catch(() => {});

    await expect(
      marketplace.connect(buyer).listNFT(await nftContract.getAddress(), 1n, PRICE)
    ).to.be.revertedWithCustomError(marketplace, "NotTokenOwner");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Marketplace — Buying (core flow)
// ─────────────────────────────────────────────────────────────────────────────
describe("Marketplace — Buying", function () {
  const PRICE = ethers.parseEther("10"); // 10 SCAI

  // Sub-fixture: deploy + mint + list
  async function listedFixture() {
    const base = await deployFixture();
    await listToken(base.nftContract, base.marketplace, base.seller, PRICE);
    return base;
  }

  // ── Ownership transfer ────────────────────────────────────────────────────
  it("should transfer NFT ownership to the buyer", async function () {
    const { nftContract, marketplace, buyer } = await loadFixture(listedFixture);

    await marketplace.connect(buyer).buyNFT(
      await nftContract.getAddress(), 1n, { value: PRICE }
    );

    expect(await nftContract.ownerOf(1n)).to.equal(buyer.address);
  });

  // ── Balance changes ───────────────────────────────────────────────────────
  it("should deduct the full listing price from the buyer's SCAI balance", async function () {
    const { nftContract, marketplace, buyer } = await loadFixture(listedFixture);

    await expect(
      marketplace.connect(buyer).buyNFT(
        await nftContract.getAddress(), 1n, { value: PRICE }
      )
    ).to.changeEtherBalance(buyer, -PRICE, { includeFee: false });
  });

  it("should credit the seller with 98% of the listing price (after 2% fee)", async function () {
    const { nftContract, marketplace, seller, buyer } = await loadFixture(listedFixture);

    const FEE              = (PRICE * 200n) / 10_000n;       // 2% = 0.2 SCAI
    const SELLER_PROCEEDS  = PRICE - FEE;                    //     = 9.8 SCAI

    await expect(
      marketplace.connect(buyer).buyNFT(
        await nftContract.getAddress(), 1n, { value: PRICE }
      )
    ).to.changeEtherBalance(seller, SELLER_PROCEEDS, { includeFee: false });
  });

  it("should send exactly 2% fee to the contract owner", async function () {
    const { nftContract, marketplace, owner, buyer } = await loadFixture(listedFixture);

    const FEE = (PRICE * 200n) / 10_000n; // 0.2 SCAI

    await expect(
      marketplace.connect(buyer).buyNFT(
        await nftContract.getAddress(), 1n, { value: PRICE }
      )
    ).to.changeEtherBalance(owner, FEE, { includeFee: false });
  });

  it("should emit the Sold event with correct parameters", async function () {
    const { nftContract, marketplace, seller, buyer } = await loadFixture(listedFixture);
    const nftAddress = await nftContract.getAddress();

    const FEE             = (PRICE * 200n) / 10_000n;
    const SELLER_PROCEEDS = PRICE - FEE;

    await expect(
      marketplace.connect(buyer).buyNFT(nftAddress, 1n, { value: PRICE })
    )
      .to.emit(marketplace, "Sold")
      .withArgs(
        buyer.address,
        seller.address,
        nftAddress,
        1n,
        PRICE,
        FEE,
        SELLER_PROCEEDS
      );
  });

  it("should mark the listing as inactive after purchase", async function () {
    const { nftContract, marketplace, buyer } = await loadFixture(listedFixture);
    const nftAddress = await nftContract.getAddress();

    await marketplace.connect(buyer).buyNFT(nftAddress, 1n, { value: PRICE });

    const listing = await marketplace.getListing(nftAddress, 1n);
    expect(listing.active).to.be.false;
  });

  // ── Overpayment refund ────────────────────────────────────────────────────
  it("should refund overpayment back to the buyer", async function () {
    const { nftContract, marketplace, buyer } = await loadFixture(listedFixture);

    const OVERPAY = PRICE + ethers.parseEther("5"); // send 15 SCAI for 10 SCAI listing

    // Net cost to buyer should still be exactly PRICE (15 sent, 5 refunded)
    await expect(
      marketplace.connect(buyer).buyNFT(
        await nftContract.getAddress(), 1n, { value: OVERPAY }
      )
    ).to.changeEtherBalance(buyer, -PRICE, { includeFee: false });
  });

  // ── Edge-cases ────────────────────────────────────────────────────────────
  it("should revert when payment is below the listing price", async function () {
    const { nftContract, marketplace, buyer } = await loadFixture(listedFixture);

    await expect(
      marketplace.connect(buyer).buyNFT(
        await nftContract.getAddress(), 1n,
        { value: PRICE - 1n }
      )
    ).to.be.revertedWithCustomError(marketplace, "InsufficientPayment");
  });

  it("should revert on a second buyNFT call for the same token (already sold)", async function () {
    const { nftContract, marketplace, buyer, other } = await loadFixture(listedFixture);
    const nftAddress = await nftContract.getAddress();

    await marketplace.connect(buyer).buyNFT(nftAddress, 1n, { value: PRICE });

    // `other` tries to buy the same (now inactive) listing
    await expect(
      marketplace.connect(other).buyNFT(nftAddress, 1n, { value: PRICE })
    ).to.be.revertedWithCustomError(marketplace, "ListingNotActive");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Marketplace — Cancellation
// ─────────────────────────────────────────────────────────────────────────────
describe("Marketplace — Cancellation", function () {
  const PRICE = ethers.parseEther("5");

  async function listedFixture() {
    const base = await deployFixture();
    await listToken(base.nftContract, base.marketplace, base.seller, PRICE);
    return base;
  }

  it("should return the NFT to the seller on cancellation", async function () {
    const { nftContract, marketplace, seller } = await loadFixture(listedFixture);

    await marketplace.connect(seller).cancelListing(
      await nftContract.getAddress(), 1n
    );

    expect(await nftContract.ownerOf(1n)).to.equal(seller.address);
  });

  it("should emit the Cancelled event", async function () {
    const { nftContract, marketplace, seller } = await loadFixture(listedFixture);
    const nftAddress = await nftContract.getAddress();

    await expect(marketplace.connect(seller).cancelListing(nftAddress, 1n))
      .to.emit(marketplace, "Cancelled")
      .withArgs(seller.address, nftAddress, 1n);
  });

  it("should mark the listing inactive after cancellation", async function () {
    const { nftContract, marketplace, seller } = await loadFixture(listedFixture);
    const nftAddress = await nftContract.getAddress();

    await marketplace.connect(seller).cancelListing(nftAddress, 1n);

    const listing = await marketplace.getListing(nftAddress, 1n);
    expect(listing.active).to.be.false;
  });

  it("should allow the contract owner to cancel any listing (emergency)", async function () {
    const { nftContract, marketplace, seller, owner } = await loadFixture(listedFixture);
    const nftAddress = await nftContract.getAddress();

    await expect(marketplace.connect(owner).cancelListing(nftAddress, 1n))
      .to.emit(marketplace, "Cancelled")
      .withArgs(seller.address, nftAddress, 1n);
  });

  it("should revert if a non-seller third party tries to cancel", async function () {
    const { nftContract, marketplace, other } = await loadFixture(listedFixture);

    await expect(
      marketplace.connect(other).cancelListing(await nftContract.getAddress(), 1n)
    ).to.be.revertedWithCustomError(marketplace, "NotSeller");
  });

  it("should revert if listing is already inactive (double-cancel)", async function () {
    const { nftContract, marketplace, seller } = await loadFixture(listedFixture);
    const nftAddress = await nftContract.getAddress();

    await marketplace.connect(seller).cancelListing(nftAddress, 1n);

    await expect(
      marketplace.connect(seller).cancelListing(nftAddress, 1n)
    ).to.be.revertedWithCustomError(marketplace, "ListingNotActive");
  });

  it("should allow re-listing after cancellation", async function () {
    const { nftContract, marketplace, seller } = await loadFixture(listedFixture);
    const nftAddress  = await nftContract.getAddress();
    const mkAddr      = await marketplace.getAddress();

    // Cancel → seller reclaims NFT
    await marketplace.connect(seller).cancelListing(nftAddress, 1n);

    // Re-approve and re-list at new price
    await nftContract.connect(seller).approve(mkAddr, 1n);
    const newPrice = ethers.parseEther("20");

    await expect(
      marketplace.connect(seller).listNFT(nftAddress, 1n, newPrice)
    )
      .to.emit(marketplace, "Listed")
      .withArgs(seller.address, nftAddress, 1n, newPrice);

    expect((await marketplace.getListing(nftAddress, 1n)).price).to.equal(newPrice);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Marketplace — Price Update
// ─────────────────────────────────────────────────────────────────────────────
describe("Marketplace — Price Update", function () {
  const ORIGINAL_PRICE = ethers.parseEther("5");
  const NEW_PRICE      = ethers.parseEther("8");

  async function listedFixture() {
    const base = await deployFixture();
    await listToken(base.nftContract, base.marketplace, base.seller, ORIGINAL_PRICE);
    return base;
  }

  it("should update price and emit PriceUpdated", async function () {
    const { nftContract, marketplace, seller } = await loadFixture(listedFixture);
    const nftAddress = await nftContract.getAddress();

    await expect(marketplace.connect(seller).updatePrice(nftAddress, 1n, NEW_PRICE))
      .to.emit(marketplace, "PriceUpdated")
      .withArgs(seller.address, nftAddress, 1n, ORIGINAL_PRICE, NEW_PRICE);

    expect((await marketplace.getListing(nftAddress, 1n)).price).to.equal(NEW_PRICE);
  });

  it("should revert if caller is not the seller", async function () {
    const { nftContract, marketplace, other } = await loadFixture(listedFixture);

    await expect(
      marketplace.connect(other).updatePrice(await nftContract.getAddress(), 1n, NEW_PRICE)
    ).to.be.revertedWithCustomError(marketplace, "NotSeller");
  });

  it("should revert if new price is zero", async function () {
    const { nftContract, marketplace, seller } = await loadFixture(listedFixture);

    await expect(
      marketplace.connect(seller).updatePrice(await nftContract.getAddress(), 1n, 0n)
    ).to.be.revertedWithCustomError(marketplace, "PriceMustBeAboveZero");
  });

  it("buyer pays the updated price after a price change", async function () {
    const { nftContract, marketplace, seller, buyer } = await loadFixture(listedFixture);
    const nftAddress = await nftContract.getAddress();

    await marketplace.connect(seller).updatePrice(nftAddress, 1n, NEW_PRICE);

    // Buyer sends exactly the new price
    await expect(
      marketplace.connect(buyer).buyNFT(nftAddress, 1n, { value: NEW_PRICE })
    ).to.changeEtherBalance(buyer, -NEW_PRICE, { includeFee: false });

    expect(await nftContract.ownerOf(1n)).to.equal(buyer.address);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Marketplace — Fee calculation helper
// ─────────────────────────────────────────────────────────────────────────────
describe("Marketplace — Fee helper", function () {
  it("calculateFee returns exactly 2% of a given price", async function () {
    const { marketplace } = await loadFixture(deployFixture);
    const price = ethers.parseEther("100");
    const fee   = await marketplace.calculateFee(price);
    expect(fee).to.equal(ethers.parseEther("2")); // 2% of 100 SCAI = 2 SCAI
  });

  it("isListed returns true for active, false for inactive", async function () {
    const { nftContract, marketplace, seller } = await loadFixture(deployFixture);
    const nftAddress = await nftContract.getAddress();
    const PRICE = ethers.parseEther("1");

    expect(await marketplace.isListed(nftAddress, 1n)).to.be.false;

    await listToken(nftContract, marketplace, seller, PRICE);

    expect(await marketplace.isListed(nftAddress, 1n)).to.be.true;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. End-to-end flow — Mint → List → Buy
// ─────────────────────────────────────────────────────────────────────────────
describe("End-to-End — Mint → List → Buy", function () {

  it("full happy path: seller mints, lists, buyer purchases; all balances correct", async function () {
    const { nftContract, marketplace, owner, seller, buyer } =
      await loadFixture(deployFixture);

    const nftAddress      = await nftContract.getAddress();
    const marketplaceAddr = await marketplace.getAddress();
    const PRICE           = ethers.parseEther("50"); // 50 SCAI

    // ── Step 1: Mint ──────────────────────────────────────────────────────────
    // Token #1 already minted in fixture; mint token #2 fresh here to keep
    // this test self-contained.
    await nftContract.connect(seller).mint(seller.address, "ipfs://QmE2E");
    const tokenId = 2n;

    expect(await nftContract.ownerOf(tokenId)).to.equal(seller.address);

    // ── Step 2: Approve + List ────────────────────────────────────────────────
    await nftContract.connect(seller).approve(marketplaceAddr, tokenId);
    await marketplace.connect(seller).listNFT(nftAddress, tokenId, PRICE);

    // NFT is now escrowed in marketplace
    expect(await nftContract.ownerOf(tokenId)).to.equal(marketplaceAddr);

    const listing = await marketplace.getListing(nftAddress, tokenId);
    expect(listing.active).to.be.true;
    expect(listing.price).to.equal(PRICE);

    // ── Step 3: Buy ───────────────────────────────────────────────────────────
    const FEE             = (PRICE * 200n) / 10_000n; // 1 SCAI
    const SELLER_PROCEEDS = PRICE - FEE;               // 49 SCAI

    const buyTx = marketplace.connect(buyer).buyNFT(nftAddress, tokenId, { value: PRICE });

    // Ownership transfer
    await buyTx;
    expect(await nftContract.ownerOf(tokenId)).to.equal(buyer.address);

    // Listing deactivated
    expect((await marketplace.getListing(nftAddress, tokenId)).active).to.be.false;

    // ── Step 4: Verify SCAI balance changes ───────────────────────────────────
    // Re-run the transaction via changeEtherBalances for all three parties
    // (we need to re-deploy for accurate comparison, so we use a fresh sub-fixture)

    const [o2, s2, b2] = await ethers.getSigners();

    const nft2  = await (await ethers.getContractFactory("NFTMarketplace")).deploy("T","T",0n);
    const mk2   = await (await ethers.getContractFactory("Marketplace")).deploy();
    await nft2.waitForDeployment();
    await mk2.waitForDeployment();

    await nft2.connect(s2).mint(s2.address, "ipfs://QmSub");
    await nft2.connect(s2).approve(await mk2.getAddress(), 1n);
    await mk2.connect(s2).listNFT(await nft2.getAddress(), 1n, PRICE);

    await expect(
      mk2.connect(b2).buyNFT(await nft2.getAddress(), 1n, { value: PRICE })
    ).to.changeEtherBalances(
      [b2,    s2,                o2 ],
      [-PRICE, SELLER_PROCEEDS,  FEE],
      { includeFee: false }
    );
  });
});
