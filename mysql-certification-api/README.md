\# HydroCert — MySQL Sertifikasyon API



EnergyStream blockchain sertifikasyon sisteminin iliskisel (MySQL) implementasyonu.

Turkiye-AB yenilenebilir hidrojen koridoru icin uretici, tesis, uretim partisi,

sertifika ve transfer verilerini yoneten REST API + dashboard.



\## Mimari

\- \*\*MySQL 8\*\* — InnoDB, transaction, trigger, stored procedure, window functions

\- \*\*Node.js + Express\*\* — mysql2 connection pool, prepared statements

\- \*\*Dashboard\*\* — vanilla HTML/JS, dort endpointi gorsel kullanir



Veri modeli: uretici -> tesis -> uretim\_partisi -> sertifika -> transfer -> alici.

Karbon Kredibilite Indeksi (CCI) esik-tabanli normalize ile hesaplanir.

Sertifika kapasitesini asan transfer, BEFORE INSERT trigger ile DB seviyesinde engellenir.



\## Kurulum

1\. MySQL'de hydrocert veritabanini olustur (sema dosyalarına bak)

2\. Bagimliliklari kur ve calistir:

