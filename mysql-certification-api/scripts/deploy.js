// CertAnchor kontratini derleyip RPC_URL'deki aga deploy eder.
// Kullanim: node --env-file=.env scripts/deploy.js
import solc from 'solc';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const { RPC_URL, PRIVATE_KEY } = process.env;
if (!RPC_URL || !PRIVATE_KEY) {
  console.error('RPC_URL ve PRIVATE_KEY ortam degiskenleri gerekli (.env dosyasina bakin).');
  process.exit(1);
}

const source = readFileSync(path.join(__dirname, '..', 'contracts', 'CertAnchor.sol'), 'utf8');

const input = {
  language: 'Solidity',
  sources: { 'CertAnchor.sol': { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));
const errors = (output.errors || []).filter((e) => e.severity === 'error');
if (errors.length) {
  for (const e of errors) console.error(e.formattedMessage);
  process.exit(1);
}

const artifact = output.contracts['CertAnchor.sol'].CertAnchor;
const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

console.log('Deploy eden adres :', wallet.address);
const bakiye = await provider.getBalance(wallet.address);
console.log('Bakiye            :', ethers.formatEther(bakiye), 'ETH');
if (bakiye === 0n) {
  console.error('Bakiye 0 — once bir Sepolia faucet\'ten test ETH alin.');
  process.exit(1);
}

const factory = new ethers.ContractFactory(artifact.abi, artifact.evm.bytecode.object, wallet);
const contract = await factory.deploy();
console.log('Deploy tx         :', contract.deploymentTransaction().hash);
await contract.waitForDeployment();
const address = await contract.getAddress();
console.log('\n✓ CertAnchor deploy edildi:', address);
console.log('.env dosyaniza ekleyin  → CERT_ANCHOR_ADDRESS=' + address);
