const { ethers, upgrades } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", balance.toString());

  // Deploy RabbittyIdentity
  console.log("\n🚀 Deploying RabbittyIdentity...");
  const RabbittyIdentity = await ethers.getContractFactory("RabbittyIdentity");
  const identity = await upgrades.deployProxy(RabbittyIdentity);
  await identity.waitForDeployment();
  console.log("✅ RabbittyIdentity deployed to:", await identity.getAddress());

  // Deploy BunzToken
  console.log("\n🚀 Deploying BunzToken...");
  const BunzToken = await ethers.getContractFactory("BunzToken");
  const bunz = await upgrades.deployProxy(BunzToken);
  await bunz.waitForDeployment();
  console.log("✅ BunzToken deployed to:", await bunz.getAddress());

  // Get implementation addresses
  const identityImpl = await upgrades.erc1967.getImplementationAddress(await identity.getAddress());
  const bunzImpl = await upgrades.erc1967.getImplementationAddress(await bunz.getAddress());

  console.log("\n📋 Deployment Summary:");
  console.log("=".repeat(50));
  console.log("RabbittyIdentity Proxy:", await identity.getAddress());
  console.log("RabbittyIdentity Implementation:", identityImpl);
  console.log("BunzToken Proxy:", await bunz.getAddress());
  console.log("BunzToken Implementation:", bunzImpl);
  console.log("=".repeat(50));

  // Save deployment info
  const deploymentInfo = {
    network: network.name,
    deployer: deployer.address,
    contracts: {
      RabbittyIdentity: {
        proxy: await identity.getAddress(),
        implementation: identityImpl
      },
      BunzToken: {
        proxy: await bunz.getAddress(),
        implementation: bunzImpl
      }
    },
    timestamp: new Date().toISOString()
  };

  const fs = require('fs');
  const path = require('path');
  const outputPath = path.join(__dirname, '..', 'deployments', `${network.name}.json`);
  
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(deploymentInfo, null, 2));
  console.log("\n💾 Deployment info saved to:", outputPath);

  // Test minting
  console.log("\n🧪 Testing contracts...");
  
  // Test Identity minting
  const tx1 = await identity.mintIdentity(deployer.address, "deployer_test");
  await tx1.wait();
  const tokenId = await identity.getIdentityByWallet(deployer.address);
  console.log("✅ Test identity minted, Token ID:", tokenId.toString());

  // Test Bunz minting
  const tx2 = await bunz.mintRewards(deployer.address, ethers.parseEther("1000"));
  await tx2.wait();
  const bunzBalance = await bunz.balanceOf(deployer.address);
  console.log("✅ Test tokens minted, Balance:", ethers.formatEther(bunzBalance), "BZ");

  console.log("\n🎉 Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
