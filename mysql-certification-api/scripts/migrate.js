// sertifika tablosuna zincir kolonlarini ekler (varsa atlar).
// Kullanim: node --env-file=.env scripts/migrate.js
import mysql from 'mysql2/promise';

const conn = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'hydro2026',
  database: process.env.DB_NAME || 'hydrocert',
});

const kolonlar = [
  ['veri_hash', "VARCHAR(66) NULL COMMENT 'keccak256 sertifika ozeti'"],
  ['tx_hash', "VARCHAR(66) NULL COMMENT 'zincir islem hashi'"],
  ['zincir_durum', "VARCHAR(20) NOT NULL DEFAULT 'zincir_disi' COMMENT 'zincir_disi|gonderildi|onaylandi|hata'"],
];

for (const [ad, tanim] of kolonlar) {
  const [rows] = await conn.execute(
    `SELECT COUNT(*) AS c FROM information_schema.columns
     WHERE table_schema = DATABASE() AND table_name = 'sertifika' AND column_name = ?`,
    [ad],
  );
  if (rows[0].c === 0) {
    await conn.query(`ALTER TABLE sertifika ADD COLUMN ${ad} ${tanim}`);
    console.log(`✓ kolon eklendi: ${ad}`);
  } else {
    console.log(`- kolon zaten var: ${ad}`);
  }
}

await conn.end();
console.log('Migration tamamlandi.');
