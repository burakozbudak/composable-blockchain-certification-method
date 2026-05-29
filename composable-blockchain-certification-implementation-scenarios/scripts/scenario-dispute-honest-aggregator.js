// scripts/scenario-dispute-honest-aggregator.js
//
// SCENARIO 2 — Honest Aggregator Survives a Challenge
// ----------------------------------------------------
// A challenger opens a dispute against a compliant batch. The on-chain
// recompute matches the aggregator's claim, so the challenger LOSES and
// their stake is forfeited to the operator. The batch returns to Pending.

const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [_, operator, challenger] = await ethers.getSigners();
  console.log("\n=== SCENARIO 2: DISPUTE — HONEST AGGREGATOR ===\n");

  const Factory = await ethers.getContractFactory("EnergyStreamDemo");
  const c = await Factory.deploy();
  await c.waitForDeployment();

  await (await c.connect(operator).registerStream("Honest Operator Plant", {
    value: ethers.parseEther("0.01"),
  })).wait();

  const root = await c.demoMerkleRoot();
  // mean carbon intensity claim = 2000 (truthful; matches demoCorrectLeaves)
  await (await c.connect(operator).submitBatch(
    1n,
    root,
    "QmHonest",
    ethers.parseEther("50"),
    ethers.parseEther("2000"),
    ethers.parseEther("80"),
    6n
  )).wait();
  console.log("[1] Operator submitted batch with truthful mean = 2000.");

  console.log("[2] Challenger opens dispute claiming true value = 9999...");
  await (await c.connect(challenger).openChallenge(
    1n,
    "Suspected mean carbon intensity miscalculation",
    ethers.parseEther("9999"),
    { value: ethers.parseEther("0.005") }
  )).wait();

  console.log("[3] Submitting correct leaves — recompute will MATCH...");
  const correct = await c.demoCorrectLeaves(); // mean = 2000
  await (await c.submitProofAndResolve(1n, correct)).wait();

  const dispute = await c.getDispute(1n);
  console.log(`    Challenger won? ${dispute.challengerWon} (expected false)`);

  const stream = await c.getStream(1n);
  console.log(`    Operator stake remaining: ${ethers.formatEther(stream.stakeAmount)} ETH`);

  console.log("\n=== HONEST AGGREGATOR DEFENDED ===\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
