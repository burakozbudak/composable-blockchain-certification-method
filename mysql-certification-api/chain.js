import { ethers } from 'ethers';

// Zincir yapilandirmasi ortam degiskenlerinden gelir; eksikse API
// zincir olmadan (yalniz MySQL) calismaya devam eder.
const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CERT_ANCHOR_ADDRESS;

export const EXPLORER_TX_URL =
  process.env.EXPLORER_TX_URL || 'https://sepolia.etherscan.io/tx/';

const ABI = [
  'function anchorCertificate(bytes32 serialHash, bytes32 dataHash) external',
  'function verifyCertificate(bytes32 serialHash, bytes32 dataHash) view returns (bool exists, bool valid, uint64 anchoredAt)',
  'event CertificateAnchored(bytes32 indexed serialHash, bytes32 dataHash, uint256 timestamp)',
];

let cached;
function baglanti() {
  if (!cached) {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    cached = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);
  }
  return cached;
}

export function zincirAktif() {
  return Boolean(RPC_URL && PRIVATE_KEY && CONTRACT_ADDRESS);
}

// Ayni sertifika alanlari her zaman ayni ozeti uretmeli; bu yuzden
// alanlar sabit sirayla ve string'e normalize edilerek hash'lenir.
export function sertifikaOzeti({ parti_id, seri_no, toplam_kg, ihrac_tarihi, gecerlilik }) {
  const kanonik = JSON.stringify({
    parti_id: String(parti_id),
    seri_no: String(seri_no),
    toplam_kg: String(toplam_kg),
    ihrac_tarihi: String(ihrac_tarihi),
    gecerlilik: String(gecerlilik),
  });
  return {
    serialHash: ethers.id(String(seri_no)),
    dataHash: ethers.keccak256(ethers.toUtf8Bytes(kanonik)),
  };
}

// Islemi gonderir ve tx hash'ini hemen dondurur; blok onayini beklemez.
// Onay takibi icin dondurulen tx nesnesinde .wait() cagrilabilir.
export async function zincireSabitle(sertifika) {
  const { serialHash, dataHash } = sertifikaOzeti(sertifika);
  const tx = await baglanti().anchorCertificate(serialHash, dataHash);
  return { txHash: tx.hash, dataHash, tx };
}

export async function zincirdenDogrula(sertifika) {
  const { serialHash, dataHash } = sertifikaOzeti(sertifika);
  const [exists, valid, anchoredAt] = await baglanti().verifyCertificate(serialHash, dataHash);
  return { exists, valid, anchoredAt: Number(anchoredAt) };
}
