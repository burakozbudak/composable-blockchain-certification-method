# Composable Blockchain Certification Method — EnergyStream

**Author:** Burak Ozbudak
**Topic:** A composable blockchain framework that bridges the EU's CBAM and
RED III rules with renewable-hydrogen production on the Turkey–EU corridor.

---

This repository contains the working code for the EnergyStream framework: an
on-chain, composable method for certifying that renewable hydrogen on the
Turkey–EU corridor was produced below the regulatory carbon ceiling
(3.38 kg CO2eq / kg H2 under RED III RFNBO rules) and in line with EU CBAM
reporting requirements.

The framework turns each hour of plant telemetry into an auditable batch
(aggregate values + a Merkle root of the minute-level leaves + an IPFS
pointer). A predicate engine enforces the regulatory bounds at submission
time, an optimistic dispute window lets anyone re-compute the aggregates and
slash a fraudulent operator, and surviving batches become tradable ERC-1155
certificates.

The repository ships **two complementary implementations** of the same data
model, plus the supporting docs.

## What's in this repository

```
composable-blockchain-certification-method/
├── composable-blockchain-certification-implementation-scenarios/
│   ├── contracts/EnergyStreamDemo.sol      ← single-file composable contract
│   ├── scripts/                            ← deploy + 4 scenario scripts + runner
│   ├── test/EnergyStream.test.js           ← Mocha + Chai unit tests
│   ├── hardhat.config.js
│   ├── package.json
│   ├── .env.example
│   └── README.md
├── mysql-certification-api/
│   ├── server.js                           ← Node.js + Express REST API
│   ├── schema.sql                          ← MySQL 8 schema (tables, triggers, procedures)
│   ├── public/index.html                   ← vanilla HTML/JS dashboard
│   ├── package.json / package-lock.jso     ← MySQL design notes
│   └── README.mdpackage.json / package-lock.json
├── .gitignore
└── README.md
```

---

## 1 — `composable-blockchain-certification-implementation-scenarios/` (Hardhat)

The on-chain reference implementation. `EnergyStreamDemo.sol` bundles four
logically-separable modules into a single deployable artifact:

- **Stream Registry** — registers production streams.
- **Batch Submitter** — accepts hourly batches and runs the **predicate engine**
  that enforces the carbon ceiling and electrolyser energy bounds at submission.
- **Dispute Resolver** — optimistic verification with a dispute window and
  stake-based slashing.
- **Certificate Minter** — an ERC-1155-lite minter for surviving batches.

The project is single-file (no external imports) so it compiles in both Remix
and Hardhat, and uses demo-tuned constants (60 s dispute window, 0.01 ETH
stake) so the full life-cycle fits inside one run.

**Run it yourself:**

```bash
cd composable-blockchain-certification-implementation-scenarios
npm install
npm test               # 12 Mocha + Chai unit tests
npm run scenario:all   # runs all four scenarios back-to-back
```

The four scenarios (also runnable individually):

| Script | What it shows |
| --- | --- |
| `npm run scenario:happy` | Happy path: register → submit → confirm → mint. |
| `npm run scenario:predicate-fail` | Three predicate violations all revert. |
| `npm run scenario:dispute-honest` | Spurious challenger loses their stake. |
| `npm run scenario:dispute-fraud` | Fraud caught, operator slashed, challenger rewarded. |

Each scenario deploys its own contract and prints a labelled trace of the
emitted events. See the project's own `README.md` for deeper technical detail.

---

## 2 — `mysql-certification-api/` (HydroCert)

A relational (MySQL) implementation of the same certification data model — a
REST API plus dashboard that manages producers, facilities, production
batches, certificates and transfers for the Turkey–EU hydrogen corridor.

- **MySQL 8** — InnoDB, transactions, triggers, stored procedures, window functions.
- **Node.js + Express** — `mysql2` connection pool with prepared statements.
- **Dashboard** — vanilla HTML/JS (`public/index.html`) that consumes the endpoints.

Data model: producer → facility → production batch → certificate → transfer → buyer.
The Carbon Credibility Index (CCI) is computed with threshold-based
normalization, and a `BEFORE INSERT` trigger blocks transfers that exceed a
certificate's capacity at the database level.

**Run it yourself:**

```bash
cd mysql-certification-api
# create the hydrocert database from schema.sql 
npm install
npm start              # starts the API on http://localhost:3000
```

**Endpoints:**

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/uretici` | List producers. |
| GET | `/uretici/:ulke` | List producers by country. |
| POST | `/sertifika` | Create a certificate. |
| GET | `/cci` | Carbon Credibility Index report. |

See `mysql-certification-api/README.md` for schema and design detail.

---

## Reproducibility checklist

- Single-file Solidity contract — no external imports, compiles in Remix or Hardhat.
- Demo-tuned constants documented (60 s dispute window, 0.01 ETH stake).
- Automated unit tests with predictable expected events.
- Each scenario deploys its own contract, so state is independent.
- MySQL schema is reproducible from `schema.sql`; integrity is enforced with triggers and constraints.
- Production gaps explicitly listed in the scenarios `README.md` (Merkle proof
  verification, 24 h window, OpenZeppelin AccessControl, full ERC-1155 metadata).

## Contact

**Burak Ozbudak** — for clarification on the framework or how to reproduce a
scenario, the Hardhat project's `README.md` has the full command list and the
`mysql-certification-api` README covers the relational implementation.
