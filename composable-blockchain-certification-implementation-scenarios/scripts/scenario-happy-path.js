// scripts/scenario-happy-path.js
//
// SCENARIO 1 — Happy Path (no dispute)
// -------------------------------------
// Operator registers a stream, submits a compliant batch, waits for the
// dispute window to close, confirms the batch, and mints an ERC-1155-lite
// green-hydrogen certificate to the buyer.
//
// Expected outcome: certificate minted, no slashing.

const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [deployer, operator, buyer] = await ethers.getSigners();

  console.log("\n=== SCENARIO 1: HAPPY PATH ===\n");

  const Factory = await ethers.getContractFactory("EnergyStreamDemo");
  const c = await Factory.deploy();
  await c.waitForDeployment();
  console.log("Contract:", await c.getAddress());

  // 1. Register stream
  console.log("\n[1] Operator registers stream (0.01 ETH stake)...");
  const tx1 = await c
    .connect(operator)
    .registerStream("Osmaniye PEM 5MW Plant", { value: ethers.parseEther("0.01") });
  await tx1.wait();
  console.log("    Stream #1 registered.");

  // 2. Submit batch (compliant)
  console.log("\n[2] Submitting compliant batch...");
  const root = await c.demoMerkleRoot();
  const tx2 = await c.connect(operator).submitBatch(
    1n,
    root,
    "QmDemoIpfsCidHappyPath",
    ethers.parseEther("50"),    // 50 kWh/kg  (between 39 and 70)
    ethers.parseEther("2000"),  // 2 kg CO2/kg H2  (under 3.38 RFNBO limit)
    ethers.parseEther("100"),   // 100 kg H2
    6n                          // 6 leaves
  );
  await tx2.wait();
  console.log("    Batch #1 submitted, dispute window: 60s.");

  // 3. Fast-forward 61 seconds
  console.log("\n[3] Fast-forwarding 61 seconds...");
  await hre.network.provider.send("evm_increaseTime", [61]);
  await hre.network.provider.send("evm_mine");

  // 4. Confirm batch
  console.log("\n[4] Confirming batch...");
  await (await c.confirmBatch(1n)).wait();
  console.log("    Batch #1 confirmed.");

  // 5. Mint certificate
  console.log("\n[5] Minting certificate to buyer:", buyer.address);
  await (await c.mintCertificate(1n, buyer.address)).wait();
  const bal = await c.balanceOf(1n, buyer.address);
  console.log(`    Certificate minted: ${bal.toString()} kg green H2.`);

  console.log("\n=== HAPPY PATH OK ===\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
