# HydroCert — MySQL Sertifikasyon API + Blockchain Anchoring

EnergyStream blockchain sertifikasyon sisteminin iliskisel (MySQL) implementasyonu.
Turkiye–AB yenilenebilir hidrojen koridoru icin uretici, tesis, uretim partisi,
sertifika ve transfer verilerini yoneten REST API + dashboard.

v1.1 itibariyle **hibrit calisir**: olusturulan her sertifikanin keccak256 ozeti
Ethereum uzerindeki `CertAnchor` kontratina sabitlenir (anchoring). Boylece
MySQL kaydinin sonradan degistirilmedigi zincir uzerinden kanitlanabilir.

## Mimari

- **MySQL 8** — InnoDB, transaction, trigger, stored procedure, window functions
- **Node.js + Express** — mysql2 connection pool, prepared statements
- **Ethereum koprusu** — `chain.js` (ethers.js v6) + `contracts/CertAnchor.sol`
- **Dashboard** — vanilla HTML/JS; sertifika listesi, zincir durumu ve dogrulama karti

Veri modeli: uretici → tesis → uretim_partisi → sertifika → transfer → alici.
Karbon Kredibilite Indeksi (CCI) esik-tabanli normalize ile hesaplanir.
Sertifika kapasitesini asan transfer, BEFORE INSERT trigger ile DB seviyesinde engellenir.

## Zincire sabitleme akisi

1. `POST /sertifika` → kayit MySQL'e transaction icinde yazilir.
2. Sertifika alanlarindan kanonik keccak256 ozeti hesaplanir (`veri_hash`).
3. `anchorCertificate(serialHash, dataHash)` islemi zincire gonderilir;
   tx hash'i kayda islenir (`zincir_durum`: `gonderildi` → blok onaylaninca `onaylandi`).
4. `GET /dogrula/:seri_no` — MySQL'deki guncel kayittan ozet yeniden hesaplanir
   ve zincirdekiyle karsilastirilir. Kayit sonradan degistirildiyse `UYUSMAZLIK` doner.

Zincir **opsiyoneldir**: `RPC_URL` / `PRIVATE_KEY` / `CERT_ANCHOR_ADDRESS`
tanimli degilse API yalnizca MySQL ile calisir (`zincir_durum = zincir_disi`).

## Kurulum

```bash
# 1. MySQL'de hydrocert veritabanini schema.sql'den olustur
npm install
cp .env.example .env      # DB + (istege bagli) zincir ayarlarini doldur
npm run migrate           # sadece eski (v1.0) veritabanlari icin: zincir kolonlarini ekler
npm run deploy:contract   # istege bagli: CertAnchor'u deploy eder (Sepolia onerilir)
npm start                 # http://localhost:3000
```

Yerel test zinciri icin: `npx hardhat node` calistirip
`RPC_URL=http://127.0.0.1:8545` ve ekrandaki test anahtarlarindan birini kullanin.
Sepolia icin ucretsiz RPC (Alchemy/Infura) + faucet test ETH'i yeterlidir;
gercek ETH harcanmaz.

## Endpointler

| Metod | Yol | Amac |
| --- | --- | --- |
| GET | `/uretici` | Ureticileri listeler |
| GET | `/uretici/:ulke` | Ulkeye gore uretici listeler |
| GET | `/sertifika` | Son sertifikalar + zincir durumu |
| POST | `/sertifika` | Sertifika olusturur ve ozetini zincire sabitler |
| GET | `/dogrula/:seri_no` | MySQL kaydini zincirdeki ozetle dogrular |
| GET | `/cci` | Karbon Kredibilite Indeksi raporu |
| GET | `/durum` | API / zincir koprusu durumu |

## Ortam degiskenleri

`.env.example` dosyasina bakin: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`,
`DB_NAME`, `RPC_URL`, `PRIVATE_KEY`, `CERT_ANCHOR_ADDRESS`, `EXPLORER_TX_URL`, `PORT`.

> Not (mysql2): `dateStrings: true` ayari kritiktir — DATE alanlari Date objesine
> cevrilirse timezone kaymasi olur ve zincirdeki ozet dogrulamasi bozulur.
