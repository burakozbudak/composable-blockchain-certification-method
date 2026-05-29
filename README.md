# Composable Blockchain Certification Method — Project Folder Guide

**Author:** Burak Ozbudak
**Course:** BBG 664 Term Project
**Topic:** A composable blockchain framework that bridges the EU's CBAM and
RED III rules with renewable-hydrogen production on the Turkey–EU corridor.

---

This folder contains everything I prepared for the term project, organized
as four self-contained deliverables. Each one approaches the same idea from
a different angle so you can pick the level of depth you want to look at:

1. **Read the paper first** to understand the *why* and the regulatory
   motivation (CBAM + RED III).
2. **Open the slides** for a 10-minute visual summary of the same idea.
3. **Watch the demo videos** to see the contract executing live in Remix.
4. **Open the Hardhat project** if you'd like to re-run, audit, or extend
   the smart contract yourself — it ships with automated tests and four
   reproducible scenarios.

Together they show the framework from concept → presentation → live demo →
production-style automated implementation.

---

## What's in this folder

```
Composable Blockchain Certification Method/
├── Composable Blockchain Certification .pdf
├── EnergyStream.pptx
├── smartcontrat demo/
│   ├── demo 1.mp4
│   ├── demo 2.mp4
│   └── demo 3.mp4
└── composable-blockchain-certification-implementation-scenarios/
    ├── contracts/EnergyStreamDemo.sol
    ├── scripts/   (deploy + 4 scenario scripts)
    ├── test/      (Mocha/Chai unit tests)
    ├── hardhat.config.js
    ├── package.json
    └── README.md
```

---

## Document 1 — `Composable Blockchain Certification .pdf` (academic paper)

**Purpose:** the written defence of the method.

**Contents:**
- Regulatory motivation: EU CBAM (carbon border adjustment) and RED III's
  RFNBO ceiling of 3.38 kg CO2eq / kg H2.
- The Turkey–EU hydrogen corridor as the case study.
- A four-module composable architecture: Stream Registry, Predicate Engine,
  Optimistic Dispute Resolver, ERC-1155 Certificate Mint.
- Threat model, predicate DSL, slashing economics, and certificate
  life-cycle.
- Limitations and production gaps (Merkle proof completeness, dispute
  window length, access control).

**Start here if you want the reasoning behind every design choice in the
code.**

---

## Document 2 — `EnergyStream.pptx` (presentation)

**Purpose:** the same story told visually in ~10 minutes.

**Contents:**
- Problem statement and regulatory backdrop.
- The four composable modules diagrammed.
- Predicate engine examples with the actual numeric thresholds.
- Optimistic verification timeline (submit → 24h window → confirm → mint;
  demo uses 60 s).
- Slashing flow and the certificate trade flow.

**Use this for a quick overview before reading the paper or watching the
demos.**

---

## Document 3 — `smartcontrat demo/` (live Remix demos, 3 videos)

**Purpose:** show the contract actually executing on a fresh chain.

**Contents:**
- `demo 1.mp4` — deploy + register stream + submit a compliant batch +
  confirm + mint a certificate (happy path).
- `demo 2.mp4` — open a dispute against an honest batch and watch the
  challenger lose their stake.
- `demo 3.mp4` — operator submits a fraudulent batch; challenger proves
  fraud, operator is slashed, challenger rewarded.

Each video uses the single-file `EnergyStreamDemo.sol` contract in Remix
with the dispute window shortened to 60 s so the full life-cycle fits
inside one recording.

**Watch these if you want to see the predicate engine, dispute resolver,
and minter behave end-to-end without installing anything.**

---

## Document 4 — `composable-blockchain-certification-implementation-scenarios/` (Hardhat project)

**Purpose:** a reproducible, automated version of the demos — what a
production team would actually receive.

**Contents:**
- `contracts/EnergyStreamDemo.sol` — same composable contract as the demo
  videos.
- `scripts/`
  - `deploy.js`
  - `scenario-happy-path.js` — full happy path automated
  - `scenario-predicate-failure.js` — three predicate violations all revert
  - `scenario-dispute-honest-aggregator.js` — spurious challenger loses stake
  - `scenario-dispute-fraud-detected.js` — fraud caught, operator slashed
  - `run-all-scenarios.js` — runs all four in sequence
- `test/EnergyStream.test.js` — 12 Mocha + Chai unit tests covering all
  four modules.
- `hardhat.config.js`, `package.json`, `.env.example`, `.gitignore`.
- Its own `README.md` with deeper technical detail.

**How to run it yourself:**

```bash
cd "composable-blockchain-certification-implementation-scenarios"
npm install
npm test
npm run scenario:all
```

Each scenario prints a labelled trace of the events emitted by the
contract, so you can read what happened without inspecting the chain.

---

## Reproducibility checklist

- [x] Single-file contract — no external imports, compiles in Remix or Hardhat.
- [x] Demo-tuned constants documented (60 s dispute window, 0.01 ETH stake).
- [x] Automated unit tests with predictable expected events.
- [x] Each scenario deploys its own contract, so state is independent.
- [x] Production gaps explicitly listed in both the paper and the Hardhat
      README (Merkle proof verification, 24 h window, OpenZeppelin
      AccessControl, full ERC-1155 metadata).

---

## Contact

Burak Ozbudak — for any clarification on the framework or how to reproduce
a scenario, the Hardhat project's `README.md` has the full command list.
