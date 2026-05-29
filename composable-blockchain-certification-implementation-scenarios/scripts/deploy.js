// scripts/deploy.js
// Deploys EnergyStreamDemo and prints the address.
const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deployer:", deployer.address);

  const Factory = await hre.ethers.getContractFactory("EnergyStreamDemo");
  const contract = await Factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("EnergyStreamDemo deployed to:", address);
  console.log("Network:", hre.network.name);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
