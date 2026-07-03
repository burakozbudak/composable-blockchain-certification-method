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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'hydro2026',
  database: process.env.DB_NAME || 'hydrocert',
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  decimalNumbers: true,
  // DATE alanlari string donmeli; Date objesine cevrilirse timezone
  // kaymasi olur ve zincirdeki veri ozeti (hash) tutmaz.
  dateStrings: true,
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/durum', (req, res) => {
  res.json({ zincir: zincirAktif() ? 'aktif' : 'kapali' });
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

app.post('/sertifika', async (req, res) => {
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

app.get('/cci', async (req, res) => {
  try {
    const esik = parseFloat(req.query.esik) || 3.0;
    const [rows] = await pool.execute(`CALL sp_uretici_cci(?)`, [esik]);
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ hata: 'CCI hesaplanamadi' });
  }
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () =>
  console.log(
    `✓ HydroCert API http://localhost:${PORT} · zincir: ${zincirAktif() ? 'AKTIF' : 'kapali (RPC_URL/PRIVATE_KEY/CERT_ANCHOR_ADDRESS tanimlanmamis)'}`,
  ),
);
