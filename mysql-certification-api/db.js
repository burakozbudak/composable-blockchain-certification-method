// MySQL baglanti ayarlari — yerel MySQL, Aiven (ucretsiz plan) veya
// herhangi bir bulut MySQL 8 icin ortak yapilandirma.
//
// Iki yontem desteklenir:
//   1) DATABASE_URL=mysql://kullanici:sifre@host:port/veritabani
//   2) DB_HOST / DB_PORT / DB_USER / DB_PASSWORD / DB_NAME
// Bulut veritabanlari TLS ister: DB_SSL=true ve (Aiven icin) DB_SSL_CA'ya
// panelden indirilen ca.pem iceriginin tamami yapistirilir.

function sslAyari() {
  if (String(process.env.DB_SSL || '').toLowerCase() !== 'true') return undefined;
  const ca = process.env.DB_SSL_CA;
  // Ortam degiskenine tek satir olarak yapistirilan PEM'deki \n'leri duzelt.
  return ca ? { ca: ca.replace(/\\n/g, '\n'), rejectUnauthorized: true } : { rejectUnauthorized: true };
}

export function baglantiAyarlari(ek = {}) {
  let temel;
  if (process.env.DATABASE_URL) {
    const u = new URL(process.env.DATABASE_URL);
    temel = {
      host: u.hostname,
      port: Number(u.port) || 3306,
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: u.pathname.replace(/^\//, '') || 'hydrocert',
    };
  } else {
    temel = {
      host: process.env.DB_HOST || 'localhost',
      port: Number(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || 'hydro2026',
      database: process.env.DB_NAME || 'hydrocert',
    };
  }
  return {
    ...temel,
    ssl: sslAyari(),
    charset: 'utf8mb4',
    decimalNumbers: true,
    // DATE alanlari string donmeli; Date objesine cevrilirse timezone
    // kaymasi olur ve zincirdeki veri ozeti (hash) tutmaz.
    dateStrings: true,
    ...ek,
  };
}
