// test/NFTMarketplace.test.js
// ─────────────────────────────────────────────────────────────────────────────
//  Unit tests for NFTMarketplace.sol  (ERC-721 token contract)
//
//  Contract interface tested:
//    constructor(name_, symbol_, mintFee_)
//    mint(address to, string memory uri_)  payable → returns tokenId
//    tokenURI(uint256 tokenId)             view    → string
//    totalMinted()                         view    → uint256
//    exists(uint256 tokenId)               view    → bool
//    setMintFee(uint256 newFee)            onlyOwner
//    withdrawFees()                        onlyOwner, nonReentrant
//    mintFee()                             view    → uint256
//
//  Errors (custom):
//    EmptyTokenURI, InsufficientMintFee, NothingToWithdraw, NonexistentToken
//
//  Events:
//    Minted(address to, uint256 tokenId, string uri, uint256 feePaid)
//    MintFeeUpdated(uint256 oldFee, uint256 newFee)
//    FeesWithdrawn(address to, uint256 amount)
// ─────────────────────────────────────────────────────────────────────────────

const { expect }     = require("chai");
const { ethers }     = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

/** Deploy with mintFee = 0 (free minting). */
async function deployFreeFixture() {
  const [owner, minter, recipient, other] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("NFTMarketplace");
  const nft = await Factory.deploy(
    "SCAI NFT Collection",
    "SCAI",
    0n   // mintFee = 0 → free
  );
  await nft.waitForDeployment();

  return { nft, owner, minter, recipient, other };
}

/** Deploy with mintFee = 0.1 SCAI. */
async function deployPaidFixture() {
  const [owner, minter, recipient, other] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("NFTMarketplace");
  const nft = await Factory.deploy(
    "SCAI NFT Collection",
    "SCAI",
    ethers.parseEther("0.1")  // mintFee = 0.1 SCAI
  );
  await nft.waitForDeployment();

  return { nft, owner, minter, recipient, other };
}

