// scripts/run-all-scenarios.js
// Runs every scenario sequentially. Each scenario deploys its own contract,
// so state is independent.

const { spawnSync } = require("child_process");
const path = require("path");

const scenarios = [
  "scenario-happy-path.js",
  "scenario-predicate-failure.js",
  "scenario-dispute-honest-aggregator.js",
  "scenario-dispute-fraud-detected.js",
];

for (const s of scenarios) {
  const full = path.join("scripts", s);
  console.log(`\n>>> RUNNING ${s}\n`);
  const r = spawnSync("npx", ["hardhat", "run", full], { stdio: "inherit", shell: true });
  if (r.status !== 0) {
    console.error(`Scenario ${s} failed.`);
    process.exit(r.status);
  }
}
console.log("\nAll scenarios completed.\n");
