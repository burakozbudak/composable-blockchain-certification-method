// scripts/scenario-dispute-fraud-detected.js
//
// SCENARIO 3 — Fraudulent Aggregator Slashed
// -------------------------------------------
// The operator submits a batch claiming a low mean carbon intensity, but
// the underlying leaves actually average HIGHER. A challenger opens a
// dispute and submits the correct leaves. On-chain recompute disagrees
// with the operator's claim → batch Invalidated, operator slashed,
// challenger rewarded.

const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const [_, operator, challenger] = await ethers.getSigners();
  console.log("\n=== SCENARIO 3: DISPUTE — FRAUD DETECTED ===\n");

  const Factory = await ethers.getContractFactory("EnergyStreamDemo");
  const c = await Factory.deploy();
  await c.waitForDeployment();

  await (await c.connect(operator).registerStream("Sketchy Operator Plant", {
    value: ethers.parseEther("0.01"),
  })).wait();

  const root = await c.demoMerkleRoot();
  // Operator LIES: claims meanCarbonIntensity = 1500 although actual is 2000
  await (await c.connect(operator).submitBatch(
    1n,
    root,
    "QmFraud",
    ethers.parseEther("50"),
    ethers.parseEther("1500"),  // <-- false claim
    ethers.parseEther("120"),
    6n
  )).wait();
  console.log("[1] Operator submitted batch with FALSE mean = 1500 (real = 2000).");

  const chalBalBefore = await ethers.provider.getBalance(challenger.address);

  console.log("[2] Challenger opens dispute (stake = 0.005 ETH)...");
  await (await c.connect(challenger).openChallenge(
    1n,
    "Mean carbon intensity understated",
    ethers.parseEther("2000"),
    { value: ethers.parseEther("0.005") }
  )).wait();

  console.log("[3] Challenger submits correct leaves (avg = 2000)...");
  const correct = await c.demoCorrectLeaves();
  await (await c.submitProofAndResolve(1n, correct)).wait();

  const dispute = await c.getDispute(1n);
  const stream  = await c.getStream(1n);
  const batch   = await c.getBatch(1n);

  console.log(`    Challenger won? ${dispute.challengerWon} (expected true)`);
  console.log(`    Batch status (3 = Invalidated): ${batch.status}`);
  console.log(`    Operator stake after slash: ${ethers.formatEther(stream.stakeAmount)} ETH`);

  const chalBalAfter = await ethers.provider.getBalance(challenger.address);
  console.log(`    Challenger balance delta: ~${ethers.formatEther(chalBalAfter - chalBalBefore)} ETH (refund + reward minus gas)`);

  console.log("\n=== FRAUD CAUGHT, OPERATOR SLASHED ===\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
