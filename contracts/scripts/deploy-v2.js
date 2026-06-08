const { ethers, upgrades } = require("hardhat");
const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying Rabbitty v2 Contracts to Sepolia...");
  console.log("Account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.01")) {
    console.error("❌ Insufficient balance. Need at least 0.01 ETH for Sepolia");
    process.exit(1);
  }

  const deploymentInfo = {
    network: network.name,
    deployer: deployer.address,
    chainId: network.config.chainId,
    contracts: {},
    timestamp: new Date().toISOString()
  };

  // ─── Deploy BunzTokenV2 ───────────────────────────────────────
  console.log("\n📦 Deploying BunzTokenV2...");
  const BunzTokenV2 = await ethers.getContractFactory("BunzTokenV2");
  const bunzToken = await upgrades.deployProxy(BunzTokenV2, [], {
    kind: 'uups',
    initializer: 'initialize'
  });
  await bunzToken.waitForDeployment();
  const bunzTokenAddress = await bunzToken.getAddress();
  console.log("✅ BunzTokenV2 Proxy:", bunzTokenAddress);
  
  const bunzTokenImpl = await upgrades.erc1967.getImplementationAddress(bunzTokenAddress);
  console.log("   Implementation:", bunzTokenImpl);

  deploymentInfo.contracts.BunzTokenV2 = {
    proxy: bunzTokenAddress,
    implementation: bunzTokenImpl
  };

  // ─── Deploy RabbittyTreasury ──────────────────────────────────
  console.log("\n📦 Deploying RabbittyTreasury...");
  const RabbittyTreasury = await ethers.getContractFactory("RabbittyTreasury");
  const treasury = await upgrades.deployProxy(RabbittyTreasury, [
    bunzTokenAddress,           // _bunzToken
    deployer.address            // _feeCollector (usamos deployer por ahora)
  ], {
    kind: 'uups',
    initializer: 'initialize'
  });
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("✅ Treasury Proxy:", treasuryAddress);
  
  const treasuryImpl = await upgrades.erc1967.getImplementationAddress(treasuryAddress);
  console.log("   Implementation:", treasuryImpl);

  deploymentInfo.contracts.RabbittyTreasury = {
    proxy: treasuryAddress,
    implementation: treasuryImpl
  };

  // ─── Deploy RabbittyIdentity (updated) ─────────────────────────
  console.log("\n📦 Deploying RabbittyIdentity...");
  const RabbittyIdentity = await ethers.getContractFactory("RabbittyIdentity");
  const identity = await upgrades.deployProxy(RabbittyIdentity, [], {
    kind: 'uups',
    initializer: 'initialize'
  });
  await identity.waitForDeployment();
  const identityAddress = await identity.getAddress();
  console.log("✅ Identity Proxy:", identityAddress);
  
  const identityImpl = await upgrades.erc1967.getImplementationAddress(identityAddress);
  console.log("   Implementation:", identityImpl);

  deploymentInfo.contracts.RabbittyIdentity = {
    proxy: identityAddress,
    implementation: identityImpl
  };

  // ─── Setup Roles ──────────────────────────────────────────────
  console.log("\n🔧 Setting up roles...");
  
  // Grant TREASURY_ROLE to treasury contract on BunzToken
  await (await bunzToken.grantRole(
    await bunzToken.TREASURY_ROLE(), 
    treasuryAddress
  )).wait();
  console.log("✅ Granted TREASURY_ROLE to Treasury");

  // Grant ORACLE_ROLE to deployer (for testing)
  await (await bunzToken.grantRole(
    await bunzToken.ORACLE_ROLE(), 
    deployer.address
  )).wait();
  console.log("✅ Granted ORACLE_ROLE to Deployer");

  // Add claim signer (deployer for testing)
  await (await bunzToken.setClaimSigner(deployer.address, true)).wait();
  console.log("✅ Added deployer as claim signer");

  // ─── Test the system ──────────────────────────────────────────
  console.log("\n🧪 Testing system...");
  
  // Mint some tokens to deployer for testing
  await (await bunzToken.treasuryMint(ethers.parseEther("10000"))).wait();
  console.log("✅ Minted 10,000 BZ to deployer");

  // Register deployer as business
  await (await bunzToken.registerBusiness(
    ethers.parseEther("1000"),  // initial deposit
    2500                         // 25% reward rate
  )).wait();
  console.log("✅ Registered deployer as business with 25% rate");

  // Check pool balance
  const poolBalance = await bunzToken.getPoolBalance(deployer.address);
  console.log("   Pool balance:", ethers.formatEther(poolBalance), "BZ");

  // ─── Save deployment info ────────────────────────────────────
  const outputPath = path.join(__dirname, '..', 'deployments', `${network.name}-v2.json`);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved to:", outputPath);

  // ─── Summary ──────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(60));
  console.log("Network:", network.name);
  console.log("Chain ID:", network.config.chainId);
  console.log("\nContracts:");
  console.log("  BunzTokenV2:     ", bunzTokenAddress);
  console.log("  Treasury:        ", treasuryAddress);
  console.log("  Identity:        ", identityAddress);
  console.log("\nImplementations:");
  console.log("  BunzTokenV2:     ", bunzTokenImpl);
  console.log("  Treasury:        ", treasuryImpl);
  console.log("  Identity:        ", identityImpl);
  console.log("\nExplorer URLs:");
  console.log("  BunzTokenV2:     ", `https://sepolia.etherscan.io/address/${bunzTokenAddress}`);
  console.log("  Treasury:        ", `https://sepolia.etherscan.io/address/${treasuryAddress}`);
  console.log("  Identity:        ", `https://sepolia.etherscan.io/address/${identityAddress}`);
  console.log("=".repeat(60));

  // ─── Verify commands ──────────────────────────────────────────
  console.log("\n📋 To verify contracts on Etherscan:");
  console.log(`npx hardhat verify --network sepolia ${bunzTokenImpl}`);
  console.log(`npx hardhat verify --network sepolia ${treasuryImpl} "${bunzTokenAddress}" "${deployer.address}"`);
  console.log(`npx hardhat verify --network sepolia ${identityImpl}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
