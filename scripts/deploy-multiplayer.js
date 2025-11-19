const hre = require("hardhat");

async function main() {
  console.log("🚀 Deploying MultiplayerGame contract to Push Chain...");
  
  const [deployer] = await hre.ethers.getSigners();
  console.log("📍 Deploying with account:", deployer.address);
  
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", hre.ethers.formatEther(balance), "PC");
  
  // Deploy MultiplayerGame
  const MultiplayerGame = await hre.ethers.getContractFactory("MultiplayerGame");
  const multiplayerGame = await MultiplayerGame.deploy();
  
  await multiplayerGame.waitForDeployment();
  
  const address = await multiplayerGame.getAddress();
  console.log("✅ MultiplayerGame deployed to:", address);
  
  console.log("\n📝 Update your .env file:");
  console.log(`REACT_APP_MULTIPLAYER_GAME_CONTRACT=${address}`);
  
  console.log("\n🔍 Verify on block explorer:");
  console.log(`https://donut.push.network/address/${address}`);
  
  console.log("\n✨ Deployment complete!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
