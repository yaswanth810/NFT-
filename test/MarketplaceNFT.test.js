// test/MarketplaceNFT.test.js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("MarketplaceNFT", function () {
  // ── Fixture ───────────────────────────────────────────────────────────────
  async function deployNFTFixture() {
    const [owner, minter, other] = await ethers.getSigners();

    const MarketplaceNFT = await ethers.getContractFactory("MarketplaceNFT");
    const nft = await MarketplaceNFT.deploy(
      "SCAI NFT",
      "SNFT",
      ethers.parseEther("0.01"), // mintFee = 0.01 SCAI
      100n                        // maxSupply = 100
    );
    await nft.waitForDeployment();

    return { nft, owner, minter, other };
  }

  // ── Deployment ────────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("Should have correct name and symbol", async function () {
      const { nft } = await loadFixture(deployNFTFixture);
      expect(await nft.name()).to.equal("SCAI NFT");
      expect(await nft.symbol()).to.equal("SNFT");
    });

    it("Should set the correct mint fee", async function () {
      const { nft } = await loadFixture(deployNFTFixture);
      expect(await nft.mintFee()).to.equal(ethers.parseEther("0.01"));
    });

    it("Should set the correct max supply", async function () {
      const { nft } = await loadFixture(deployNFTFixture);
      expect(await nft.maxSupply()).to.equal(100n);
    });

    it("Should set deployer as owner", async function () {
      const { nft, owner } = await loadFixture(deployNFTFixture);
      expect(await nft.owner()).to.equal(owner.address);
    });
  });

  // ── Minting ───────────────────────────────────────────────────────────────
  describe("Minting", function () {
    it("Should mint with correct fee", async function () {
      const { nft, minter } = await loadFixture(deployNFTFixture);
      const fee = await nft.mintFee();

      await expect(
        nft.connect(minter).mint("ipfs://QmTest", { value: fee })
      )
        .to.emit(nft, "NFTMinted")
        .withArgs(minter.address, 1n, "ipfs://QmTest");

      expect(await nft.ownerOf(1n)).to.equal(minter.address);
      expect(await nft.tokenURI(1n)).to.equal("ipfs://QmTest");
    });

    it("Should increment token ID per mint", async function () {
      const { nft, minter } = await loadFixture(deployNFTFixture);
      const fee = await nft.mintFee();

      await nft.connect(minter).mint("ipfs://1", { value: fee });
      await nft.connect(minter).mint("ipfs://2", { value: fee });
      expect(await nft.totalSupply()).to.equal(2n);
    });

    it("Should revert if insufficient fee", async function () {
      const { nft, minter } = await loadFixture(deployNFTFixture);
      const fee = await nft.mintFee();
      await expect(
        nft.connect(minter).mint("ipfs://QmTest", { value: fee - 1n })
      ).to.be.revertedWith("MarketplaceNFT: insufficient mint fee");
    });

    it("Should refund excess payment", async function () {
      const { nft, minter } = await loadFixture(deployNFTFixture);
      const fee = await nft.mintFee();
      const excess = ethers.parseEther("1");

      await expect(
        nft.connect(minter).mint("ipfs://QmTest", { value: fee + excess })
      ).to.changeEtherBalance(minter, -(fee));
    });

    it("Should revert when max supply is reached", async function () {
      const [owner] = await ethers.getSigners();
      const MarketplaceNFT = await ethers.getContractFactory("MarketplaceNFT");
      // maxSupply = 1
      const nft = await MarketplaceNFT.deploy("Test", "TST", 0n, 1n);
      await nft.waitForDeployment();

      await nft.mint("ipfs://1");
      await expect(nft.mint("ipfs://2")).to.be.revertedWith(
        "MarketplaceNFT: max supply reached"
      );
    });
  });

  // ── Owner Mint ────────────────────────────────────────────────────────────
  describe("Owner Mint", function () {
    it("Should allow owner to airdrop NFT", async function () {
      const { nft, owner, other } = await loadFixture(deployNFTFixture);
      await nft.connect(owner).ownerMint(other.address, "ipfs://airdrop");
      expect(await nft.ownerOf(1n)).to.equal(other.address);
    });

    it("Should revert if non-owner tries owner mint", async function () {
      const { nft, minter, other } = await loadFixture(deployNFTFixture);
      await expect(
        nft.connect(minter).ownerMint(other.address, "ipfs://airdrop")
      ).to.be.reverted;
    });
  });

  // ── Admin ─────────────────────────────────────────────────────────────────
  describe("Admin", function () {
    it("Should update mint fee", async function () {
      const { nft, owner } = await loadFixture(deployNFTFixture);
      const newFee = ethers.parseEther("0.05");
      await expect(nft.connect(owner).setMintFee(newFee))
        .to.emit(nft, "MintFeeUpdated");
      expect(await nft.mintFee()).to.equal(newFee);
    });

    it("Should allow owner to withdraw fees", async function () {
      const { nft, owner, minter } = await loadFixture(deployNFTFixture);
      const fee = await nft.mintFee();
      await nft.connect(minter).mint("ipfs://QmTest", { value: fee });

      await expect(nft.connect(owner).withdraw()).to.changeEtherBalance(owner, fee);
    });

    it("Should revert withdraw if balance is zero", async function () {
      const { nft, owner } = await loadFixture(deployNFTFixture);
      await expect(nft.connect(owner).withdraw()).to.be.revertedWith(
        "MarketplaceNFT: nothing to withdraw"
      );
    });
  });
});
