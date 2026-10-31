// schema.sql'i (mysqldump ciktisi) bir MySQL veritabanina kurar.
// Hem `npm run init-db` hem de sunucunun ilk acilisi (AUTO_INIT_DB) kullanir.
//
// Bulut servislerinde (Aiven vb.) root yetkisi olmadigi icin:
//  - DEFINER=`root`@`localhost` ifadeleri silinir,
//  - DELIMITER ;; bloklari ayrilarak tek tek calistirilir,
//  - trigger/procedure yetkisi yoksa uyari verilir, kurulum durmaz
//    (API, CCI'yi saklı yordam yerine dogrudan SQL ile hesaplar).
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { baglantiAyarlari } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function temizle(ham) {
  return ham
    .replace(/\/\*!50017 DEFINER=`[^`]+`@`[^`]+`\*\/\s*/g, '')
    .replace(/\/\*!50013 DEFINER=`[^`]+`@`[^`]+` SQL SECURITY DEFINER \*\/\s*/g, '')
    .replace(/DEFINER=`[^`]+`@`[^`]+`\s*/g, '')
    .replace(/ AUTO_INCREMENT=\d+/g, '');
}

function ifadeler(sql) {
  const sonuc = [];
  let ayirici = ';';
  let tampon = '';
  for (const satir of sql.split('\n')) {
    const d = satir.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
    if (d) {
      ayirici = d[1];
      continue;
    }
    if (/^\s*--/.test(satir) && !tampon.trim()) continue;
    tampon += satir + '\n';
    if (tampon.trimEnd().endsWith(ayirici)) {
      const ifade = tampon.trimEnd().slice(0, -ayirici.length).trim();
      if (ifade) sonuc.push(ifade);
      tampon = '';
    }
  }
  if (tampon.trim()) sonuc.push(tampon.trim());
  return sonuc;
}

export async function semayiKur() {
  const ham = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  const conn = await mysql.createConnection(baglantiAyarlari());
  const uyarilar = [];
  let tamam = 0;
  try {
    for (const ifade of ifadeler(temizle(ham))) {
      if (/^(LOCK TABLES|UNLOCK TABLES)/i.test(ifade)) continue;
      try {
        await conn.query(ifade);
        tamam++;
      } catch (e) {
        const nesne = /TRIGGER|PROCEDURE/i.test(ifade.slice(0, 200));
        if (nesne && [1419, 1227, 1142, 1044].includes(e.errno)) {
          const ad = (ifade.match(/(TRIGGER|PROCEDURE)\s+`([^`]+)`/i) || [])[2] || '?';
          uyarilar.push(`${ad}: ${e.message}`);
          continue;
        }
        throw new Error(`Sema ifadesi calistirilamadi: ${e.message}\n${ifade.slice(0, 300)}`);
      }
    }
  } finally {
    await conn.end();
  }
  return { tamam, uyarilar };
}

// Veritabani bossa (sertifika tablosu yoksa) semayi kurar; doluysa dokunmaz.
export async function gerekirseKur(pool) {
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = 'sertifika'`,
  );
  if (rows[0].c > 0) return false;
  console.log('Veritabani bos — schema.sql kuruluyor…');
  const { tamam, uyarilar } = await semayiKur();
  console.log(`✓ Sema kuruldu (${tamam} ifade).`);
  uyarilar.forEach((u) => console.warn('⚠ Olusturulamadi (yetki):', u));
  return true;
}
