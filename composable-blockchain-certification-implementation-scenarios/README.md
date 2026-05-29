# Composable Blockchain Certification — Implementation Scenarios

Hardhat reference implementation and scenario suite for the **EnergyStream**
composable blockchain certification framework described in:

> *Bridging EU CBAM and RED III — A Composable Blockchain Framework for the
> Turkey–EU Hydrogen Corridor.*
> Burak Ozbudak, BBG 664 Term Project.

The contract bundles four logically-separable components — Stream Registry,
Batch Submitter (with predicate engine), Dispute Resolver (optimistic
verification + slashing), and an ERC-1155-lite Certificate Minter — into a
single deployable artifact so the full life-cycle of a green-hydrogen
certificate can be exercised end-to-end in Hardhat.

---

## 1. What the framework does

The EU's **Carbon Border Adjustment Mechanism (CBAM)** and **RED III**
RFNBO rules require that imported renewable hydrogen comes with auditable,
tamper-resistant proof that it was produced below the regulatory carbon
ceiling (3.38 kg CO2eq / kg H2) and within physically plausible electrolyser
energy bounds.

The framework converts each hour of plant telemetry into an on-chain
*batch* that carries:

- aggregate values (mean specific energy, mean carbon intensity, total kg H2),
- a Merkle root of the underlying minute-level leaves,
- and an IPFS pointer to the raw data.

A **predicate engine** enforces the regulatory bounds *at submission time*.
An **optimistic dispute window** lets anyone re-compute the aggregates from
the leaves and slash a fraudulent operator. Surviving batches become
**ERC-1155 certificates** that can be traded or surrendered to customs.

---

## 2. Project layout

```
composable-blockchain-certification-implementation-scenarios/
├── contracts/
│   └── EnergyStreamDemo.sol            ← single-file composable contract
├── scripts/
│   ├── deploy.js                      ← generic deployment script
│   ├── scenario-happy-path.js          ← Scenario 1
│   ├── scenario-predicate-failure.js   ← Scenario 2
│   ├── scenario-dispute-honest-aggregator.js   ← Scenario 3
│   ├── scenario-dispute-fraud-detected.js     ← Scenario 4
│   └── run-all-scenarios.js           ← runs every scenario back-to-back
├── test/
│   └── EnergyStream.test.js            ← Mocha + Chai unit tests
├── hardhat.config.js
├── package.json
├── .env.example
├── .gitignore
└── README.md
```
