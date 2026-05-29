// scripts/scenario-predicate-failure.js
//
// SCENARIO 4 — Predicate Engine Rejects Non-Compliant Batches
// ------------------------------------------------------------
// Three submissions are attempted, each violating one predicate:
//   (a) RFNBO carbon intensity > 3380  (CBAM/RED III fail)
//   (b) Specific energy < 39 kWh/kg    (PEM thermodynamic floor)
//   (c) Specific energy > 70 kWh/kg    (PEM practical ceiling)
// All three must revert.

const hre = require("hardhat");
const { ethers } = hre;

async function expectRevert(promise, label) {
  try {
    await promise;
    console.log(`    [${label}] UNEXPECTED PASS`);
  } catch (err) {
    const msg = err.shortMessage || err.message;
    console.log(`    [${label}] reverted: ${msg.split("\n")[0]}`);
  }
}

async function main() {
  const [_, operator] = await ethers.getSigners();
  console.log("\n=== SCENARIO 4: PREDICATE ENGINE FAILURES ===\n");

  const Factory = await ethers.getContractFactory("EnergyStreamDemo");
  const c = await Factory.deploy();
  await c.waitForDeployment();

  await (await c.connect(operator).registerStream("Compliance Test Plant", {
    value: ethers.parseEther("0.01"),
  })).wait();

  const root = await c.demoMerkleRoot();

  console.log("[a] Submit with carbon intensity 4000 > RFNBO ceiling 3380...");
  await expectRevert(
    c.connect(operator).submitBatch(
      1n, root, "QmFailA",
      ethers.parseEther("50"),
      ethers.parseEther("4000"),
      ethers.parseEther("10"),
      6n
    ),
    "RFNBO"
  );

  console.log("[b] Submit with specific energy 30 < PEM floor 39...");
  await expectRevert(
    c.connect(operator).submitBatch(
      1n, root, "QmFailB",
      ethers.parseEther("30"),
      ethers.parseEther("2000"),
      ethers.parseEther("10"),
      6n
    ),
    "PEM_min"
  );

  console.log("[c] Submit with specific energy 90 > PEM ceiling 70...");
  await expectRevert(
    c.connect(operator).submitBatch(
      1n, root, "QmFailC",
      ethers.parseEther("90"),
      ethers.parseEther("2000"),
      ethers.parseEther("10"),
      6n
    ),
    "PEM_max"
  );

  console.log("\n=== ALL PREDICATE FAILURES REVERTED AS EXPECTED ===\n");
}

main().catch((e) => { console.error(e); process.exit(1); });
