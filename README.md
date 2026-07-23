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
model — and, as of v1.1, a **hybrid bridge between them**: every certificate
created in the MySQL implementation is also *anchored on-chain* (its keccak256
digest is written to an Ethereum smart contract), so tampering with the
relational record can be detected and proven cryptographically.

**Live demo:** <https://composable-blockchain-certification-method-production.up.railway.app>

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
│   ├── chain.js                            ← ethers.js bridge (on-chain anchoring)
│   ├── contracts/CertAnchor.sol            ← certificate-anchoring contract
│   ├── scripts/deploy.js                   ← compiles + deploys CertAnchor
│   ├── scripts/migrate.js                  ← adds chain columns to an existing DB
│   ├── schema.sql                          ← MySQL 8 schema (tables, triggers, procedures)
│   ├── public/index.html                   ← vanilla HTML/JS dashboard
│   ├── .env.example                        ← DB + chain configuration
│   └── package.json / package-lock.json
├── job-search-resume-matcher/               ← resume-driven job search & matching tool
│   ├── job_matcher/                        ← fetchers, scoring, location filter, report/cover-letter rendering
│   ├── fixtures/sample_jobs.json           ← offline demo dataset
│   ├── tests/                              ← pytest suite (no network required)
│   └── main.py                             ← CLI: fetch → match → report
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
- **Ethereum bridge** — `chain.js` (ethers.js v6) anchors each certificate's
  keccak256 digest on-chain via `contracts/CertAnchor.sol`.
- **Dashboard** — vanilla HTML/JS (`public/index.html`) that consumes the
  endpoints, shows per-certificate chain status and links to the block explorer.

Data model: producer → facility → production batch → certificate → transfer → buyer.
The Carbon Credibility Index (CCI) is computed with threshold-based
normalization, and a `BEFORE INSERT` trigger blocks transfers that exceed a
certificate's capacity at the database level.

### On-chain anchoring (hybrid mode)

When a certificate is created via `POST /sertifika`, the API

1. commits the row to MySQL inside a transaction,
2. computes a canonical keccak256 digest of the certificate fields,
3. sends `anchorCertificate(serialHash, dataHash)` to the `CertAnchor`
   contract and stores the transaction hash next to the row
   (`zincir_durum`: `gonderildi` → `onaylandi` once the block is confirmed).

`GET /dogrula/:seri_no` then re-computes the digest from the *current* MySQL
row and compares it with the digest stored on-chain — if the relational record
was modified after issuance, the endpoint reports a mismatch (`UYUSMAZLIK`).
Chain anchoring is **optional**: if `RPC_URL` / `PRIVATE_KEY` /
`CERT_ANCHOR_ADDRESS` are not configured, the API runs in MySQL-only mode.

**Run it yourself:**

```bash
cd mysql-certification-api
# create the hydrocert database from schema.sql
npm install
cp .env.example .env       # fill in DB + (optionally) chain settings
npm run migrate            # only for pre-v1.1 databases: adds the chain columns
npm run deploy:contract    # optional: deploys CertAnchor (Sepolia recommended)
npm start                  # starts the API on http://localhost:3000
```

For a fully local test chain: `npx hardhat node`, then use
`RPC_URL=http://127.0.0.1:8545` with one of the printed test keys.

**Endpoints:**

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/uretici` | List producers. |
| GET | `/uretici/:ulke` | List producers by country. |
| GET | `/sertifika` | List recent certificates with chain status. |
| POST | `/sertifika` | Create a certificate (+ anchor its digest on-chain). |
| GET | `/dogrula/:seri_no` | Verify a certificate against the on-chain digest. |
| GET | `/cci` | Carbon Credibility Index report. |
| GET | `/durum` | API / chain-bridge status. |

See `mysql-certification-api/README.md` for schema and design details.

---

---

## 3 — `job-search-resume-matcher/` (unrelated side tool)

A standalone tool with no dependency on the certification framework above:
it fetches postings from free public job-board APIs (Remotive, Arbeitnow,
Jobicy, RemoteOK), scores each against Burak Ozbudak's resume across four
skill tracks (process/chemical engineering, frontend/web, blockchain,
project management), and keeps only the matches located in Turkey or
remote/abroad. Output is a ranked Markdown/HTML report plus optional
templated cover-letter drafts — see its own `README.md` for scope,
limitations (no auto-submission), and usage.

## Reproducibility checklist

- Single-file Solidity contract — no external imports, compiles in Remix or Hardhat.
- Demo-tuned constants documented (60 s dispute window, 0.01 ETH stake).
- Automated unit tests with predictable expected events.
- Each scenario deploys its own contract, so state is independent.
- MySQL schema is reproducible from `schema.sql`; integrity is enforced with triggers and constraints.
- On-chain anchoring is reproducible on a local Hardhat node — no testnet
  funds required (`npx hardhat node` + `npm run deploy:contract`).
- Production gaps explicitly listed in the scenarios `README.md` (Merkle proof
  verification, 24 h window, OpenZeppelin AccessControl, full ERC-1155 metadata).

## Contact

**Burak Ozbudak** — for clarification on the framework or how to reproduce a
scenario, the Hardhat project's `README.md` has the full command list and the
`mysql-certification-api` README covers the relational implementation.