/** Paid fixture with one token already minted (used for tokenURI / exists tests). */
async function oneTokenMintedFixture() {
  const base = await deployFreeFixture();
  await base.nft.connect(base.minter).mint(base.minter.address, "ipfs://QmFirst");
  return base;  // tokenId #1 owned by minter
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Deployment
// ─────────────────────────────────────────────────────────────────────────────
describe("NFTMarketplace — Deployment", function () {

  it("should set the correct ERC-721 name and symbol", async function () {
    const { nft } = await loadFixture(deployFreeFixture);
    expect(await nft.name()).to.equal("SCAI NFT Collection");
    expect(await nft.symbol()).to.equal("SCAI");
  });

  it("should set the correct initial mintFee (free)", async function () {
    const { nft } = await loadFixture(deployFreeFixture);
    expect(await nft.mintFee()).to.equal(0n);
  });

  it("should set the correct initial mintFee (paid)", async function () {
    const { nft } = await loadFixture(deployPaidFixture);
    expect(await nft.mintFee()).to.equal(ethers.parseEther("0.1"));
  });

  it("should set the deployer as the contract owner", async function () {
    const { nft, owner } = await loadFixture(deployFreeFixture);
    expect(await nft.owner()).to.equal(owner.address);
  });

  it("should start with totalMinted = 0", async function () {
    const { nft } = await loadFixture(deployFreeFixture);
    expect(await nft.totalMinted()).to.equal(0n);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Minting — free
// ─────────────────────────────────────────────────────────────────────────────
describe("NFTMarketplace — Minting (free)", function () {

  it("should mint token #1 and assign ownership to `to`", async function () {
    const { nft, minter, recipient } = await loadFixture(deployFreeFixture);
    await nft.connect(minter).mint(recipient.address, "ipfs://QmA");
    expect(await nft.ownerOf(1n)).to.equal(recipient.address);
  });

  it("should return the new tokenId from mint()", async function () {
    const { nft, minter } = await loadFixture(deployFreeFixture);
    // Call statically to read return value
    const tokenId = await nft.connect(minter).mint.staticCall(minter.address, "ipfs://QmB");
    expect(tokenId).to.equal(1n);
  });

  it("should increment totalMinted after each mint", async function () {
    const { nft, minter } = await loadFixture(deployFreeFixture);
    await nft.connect(minter).mint(minter.address, "ipfs://QmC1");
    expect(await nft.totalMinted()).to.equal(1n);
    await nft.connect(minter).mint(minter.address, "ipfs://QmC2");
    expect(await nft.totalMinted()).to.equal(2n);
  });

  it("should allow caller to mint to a different recipient", async function () {
    const { nft, minter, recipient } = await loadFixture(deployFreeFixture);
    await nft.connect(minter).mint(recipient.address, "ipfs://QmD");
    expect(await nft.ownerOf(1n)).to.equal(recipient.address);
  });

  it("should emit the Minted event with correct args", async function () {
    const { nft, minter } = await loadFixture(deployFreeFixture);
    await expect(nft.connect(minter).mint(minter.address, "ipfs://QmE"))
      .to.emit(nft, "Minted")
      .withArgs(minter.address, 1n, "ipfs://QmE", 0n);
  });

  it("should revert with EmptyTokenURI when uri is empty", async function () {
    const { nft, minter } = await loadFixture(deployFreeFixture);
    await expect(
      nft.connect(minter).mint(minter.address, "")
    ).to.be.revertedWithCustomError(nft, "EmptyTokenURI");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Minting — with fee
// ─────────────────────────────────────────────────────────────────────────────
describe("NFTMarketplace — Minting (with fee)", function () {

  it("should mint successfully when exact fee is sent", async function () {
    const { nft, minter } = await loadFixture(deployPaidFixture);
    const fee = await nft.mintFee();
    await nft.connect(minter).mint(minter.address, "ipfs://QmFee1", { value: fee });
    expect(await nft.ownerOf(1n)).to.equal(minter.address);
  });

  it("should revert with InsufficientMintFee when underpaying", async function () {
    const { nft, minter } = await loadFixture(deployPaidFixture);
    const fee = await nft.mintFee();
    await expect(
      nft.connect(minter).mint(minter.address, "ipfs://QmFee2", { value: fee - 1n })
    ).to.be.revertedWithCustomError(nft, "InsufficientMintFee");
  });

  it("should refund excess SCAI when overpaying", async function () {
    const { nft, minter } = await loadFixture(deployPaidFixture);
    const fee     = await nft.mintFee();
    const excess  = ethers.parseEther("1");

    // Minter's net cost should equal exactly the fee (gas excluded via includeFee:false)
    await expect(
      nft.connect(minter).mint(minter.address, "ipfs://QmFee3", { value: fee + excess })
    ).to.changeEtherBalance(minter, -fee, { includeFee: false });
  });

  it("should accumulate fee in contract balance", async function () {
    const { nft, minter } = await loadFixture(deployPaidFixture);
    const fee = await nft.mintFee();

    await nft.connect(minter).mint(minter.address, "ipfs://QmFee4", { value: fee });
    expect(await ethers.provider.getBalance(await nft.getAddress())).to.equal(fee);
  });

  it("should emit Minted with the fee amount", async function () {
    const { nft, minter } = await loadFixture(deployPaidFixture);
    const fee = await nft.mintFee();

    await expect(
      nft.connect(minter).mint(minter.address, "ipfs://QmFee5", { value: fee })
    )
      .to.emit(nft, "Minted")
      .withArgs(minter.address, 1n, "ipfs://QmFee5", fee);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. tokenURI storage mapping
// ─────────────────────────────────────────────────────────────────────────────
describe("NFTMarketplace — tokenURI storage", function () {

  it("should return the correct URI for a minted token", async function () {
    const { nft } = await loadFixture(oneTokenMintedFixture);
    expect(await nft.tokenURI(1n)).to.equal("ipfs://QmFirst");
  });

  it("should store independent URIs per token", async function () {
    const { nft, minter } = await loadFixture(deployFreeFixture);
    await nft.connect(minter).mint(minter.address, "ipfs://QmAlpha");
    await nft.connect(minter).mint(minter.address, "ipfs://QmBeta");
    await nft.connect(minter).mint(minter.address, "ipfs://QmGamma");

    expect(await nft.tokenURI(1n)).to.equal("ipfs://QmAlpha");
    expect(await nft.tokenURI(2n)).to.equal("ipfs://QmBeta");
    expect(await nft.tokenURI(3n)).to.equal("ipfs://QmGamma");
  });

  it("should revert with NonexistentToken for unminted tokenId", async function () {
    const { nft } = await loadFixture(deployFreeFixture);
    await expect(nft.tokenURI(99n))
      .to.be.revertedWithCustomError(nft, "NonexistentToken");
  });

  it("should accept HTTPS URIs as well as IPFS", async function () {
    const { nft, minter } = await loadFixture(deployFreeFixture);
    const httpsURI = "https://api.example.com/metadata/1.json";
    await nft.connect(minter).mint(minter.address, httpsURI);
    expect(await nft.tokenURI(1n)).to.equal(httpsURI);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. exists() view helper
// ─────────────────────────────────────────────────────────────────────────────
describe("NFTMarketplace — exists()", function () {

  it("should return false for an unminted tokenId", async function () {
    const { nft } = await loadFixture(deployFreeFixture);
    expect(await nft.exists(1n)).to.be.false;
  });

  it("should return true after a token is minted", async function () {
    const { nft } = await loadFixture(oneTokenMintedFixture);
    expect(await nft.exists(1n)).to.be.true;
  });

  it("should return false for a tokenId that was never minted", async function () {
    const { nft } = await loadFixture(oneTokenMintedFixture);
    expect(await nft.exists(999n)).to.be.false;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Admin — setMintFee
// ─────────────────────────────────────────────────────────────────────────────
describe("NFTMarketplace — setMintFee()", function () {

  it("should allow owner to update mintFee", async function () {
    const { nft, owner } = await loadFixture(deployFreeFixture);
    const newFee = ethers.parseEther("0.5");
    await nft.connect(owner).setMintFee(newFee);
    expect(await nft.mintFee()).to.equal(newFee);
  });

  it("should emit MintFeeUpdated with old and new values", async function () {
    const { nft, owner } = await loadFixture(deployFreeFixture);
    const newFee = ethers.parseEther("0.25");
    await expect(nft.connect(owner).setMintFee(newFee))
      .to.emit(nft, "MintFeeUpdated")
      .withArgs(0n, newFee);
  });

  it("should allow owner to set fee back to zero (free minting)", async function () {
    const { nft, owner } = await loadFixture(deployPaidFixture);
    await nft.connect(owner).setMintFee(0n);
    expect(await nft.mintFee()).to.equal(0n);
  });

  it("should revert when non-owner calls setMintFee", async function () {
    const { nft, minter } = await loadFixture(deployFreeFixture);
    await expect(
      nft.connect(minter).setMintFee(ethers.parseEther("1"))
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should use the updated fee for subsequent mints", async function () {
    const { nft, owner, minter } = await loadFixture(deployFreeFixture);
    const newFee = ethers.parseEther("2");
    await nft.connect(owner).setMintFee(newFee);

    // Minting without enough fee should now revert
    await expect(
      nft.connect(minter).mint(minter.address, "ipfs://QmAfterFeeUpdate")
    ).to.be.revertedWithCustomError(nft, "InsufficientMintFee");

    // Minting with the new fee should succeed
    await nft.connect(minter).mint(minter.address, "ipfs://QmAfterFeeUpdate2", { value: newFee });
    expect(await nft.ownerOf(1n)).to.equal(minter.address);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. Admin — withdrawFees
// ─────────────────────────────────────────────────────────────────────────────
describe("NFTMarketplace — withdrawFees()", function () {

  // Named fixture for the withdraw test (loadFixture requires named functions)
  async function paidMintDoneFixture() {
    const base  = await deployPaidFixture();
    const fee   = await base.nft.mintFee();
    await base.nft.connect(base.minter).mint(
      base.minter.address, "ipfs://QmWithdrawTest", { value: fee }
    );
    return { ...base, fee };
  }

  it("should send contract balance to the owner", async function () {
    const { nft, owner, fee } = await loadFixture(paidMintDoneFixture);
    await expect(nft.connect(owner).withdrawFees())
      .to.changeEtherBalance(owner, fee, { includeFee: false });
  });

  it("should emit FeesWithdrawn with correct amount", async function () {
    const { nft, owner, fee } = await loadFixture(paidMintDoneFixture);
    await expect(nft.connect(owner).withdrawFees())
      .to.emit(nft, "FeesWithdrawn")
      .withArgs(owner.address, fee);
  });

  it("should reset the contract balance to 0 after withdrawal", async function () {
    const { nft, owner } = await loadFixture(paidMintDoneFixture);
    await nft.connect(owner).withdrawFees();
    expect(await ethers.provider.getBalance(await nft.getAddress())).to.equal(0n);
  });

  it("should revert with NothingToWithdraw when balance is zero", async function () {
    const { nft, owner } = await loadFixture(deployPaidFixture);
    await expect(nft.connect(owner).withdrawFees())
      .to.be.revertedWithCustomError(nft, "NothingToWithdraw");
  });

  it("should revert when non-owner calls withdrawFees", async function () {
    const { nft, minter } = await loadFixture(paidMintDoneFixture);
    await expect(nft.connect(minter).withdrawFees())
      .to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("should accumulate fees across multiple mints before withdrawal", async function () {
    const { nft, owner, minter, other } = await loadFixture(deployPaidFixture);
    const fee = await nft.mintFee();

    await nft.connect(minter).mint(minter.address, "ipfs://QmM1", { value: fee });
    await nft.connect(other).mint(other.address,   "ipfs://QmM2", { value: fee });
    await nft.connect(minter).mint(minter.address, "ipfs://QmM3", { value: fee });

    const totalFees = fee * 3n;
    await expect(nft.connect(owner).withdrawFees())
      .to.changeEtherBalance(owner, totalFees, { includeFee: false });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. ERC-721 standard behaviour
// ─────────────────────────────────────────────────────────────────────────────
describe("NFTMarketplace — ERC-721 standard", function () {

  it("should support ERC-721 interface (ERC-165)", async function () {
    const { nft } = await loadFixture(deployFreeFixture);
    // ERC-721 interfaceId = 0x80ac58cd
    expect(await nft.supportsInterface("0x80ac58cd")).to.be.true;
  });

  it("should allow token transfer between accounts", async function () {
    const { nft, minter, recipient } = await loadFixture(oneTokenMintedFixture);
    await nft.connect(minter).transferFrom(minter.address, recipient.address, 1n);
    expect(await nft.ownerOf(1n)).to.equal(recipient.address);
  });

  it("should allow approval and transferFrom by approved operator", async function () {
    const { nft, minter, recipient, other } = await loadFixture(oneTokenMintedFixture);
    await nft.connect(minter).approve(other.address, 1n);
    await nft.connect(other).transferFrom(minter.address, recipient.address, 1n);
    expect(await nft.ownerOf(1n)).to.equal(recipient.address);
  });

  it("should update tokenURI correctly even after transfer", async function () {
    const { nft, minter, recipient } = await loadFixture(oneTokenMintedFixture);
    await nft.connect(minter).transferFrom(minter.address, recipient.address, 1n);
    // tokenURI is stored in the mapping — unaffected by transfer
    expect(await nft.tokenURI(1n)).to.equal("ipfs://QmFirst");
  });
});
