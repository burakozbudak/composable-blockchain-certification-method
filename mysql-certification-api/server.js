import express from 'express';
import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  zincirAktif,
  zincireSabitle,
  zincirdenDogrula,
  sertifikaOzeti,
  EXPLORER_TX_URL,
} from './chain.js';
import { baglantiAyarlari } from './db.js';
import { evrenAktif, MODELLER } from './evren.js';
import { aiRouter, hizSiniri } from './ai.js';
import { gerekirseKur } from './schema-init.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = mysql.createPool(
  baglantiAyarlari({ waitForConnections: true, connectionLimit: 5 }),
);

const app = express();
app.set('trust proxy', 1); // Render vb. ters vekil arkasinda gercek IP icin
app.use(express.json({ limit: '8mb' })); // belge gorselleri base64 gelir
app.use(express.static(path.join(__dirname, 'public')));

app.get('/durum', (req, res) => {
  res.json({
    zincir: zincirAktif() ? 'aktif' : 'kapali',
    evren: evrenAktif() ? 'aktif' : 'kapali',
    modeller: evrenAktif() ? MODELLER : null,
  });
});

app.get('/uretici', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.ad, u.ulke, COUNT(t.id) AS tesis_sayisi,
              COALESCE(SUM(t.kapasite_mw),0) AS toplam_kapasite_mw
       FROM uretici u LEFT JOIN tesis t ON t.uretici_id=u.id
       GROUP BY u.id, u.ad, u.ulke ORDER BY u.ad`,
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ hata: 'Sunucu hatasi' });
  }
});

app.get('/uretici/:ulke', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, ad, ulke, vergi_no FROM uretici WHERE ulke = ?`,
      [req.params.ulke.toUpperCase()],
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ hata: 'Sunucu hatasi' });
  }
});

app.get('/sertifika', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, parti_id, seri_no, toplam_kg, ihrac_tarihi, gecerlilik,
              veri_hash, tx_hash, zincir_durum
       FROM sertifika ORDER BY id DESC LIMIT 50`,
    );
    res.json(rows);
  } catch (e) {
    console.error(e);
    res.status(500).json({ hata: 'Sunucu hatasi' });
  }
});

// Herkese acik demoda zincir islemlerini (test ETH) korumak icin sinirli.
app.post('/sertifika', hizSiniri({ max: Number(process.env.WRITE_RATE_LIMIT_PER_MIN) || 5 }), async (req, res) => {
  const { parti_id, seri_no, toplam_kg, ihrac_tarihi, gecerlilik } = req.body;
  if (!parti_id || !seri_no || !toplam_kg || !ihrac_tarihi || !gecerlilik) {
    return res.status(400).json({ hata: 'Tum alanlar zorunlu' });
  }
  const conn = await pool.getConnection();
  let sertifikaId;
  try {
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE uretim_partisi SET durum='sertifikali' WHERE id=?`,
      [parti_id],
    );
    const { dataHash } = sertifikaOzeti(req.body);
    const [r] = await conn.execute(
      `INSERT INTO sertifika (parti_id, seri_no, toplam_kg, ihrac_tarihi, gecerlilik, veri_hash)
       VALUES (?,?,?,?,?,?)`,
      [parti_id, seri_no, toplam_kg, ihrac_tarihi, gecerlilik, dataHash],
    );
    await conn.commit();
    sertifikaId = r.insertId;
  } catch (e) {
    await conn.rollback();
    conn.release();
    if (e.errno === 1062)
      return res.status(409).json({ hata: 'Bu seri numarasi zaten kayitli' });
    if (e.errno === 1452)
      return res.status(400).json({ hata: 'Boyle bir parti yok' });
    if (e.errno === 3819)
      return res.status(400).json({ hata: 'Veri kurali ihlali' });
    console.error(e);
    return res.status(500).json({ hata: 'Olusturulamadi' });
  }
  conn.release();

  // MySQL kaydi kesinlesti; simdi ozet zincire sabitlenir. Zincir hatasi
  // sertifikayi iptal etmez, durum kolonunda izlenir.
  let zincir = { durum: 'zincir_disi' };
  if (zincirAktif()) {
    try {
      const { txHash, tx } = await zincireSabitle(req.body);
      await pool.execute(
        `UPDATE sertifika SET tx_hash=?, zincir_durum='gonderildi' WHERE id=?`,
        [txHash, sertifikaId],
      );
      zincir = { durum: 'gonderildi', tx_hash: txHash, explorer: EXPLORER_TX_URL + txHash };
      // Blok onayi arka planda beklenir, yanit geciktirilmez.
      tx.wait()
        .then(() =>
          pool.execute(`UPDATE sertifika SET zincir_durum='onaylandi' WHERE id=?`, [sertifikaId]),
        )
        .catch(async (err) => {
          console.error('Zincir onayi basarisiz:', err.message);
          await pool.execute(`UPDATE sertifika SET zincir_durum='hata' WHERE id=?`, [sertifikaId]);
        });
    } catch (e) {
      console.error('Zincire yazilamadi:', e.message);
      await pool.execute(`UPDATE sertifika SET zincir_durum='hata' WHERE id=?`, [sertifikaId]);
      zincir = { durum: 'hata' };
    }
  }

  res.status(201).json({ mesaj: 'Sertifika olusturuldu', sertifika_id: sertifikaId, zincir });
});

