// test/EnergyStream.test.js
// Hardhat / Mocha / Chai test suite for the EnergyStreamDemo contract.

const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const E18 = (n) => ethers.parseEther(n.toString());

async function deploy() {
  const Factory = await ethers.getContractFactory("EnergyStreamDemo");
  const c = await Factory.deploy();
  await c.waitForDeployment();
  return c;
}

async function increaseTime(seconds) {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
}

describe("EnergyStreamDemo — Composable Certification", function () {
  describe("Stream Registry", function () {
    it("registers a stream with default predicates", async function () {
      const [, operator] = await ethers.getSigners();
      const c = await deploy();

      await expect(
        c.connect(operator).registerStream("Plant A", { value: E18("0.01") })
      ).to.emit(c, "StreamRegistered");

      const s = await c.getStream(1n);
      expect(s.operator).to.equal(operator.address);
      expect(s.maxCarbonIntensity).to.equal(E18("3380"));
      expect(s.minSpecificEnergy).to.equal(E18("39"));
      expect(s.maxSpecificEnergy).to.equal(E18("70"));
    });

    it("rejects registration below minimum stake", async function () {
      const [, operator] = await ethers.getSigners();
      const c = await deploy();
      await expect(
        c.connect(operator).registerStream("Cheap", { value: E18("0.001") })
      ).to.be.revertedWithCustomError(c, "InsufficientStake");
    });
  });

  describe("Batch Submission + Predicate Engine", function () {
    it("accepts a compliant batch", async function () {
      const [, operator] = await ethers.getSigners();
      const c = await deploy();
      await c.connect(operator).registerStream("Plant", { value: E18("0.01") });

      const root = await c.demoMerkleRoot();
      await expect(
        c.connect(operator).submitBatch(
          1n, root, "Qm1",
          E18("50"), E18("2000"), E18("100"), 6n
        )
      ).to.emit(c, "BatchSubmitted");
    });

    it("rejects batch that exceeds RFNBO carbon ceiling", async function () {
      const [, operator] = await ethers.getSigners();
      const c = await deploy();
      await c.connect(operator).registerStream("Plant", { value: E18("0.01") });
      const root = await c.demoMerkleRoot();

      await expect(
        c.connect(operator).submitBatch(
          1n, root, "Qm",
          E18("50"), E18("4000"), E18("10"), 6n
        )
      ).to.be.revertedWith("Carbon intensity exceeds RFNBO limit (3.38 kg CO2/kg H2)");
    });

    it("rejects batch below PEM thermodynamic floor", async function () {
      const [, operator] = await ethers.getSigners();
      const c = await deploy();
      await c.connect(operator).registerStream("Plant", { value: E18("0.01") });
      const root = await c.demoMerkleRoot();

      await expect(
        c.connect(operator).submitBatch(
          1n, root, "Qm",
          E18("30"), E18("2000"), E18("10"), 6n
        )
      ).to.be.revertedWith("Specific energy below PEM thermodynamic limit (39 kWh/kg)");
    });

    it("rejects batch above PEM practical ceiling", async function () {
      const [, operator] = await ethers.getSigners();
      const c = await deploy();
      await c.connect(operator).registerStream("Plant", { value: E18("0.01") });
      const root = await c.demoMerkleRoot();

      await expect(
        c.connect(operator).submitBatch(
          1n, root, "Qm",
          E18("90"), E18("2000"), E18("10"), 6n
        )
      ).to.be.revertedWith("Specific energy exceeds practical PEM ceiling (70 kWh/kg)");
    });

    it("rejects non-operator submitters", async function () {
      const [, operator, intruder] = await ethers.getSigners();
      const c = await deploy();
      await c.connect(operator).registerStream("Plant", { value: E18("0.01") });
      const root = await c.demoMerkleRoot();

      await expect(
        c.connect(intruder).submitBatch(
          1n, root, "Qm", E18("50"), E18("2000"), E18("10"), 6n
        )
      ).to.be.revertedWithCustomError(c, "NotOperator");
    });
  });

  describe("Dispute Window & Confirmation", function () {
    it("confirmBatch reverts before window closes", async function () {
      const [, operator] = await ethers.getSigners();
      const c = await deploy();
      await c.connect(operator).registerStream("Plant", { value: E18("0.01") });
      const root = await c.demoMerkleRoot();
      await c.connect(operator).submitBatch(1n, root, "Qm", E18("50"), E18("2000"), E18("100"), 6n);

      await expect(c.confirmBatch(1n)).to.be.revertedWithCustomError(c, "WindowStillOpen");
    });

    it("confirms a batch after the dispute window", async function () {
      const [, operator] = await ethers.getSigners();
      const c = await deploy();
      await c.connect(operator).registerStream("Plant", { value: E18("0.01") });
      const root = await c.demoMerkleRoot();
      await c.connect(operator).submitBatch(1n, root, "Qm", E18("50"), E18("2000"), E18("100"), 6n);

      await increaseTime(61);
      await expect(c.confirmBatch(1n)).to.emit(c, "BatchConfirmed");
    });
  });

  describe("Dispute Resolution", function () {
    it("slashes operator when fraud is proven", async function () {
      const [, operator, challenger] = await ethers.getSigners();
      const c = await deploy();
      await c.connect(operator).registerStream("Plant", { value: E18("0.01") });
      const root = await c.demoMerkleRoot();

      // Operator lies: claims 1500 mean instead of real 2000
      await c.connect(operator).submitBatch(1n, root, "Qm", E18("50"), E18("1500"), E18("100"), 6n);

      await c.connect(challenger).openChallenge(1n, "fraud", E18("2000"), { value: E18("0.005") });

      const leaves = await c.demoCorrectLeaves();
      await expect(c.submitProofAndResolve(1n, leaves)).to.emit(c, "StakeSlashed");

      const batch = await c.getBatch(1n);
      expect(batch.status).to.equal(3); // Invalidated
      const stream = await c.getStream(1n);
      expect(stream.stakeAmount).to.equal(E18("0.005"));
    });

    it("rewards operator when challenger is wrong", async function () {
      const [, operator, challenger] = await ethers.getSigners();
      const c = await deploy();
      await c.connect(operator).registerStream("Plant", { value: E18("0.01") });
      const root = await c.demoMerkleRoot();

      // Operator is truthful (mean = 2000 matches leaves)
      await c.connect(operator).submitBatch(1n, root, "Qm", E18("50"), E18("2000"), E18("100"), 6n);

      await c.connect(challenger).openChallenge(1n, "spurious", E18("9999"), { value: E18("0.005") });

      const leaves = await c.demoCorrectLeaves();
      await expect(c.submitProofAndResolve(1n, leaves)).to.emit(c, "DisputeResolved");

      const dispute = await c.getDispute(1n);
      expect(dispute.challengerWon).to.equal(false);
      const batch = await c.getBatch(1n);
      expect(batch.status).to.equal(0); // Pending
    });
  });

  describe("Certificate Minting", function () {
    it("mints ERC-1155-lite certificate to buyer", async function () {
      const [, operator, buyer] = await ethers.getSigners();
      const c = await deploy();
      await c.connect(operator).registerStream("Plant", { value: E18("0.01") });
      const root = await c.demoMerkleRoot();
      await c.connect(operator).submitBatch(1n, root, "Qm", E18("50"), E18("2000"), E18("100"), 6n);
      await increaseTime(61);
      await c.confirmBatch(1n);

      await expect(c.mintCertificate(1n, buyer.address))
        .to.emit(c, "CertificateMinted")
        .withArgs(1n, buyer.address, 100n, "ipfs://Qm");

      expect(await c.balanceOf(1n, buyer.address)).to.equal(100n);
    });

    it("refuses to mint twice", async function () {
      const [, operator, buyer] = await ethers.getSigners();
      const c = await deploy();
      await c.connect(operator).registerStream("Plant", { value: E18("0.01") });
      const root = await c.demoMerkleRoot();
      await c.connect(operator).submitBatch(1n, root, "Qm", E18("50"), E18("2000"), E18("100"), 6n);
      await increaseTime(61);
      await c.confirmBatch(1n);
      await c.mintCertificate(1n, buyer.address);

      await expect(c.mintCertificate(1n, buyer.address)).to.be.revertedWith("Already minted");
    });
  });
});
