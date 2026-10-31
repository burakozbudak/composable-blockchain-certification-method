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

## v1.2 — EVREN yapay zeka katmani

Panel, [EVREN](https://evren.ssyz.org.tr) yerli YZ platformunun OpenAI uyumlu LLM
API'sini kullanan dort ozellik icerir (`ai.js`, `evren.js`). `EVREN_API_KEY`
tanimli degilse bu kartlar kapali gorunur; panelin geri kalani etkilenmez.

| Ozellik | Model | Uc |
| --- | --- | --- |
| CBAM / RED III asistani — panel verisiyle baglamli soru-cevap | `glm-5.3` | `POST /ai/asistan` |
| Belgeden sertifika — gorselden OCR + alan cikarimi, formu doldurur | `dots-ocr` + `glm-5.3` | `POST /ai/belge` |
| Risk / uyum skoru — kural tabanli kontroller + tipli karar modeli | `clef` | `GET /ai/risk/:seri_no` |
| Anlamsal arama — sertifika ve tesislerde dogal dilde arama | `qwen3-embedding-8b` + `qwen3-reranker-8b` | `POST /ai/ara` |

Notlar:
- Risk kartindaki RFNBO esigi 3,38 kgCO2e/kgH2'dir (94 gCO2e/MJ fosil karsilastiriciya gore %70 azaltim × 120 MJ/kg).
  Kural tabanli kontroller modelden bagimsiz calisir; model skoru yalnizca ek gorustur.
- Belgeden sertifika formu yalnizca **doldurur**; ihrac icin kullanici kontrol edip gonderir.
- `/ai/*` ve `POST /sertifika` IP basina dakikalik sinirlidir (ucretsiz kota ve test ETH korumasi).
- EVREN LLM API 1 Aralik 2026'ya kadar ucretsizdir (gunluk 15M token); sonrasi icin platformun kredi kosullarina bakin.
- Ilk kullanimdan once EVREN kullanim sartlari onaylanmalidir (Test Alani → anahtar kutusu); aksi halde 403 `terms_not_accepted` doner.

## Ucretsiz canliya alma (Render + Aiven + Sepolia)

| Katman | Servis | Not |
| --- | --- | --- |
| Web + API | Render ucretsiz web servisi | 15 dk istek gelmezse uyur, ilk istekte ~1 dk acilir |
| MySQL 8 | Aiven ucretsiz MySQL plani | TLS zorunlu (`DB_SSL=true` + `DB_SSL_CA`) |
| Zincir | Ethereum Sepolia testnet | Faucet test ETH'i; gercek para harcanmaz |
| YZ | EVREN LLM API | `EVREN_API_KEY` |

1. **Aiven** → Create service → MySQL → *Free plan*. Overview sayfasindan *Service URI* ve *CA certificate* degerlerini alin.
2. Semayi bulut veritabanina kurun (kendi bilgisayarinizdan, bir kez):
   ```bash
   cd mysql-certification-api && npm install
   # .env: DATABASE_URL, DB_SSL=true, DB_SSL_CA (ca.pem icerigi, satir sonlari \n)
   npm run init-db
   ```
   `init-db`, dump'taki `DEFINER=root@localhost` ifadelerini temizler. Bulut kullanicisinin
   trigger olusturma yetkisi yoksa uyari verir ve devam eder; CCI saklı yordami yoksa API
   ayni hesabi dogrudan SQL ile yapar.
3. (Istege bagli) Sepolia'ya kontrat: `.env`'e `RPC_URL` ve **yalnizca test** `PRIVATE_KEY` yazip
   `npm run deploy:contract`; cikan adresi `CERT_ANCHOR_ADDRESS` olarak saklayin.
4. **Render** → New → *Blueprint* → bu repo. Kokteki `render.yaml` servisi tanimlar; panel
   `DATABASE_URL`, `DB_SSL_CA`, `PRIVATE_KEY`, `CERT_ANCHOR_ADDRESS`, `EVREN_API_KEY` degerlerini sorar.
5. Yayindaki adreste baslik cubugunda `zincir: aktif` ve `EVREN: aktif` gorunmelidir.

## Kurulum

```bash
# 1. MySQL'de hydrocert veritabanini schema.sql'den olustur
npm install
cp .env.example .env      # DB + (istege bagli) zincir ve EVREN ayarlarini doldur
npm run init-db           # schema.sql'i kurar (yerel veya bulut MySQL)
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
| GET | `/durum` | API / zincir / EVREN durumu |
| POST | `/ai/asistan` | CBAM / RED III asistani (`{soru, gecmis}`) |
| POST | `/ai/belge` | Belge gorselinden sertifika alanlari (`{gorsel: dataURL}`) |
| GET | `/ai/risk/:seri_no` | Kural tabanli + model risk / uyum skoru |
| POST | `/ai/ara` | Anlamsal arama (`{sorgu}`) |

## Ortam degiskenleri

`.env.example` dosyasina bakin: `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`,
`DB_NAME` (veya `DATABASE_URL`), `DB_SSL`, `DB_SSL_CA`, `RPC_URL`, `PRIVATE_KEY`,
`CERT_ANCHOR_ADDRESS`, `EXPLORER_TX_URL`, `EVREN_API_KEY`, `PORT`.

> Not (mysql2): `dateStrings: true` ayari kritiktir — DATE alanlari Date objesine
> cevrilirse timezone kaymasi olur ve zincirdeki ozet dogrulamasi bozulur.
