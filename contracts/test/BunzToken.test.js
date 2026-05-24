const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("BunzToken", function () {
  let bunz;
  let owner, minter, user1, user2, referrer;

  beforeEach(async function () {
    [owner, minter, user1, user2, referrer] = await ethers.getSigners();

    const BunzToken = await ethers.getContractFactory("BunzToken");
    bunz = await upgrades.deployProxy(BunzToken);
    await bunz.waitForDeployment();

    // Grant minter role
    await bunz.grantRole(await bunz.MINTER_ROLE(), minter.address);
  });

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      expect(await bunz.name()).to.equal("Bunz");
      expect(await bunz.symbol()).to.equal("BZ");
    });

    it("Should mint initial supply to deployer", async function () {
      const initialSupply = await bunz.INITIAL_SUPPLY();
      expect(await bunz.balanceOf(owner.address)).to.equal(initialSupply);
    });
  });

  describe("Rewards", function () {
    it("Should mint rewards with minter role", async function () {
      await bunz.connect(minter).mintRewards(user1.address, ethers.parseEther("1000"));
      expect(await bunz.balanceOf(user1.address)).to.equal(ethers.parseEther("1000"));
    });

    it("Should fail without minter role", async function () {
      await expect(
        bunz.connect(user1).mintRewards(user1.address, ethers.parseEther("1000"))
      ).to.be.reverted;
    });

    it("Should respect max supply", async function () {
      const maxSupply = await bunz.MAX_SUPPLY();
      const currentSupply = await bunz.totalSupply();
      const excess = maxSupply - currentSupply + 1n;

      await expect(
        bunz.connect(minter).mintRewards(user1.address, excess)
      ).to.be.revertedWith("Max supply exceeded");
    });
  });

  describe("Referrals", function () {
    it("Should set referrer with minter role", async function () {
      // Give referrer some tokens
      await bunz.connect(minter).mintRewards(referrer.address, ethers.parseEther("100"));
      
      await bunz.connect(minter).setReferrer(user1.address, referrer.address);
      expect(await bunz.referrers(user1.address)).to.equal(referrer.address);
    });

    it("Should calculate referral bonus", async function () {
      const amount = ethers.parseEther("1000");
      const expectedBonus = amount * 5n / 100n; // 5%
      expect(await bunz.calculateReferralBonus(amount)).to.equal(expectedBonus);
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await bunz.connect(minter).mintRewards(user1.address, ethers.parseEther("1000"));
    });

    it("Should burn tokens for perk", async function () {
      const burnAmount = ethers.parseEther("100");
      await bunz.connect(user1).burnForPerk(burnAmount, 1);
      
      const expectedBalance = ethers.parseEther("900");
      expect(await bunz.balanceOf(user1.address)).to.equal(expectedBalance);
    });

    it("Should track total burned", async function () {
      const burnAmount = ethers.parseEther("100");
      await bunz.connect(user1).burnForPerk(burnAmount, 1);
      
      expect(await bunz.totalBurned()).to.equal(burnAmount);
    });
  });

  describe("Transfer with Burn", function () {
    beforeEach(async function () {
      await bunz.connect(minter).mintRewards(user1.address, ethers.parseEther("1000"));
    });

    it("Should burn 1% on transfer", async function () {
      const transferAmount = ethers.parseEther("100");
      const expectedBurn = transferAmount * 1n / 100n; // 1%
      const expectedReceive = transferAmount - expectedBurn;

      await bunz.connect(user1).transfer(user2.address, transferAmount);
      
      expect(await bunz.balanceOf(user2.address)).to.equal(expectedReceive);
      expect(await bunz.totalBurned()).to.equal(expectedBurn);
    });
  });

  describe("Pausable", function () {
    it("Should pause with pauser role", async function () {
      await bunz.grantRole(await bunz.PAUSER_ROLE(), owner.address);
      await bunz.pause();
      expect(await bunz.paused()).to.be.true;
    });

    it("Should prevent transfers when paused", async function () {
      await bunz.connect(minter).mintRewards(user1.address, ethers.parseEther("100"));
      await bunz.grantRole(await bunz.PAUSER_ROLE(), owner.address);
      await bunz.pause();

      await expect(
        bunz.connect(user1).transfer(user2.address, ethers.parseEther("10"))
      ).to.be.reverted;
    });
  });
});