// Seri no ile hem MySQL kaydini hem zincirdeki ozeti karsilastirir.
app.get('/dogrula/:seri_no', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT parti_id, seri_no, toplam_kg, ihrac_tarihi, gecerlilik, tx_hash, zincir_durum
       FROM sertifika WHERE seri_no = ?`,
      [req.params.seri_no],
    );
    if (!rows.length) return res.status(404).json({ hata: 'Sertifika bulunamadi' });
    const s = rows[0];
    const kayit = {
      parti_id: s.parti_id,
      seri_no: s.seri_no,
      toplam_kg: s.toplam_kg,
      ihrac_tarihi: s.ihrac_tarihi,
      gecerlilik: s.gecerlilik,
    };
    let zincir = { durum: 'zincir_kapali' };
    if (zincirAktif()) {
      const sonuc = await zincirdenDogrula(kayit);
      zincir = {
        durum: sonuc.exists ? (sonuc.valid ? 'dogrulandi' : 'UYUSMAZLIK') : 'zincirde_yok',
        sabitlenme_zamani: sonuc.anchoredAt
          ? new Date(sonuc.anchoredAt * 1000).toISOString()
          : null,
        explorer: s.tx_hash ? EXPLORER_TX_URL + s.tx_hash : null,
      };
    }
    res.json({ sertifika: kayit, zincir });
  } catch (e) {
    console.error(e);
    res.status(500).json({ hata: 'Dogrulama basarisiz' });
  }
});

// CCI saklı yordamla hesaplanir; yordam kurulamadiysa (bulut MySQL'de
// yetki yoksa) ayni sorgu dogrudan calistirilir.
const CCI_SQL = `SELECT u.ad,
         ROUND(SUM(p.karbon_yogunlugu * p.h2_kg) / SUM(p.h2_kg), 3) AS agirlikli_karbon,
         ROUND(100 * (1 - (SUM(p.karbon_yogunlugu * p.h2_kg) / SUM(p.h2_kg)) / ?), 1) AS cci_skor
  FROM uretim_partisi p
  JOIN tesis t   ON t.id = p.tesis_id
  JOIN uretici u ON u.id = t.uretici_id
  GROUP BY u.id, u.ad
  ORDER BY cci_skor DESC`;

export async function cciHesapla(esik) {
  try {
    const [rows] = await pool.execute(`CALL sp_uretici_cci(?)`, [esik]);
    return rows[0];
  } catch (e) {
    if (e.errno !== 1305) throw e; // 1305: PROCEDURE does not exist
    const [rows] = await pool.execute(CCI_SQL, [esik]);
    return rows;
  }
}

app.get('/cci', async (req, res) => {
  try {
    const esik = parseFloat(req.query.esik) || 3.0;
    res.json(await cciHesapla(esik));
  } catch (e) {
    console.error(e);
    res.status(500).json({ hata: 'CCI hesaplanamadi' });
  }
});

app.use('/ai', aiRouter({ pool, cciHesapla }));

const PORT = Number(process.env.PORT) || 3000;

// Bulut kurulumunda (AUTO_INIT_DB=true) bos veritabani ilk acilista kurulur.
if (String(process.env.AUTO_INIT_DB || '').toLowerCase() === 'true') {
  try {
    await gerekirseKur(pool);
  } catch (e) {
    console.error('Otomatik sema kurulumu basarisiz:', e.message);
  }
}

app.listen(PORT, () =>
  console.log(
    `✓ HydroCert API http://localhost:${PORT} · zincir: ${zincirAktif() ? 'AKTIF' : 'kapali (RPC_URL/PRIVATE_KEY/CERT_ANCHOR_ADDRESS tanimlanmamis)'} · EVREN: ${evrenAktif() ? 'AKTIF' : 'kapali (EVREN_API_KEY yok)'}`,
  ),
);
