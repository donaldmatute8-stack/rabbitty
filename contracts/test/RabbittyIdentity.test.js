const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("RabbittyIdentity", function () {
  let identity;
  let owner, minter, xpManager, metadataManager, user1, user2;

  beforeEach(async function () {
    [owner, minter, xpManager, metadataManager, user1, user2] = await ethers.getSigners();

    const RabbittyIdentity = await ethers.getContractFactory("RabbittyIdentity");
    identity = await upgrades.deployProxy(RabbittyIdentity);
    await identity.waitForDeployment();

    // Grant roles
    await identity.grantRole(await identity.MINTER_ROLE(), minter.address);
    await identity.grantRole(await identity.XP_MANAGER_ROLE(), xpManager.address);
    await identity.grantRole(await identity.METADATA_MANAGER_ROLE(), metadataManager.address);
  });

  describe("Deployment", function () {
    it("Should set the right name and symbol", async function () {
      expect(await identity.name()).to.equal("Rabbitty Identity");
      expect(await identity.symbol()).to.equal("RID");
    });

    it("Should grant admin role to deployer", async function () {
      const adminRole = await identity.DEFAULT_ADMIN_ROLE();
      expect(await identity.hasRole(adminRole, owner.address)).to.be.true;
    });
  });

  describe("Minting", function () {
    it("Should mint identity with minter role", async function () {
      await identity.connect(minter).mintIdentity(user1.address, "marco_bull");
      
      expect(await identity.balanceOf(user1.address)).to.equal(1);
      expect(await identity.hasIdentity(user1.address)).to.be.true;
      expect(await identity.usernameToIdentity("marco_bull")).to.not.equal(0);
    });

    it("Should fail without minter role", async function () {
      await expect(
        identity.connect(user1).mintIdentity(user1.address, "hacker")
      ).to.be.reverted;
    });

    it("Should prevent duplicate usernames", async function () {
      await identity.connect(minter).mintIdentity(user1.address, "unique_user");
      await expect(
        identity.connect(minter).mintIdentity(user2.address, "unique_user")
      ).to.be.revertedWith("Username taken");
    });

    it("Should prevent one wallet having multiple identities", async function () {
      await identity.connect(minter).mintIdentity(user1.address, "user1");
      await expect(
        identity.connect(minter).mintIdentity(user1.address, "user2")
      ).to.be.revertedWith("Wallet already has identity");
    });
  });

  describe("Soulbound", function () {
    beforeEach(async function () {
      await identity.connect(minter).mintIdentity(user1.address, "soulbound_test");
    });

    it("Should report as locked (soulbound)", async function () {
      const tokenId = await identity.getIdentityByWallet(user1.address);
      expect(await identity.locked(tokenId)).to.be.true;
    });

    it("Should prevent transfers", async function () {
      await expect(
        identity.connect(user1).transferFrom(user1.address, user2.address, 1)
      ).to.be.revertedWith("Soulbound: non-transferable");
    });
  });

  describe("XP and Leveling", function () {
    beforeEach(async function () {
      await identity.connect(minter).mintIdentity(user1.address, "xp_test");
    });

    it("Should start at level 1", async function () {
      const tokenId = await identity.getIdentityByWallet(user1.address);
      const identityData = await identity.identities(tokenId);
      expect(identityData.level).to.equal(1);
    });

    it("Should add XP and level up", async function () {
      const tokenId = await identity.getIdentityByWallet(user1.address);
      
      await identity.connect(xpManager).addExperience(tokenId, 1500);
      
      const identityData = await identity.identities(tokenId);
      expect(identityData.experience).to.equal(1500);
      expect(identityData.level).to.equal(2); // 1500 / 1000 + 1
    });

    it("Should update power with level", async function () {
      const tokenId = await identity.getIdentityByWallet(user1.address);
      const basePower = await identity.BASE_POWER();
      
      await identity.connect(xpManager).addExperience(tokenId, 1000);
      
      const identityData = await identity.identities(tokenId);
      // Level 2: base_power + (level-1) * 10
      expect(identityData.power).to.equal(basePower + 10n);
    });
  });

  describe("Accessories", function () {
    beforeEach(async function () {
      await identity.connect(minter).mintIdentity(user1.address, "accessory_test");
    });

    it("Should create accessory with admin role", async function () {
      await identity.createAccessory(
        "Golden Badge",
        0, // AccessoryType.BADGE
        3, // rarity
        50, // powerBonus
        false, // not soulbound
        "ipfs://badge_metadata"
      );

      const accessory = await identity.accessories(1);
      expect(accessory.name).to.equal("Golden Badge");
      expect(accessory.powerBonus).to.equal(50);
    });

    it("Should equip accessory", async function () {
      await identity.createAccessory("Test Badge", 0, 1, 25, false, "ipfs://test");
      
      const tokenId = await identity.getIdentityByWallet(user1.address);
      await identity.connect(user1).equipAccessory(tokenId, 1);
      
      const equipped = await identity.getEquippedAccessories(tokenId);
      expect(equipped.length).to.equal(1);
      expect(equipped[0]).to.equal(1);
    });
  });

  describe("Achievements", function () {
    beforeEach(async function () {
      await identity.connect(minter).mintIdentity(user1.address, "achievement_test");
    });

    it("Should unlock achievement", async function () {
      const tokenId = await identity.getIdentityByWallet(user1.address);
      
      await identity.connect(xpManager).unlockAchievement(tokenId, "First Purchase");
      
      // Check by emitting event
      await expect(identity.connect(xpManager).unlockAchievement(tokenId, "Second Purchase"))
        .to.emit(identity, "AchievementUnlocked")
        .withArgs(tokenId, "Second Purchase");
    });
  });
});
