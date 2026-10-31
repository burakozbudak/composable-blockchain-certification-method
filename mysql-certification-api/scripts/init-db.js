// schema.sql'i (mysqldump ciktisi) bulut MySQL'e kurar.
// Kullanim: npm run init-db
//
// Bulut servislerinde (Aiven vb.) root yetkisi olmadigi icin:
//  - DEFINER=`root`@`localhost` ifadeleri silinir (nesne, baglanan kullanici adina olusur),
//  - DELIMITER ;; bloklari ayrilarak tek tek calistirilir,
//  - trigger/procedure olusturma yetkisi yoksa uyari verilir ama kurulum durmaz;
//    API bu durumda CCI'yi saklı yordam yerine dogrudan SQL ile hesaplar.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { baglantiAyarlari } from '../db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ham = fs.readFileSync(path.join(__dirname, '..', 'schema.sql'), 'utf8');

const temiz = ham
  .replace(/\/\*!50017 DEFINER=`[^`]+`@`[^`]+`\*\/\s*/g, '')
  .replace(/\/\*!50013 DEFINER=`[^`]+`@`[^`]+` SQL SECURITY DEFINER \*\/\s*/g, '')
  .replace(/DEFINER=`[^`]+`@`[^`]+`\s*/g, '')
  // Dump'taki AUTO_INCREMENT sayaçlari (ör. 131076) temiz kurulumda gereksiz.
  .replace(/ AUTO_INCREMENT=\d+/g, '');

// DELIMITER yonergelerine gore ifadelere bol.
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

const conn = await mysql.createConnection(baglantiAyarlari({ multipleStatements: false }));
// LOCK TABLES bulut kullanicilarinda kisitli olabilir; veri yuklemesi icin gereksiz.
const atla = /^(LOCK TABLES|UNLOCK TABLES)/i;
let tamam = 0;
const uyarilar = [];

for (const ifade of ifadeler(temiz)) {
  if (atla.test(ifade)) continue;
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
    console.error('\n✗ Calistirilamadi:\n' + ifade.slice(0, 400) + '\n→ ' + e.message);
    await conn.end();
    process.exit(1);
  }
}

await conn.end();
console.log(`✓ Sema kuruldu (${tamam} ifade).`);
if (uyarilar.length) {
  console.warn('\n⚠ Su nesneler yetki nedeniyle olusturulamadi:');
  uyarilar.forEach((u) => console.warn('  - ' + u));
  console.warn(
    '  Servis panelinizde log_bin_trust_function_creators ayari varsa acip tekrar calistirabilirsiniz.\n' +
      '  Trigger olmadan da API calisir; yalnizca kapasite asimi ve denetim logu DB seviyesinde zorlanmaz.',
  );
}
