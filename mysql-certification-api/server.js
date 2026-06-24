import express from "express";
import mysql from "mysql2/promise";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "hydro2026",
  database: process.env.DB_NAME || "hydrocert",
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
  decimalNumbers: true,
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/uretici", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT u.id, u.ad, u.ulke, COUNT(t.id) AS tesis_sayisi,
              COALESCE(SUM(t.kapasite_mw),0) AS toplam_kapasite_mw
       FROM uretici u LEFT JOIN tesis t ON t.uretici_id=u.id
       GROUP BY u.id, u.ad, u.ulke ORDER BY u.ad`
    );
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({hata:"Sunucu hatasi"}); }
});

app.get("/uretici/:ulke", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT id, ad, ulke, vergi_no FROM uretici WHERE ulke = ?`,
      [req.params.ulke.toUpperCase()]
    );
    res.json(rows);
  } catch (e) { console.error(e); res.status(500).json({hata:"Sunucu hatasi"}); }
});

app.post("/sertifika", async (req, res) => {
  const { parti_id, seri_no, toplam_kg, ihrac_tarihi, gecerlilik } = req.body;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(`UPDATE uretim_partisi SET durum='sertifikali' WHERE id=?`, [parti_id]);
    const [r] = await conn.execute(
      `INSERT INTO sertifika (parti_id, seri_no, toplam_kg, ihrac_tarihi, gecerlilik)
       VALUES (?,?,?,?,?)`,
      [parti_id, seri_no, toplam_kg, ihrac_tarihi, gecerlilik]
    );
    await conn.commit();
    res.status(201).json({ mesaj:"Sertifika olusturuldu", sertifika_id:r.insertId });
  } catch (e) {
    await conn.rollback();
    if (e.errno===1062) res.status(409).json({hata:"Bu seri numarasi zaten kayitli"});
    else if (e.errno===1452) res.status(400).json({hata:"Boyle bir parti yok"});
    else if (e.errno===3819) res.status(400).json({hata:"Veri kurali ihlali"});
    else res.status(500).json({hata:"Olusturulamadi"});
  } finally { conn.release(); }
});

app.get("/cci", async (req, res) => {
  try {
    const esik = parseFloat(req.query.esik) || 3.0;
    const [rows] = await pool.execute(`CALL sp_uretici_cci(?)`, [esik]);
    res.json(rows[0]);
  } catch (e) { console.error(e); res.status(500).json({hata:"CCI hesaplanamadi"}); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`HydroCert API calisiyor: port ${PORT}`));