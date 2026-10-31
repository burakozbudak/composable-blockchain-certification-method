// schema.sql'i yerel veya bulut MySQL'e kurar. Kullanim: npm run init-db
// (Render'da gerek yok: AUTO_INIT_DB=true iken sunucu bos veritabanini ilk acilista kurar.)
import { semayiKur } from '../schema-init.js';

try {
  const { tamam, uyarilar } = await semayiKur();
  console.log(`✓ Sema kuruldu (${tamam} ifade).`);
  if (uyarilar.length) {
    console.warn('\n⚠ Su nesneler yetki nedeniyle olusturulamadi:');
    uyarilar.forEach((u) => console.warn('  - ' + u));
    console.warn(
      '  Servis panelinizde log_bin_trust_function_creators ayari varsa acip tekrar calistirabilirsiniz.\n' +
        '  Trigger olmadan da API calisir; yalnizca kapasite asimi ve denetim logu DB seviyesinde zorlanmaz.',
    );
  }
} catch (e) {
  console.error('✗ ' + e.message);
  process.exit(1);
}
