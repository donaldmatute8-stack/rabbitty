const { ethers, upgrades } = require("hardhat");

async function main() {
  const { network } = require("hardhat");
  const allowedNetworks = ["sepolia", "hardhat", "localhost"];
  if (!allowedNetworks.includes(network.name)) {
    throw new Error(`Network "${network.name}" not allowed. Use one of: ${allowedNetworks.join(", ")}`);
  }

  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying bunz to Sepolia...");
  console.log("Account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  // Deploy bunz (treasury = deployer por ahora)
  console.log("\n📦 Deploying bunz...");
  const Bunz = await ethers.getContractFactory("bunz");
  const bunz = await upgrades.deployProxy(Bunz, [deployer.address], {
    kind: 'uups',
    initializer: 'initialize'
  });
  await bunz.waitForDeployment();
  const bunzAddress = await bunz.getAddress();
  console.log("✅ bunz Proxy:", bunzAddress);
  
  const bunzImpl = await upgrades.erc1967.getImplementationAddress(bunzAddress);
  console.log("   Implementation:", bunzImpl);

  // Register a test business
  console.log("\n🔧 Registering test business...");
  await (await bunz.registerBusiness(
    deployer.address,
    ethers.parseEther("100000"),  // $100K credit
    "restaurante",
    2000  // 20% reward rate
  )).wait();
  console.log("✅ Business registered with $100K credit, 20% rate");

  // Mint test reward
  console.log("\n🧪 Testing mintReward...");
  const testUser = "0x000000000000000000000000000000000000dEaD"; // test address
  const receiptHash = ethers.keccak256(ethers.toUtf8Bytes("test-receipt-001"));
  
  await (await bunz.mintReward(
    deployer.address,  // business
    testUser,          // user
    ethers.parseEther("1000"),  // $1000 purchase
    receiptHash
  )).wait();
  
  const userBalance = await bunz.balanceOf(testUser);
  console.log("✅ Minted reward. User received:", ethers.formatEther(userBalance), "bunz");
  
  // Check treasury fees
  const treasuryBalance = await bunz.balanceOf(deployer.address);
  console.log("   Treasury (fees) received:", ethers.formatEther(treasuryBalance), "bunz");

  console.log("\n" + "=".repeat(50));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=".repeat(50));
  console.log("Network: Sepolia");
  console.log("Chain ID: 11155111");
  console.log("bunz Proxy:", bunzAddress);
  console.log("Implementation:", bunzImpl);
  console.log("Explorer: https://sepolia.etherscan.io/address/" + bunzAddress);
  console.log("=".repeat(50));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
