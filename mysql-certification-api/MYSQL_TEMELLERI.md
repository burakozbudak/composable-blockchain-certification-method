\# HydroCert — MySQL Temelleri ve Proje Mimarisi



Bu belge, HydroCert veritabanini sifirdan kurarken kullanilan her MySQL kavraminin nerede, ne icin, neden kullanildigini aciklar. Sekiz katman halinde, alttan uste dogru.



\## Katman 0 — Motor ve Karakter Seti

InnoDB: transaction ve foreign key destegi icin (MyISAM bunlari desteklemez). utf8mb4: gercek 4 baytlik UTF-8, Turkce karakter ve emoji icin. AUTO\_INCREMENT: PostgreSQL SERIAL karsiligi, otomatik artan id.



\## Katman 1 — Veri Tipleri

DECIMAL (para/olcum, FLOAT degil cunku yuvarlama hatasi yapar). DATE (takvimsel olgu) vs DATETIME (olay ani) kurali. TIMESTAMP otomatik dolum icin. ENUM az sayida sabit kume icin. CHAR(2) ISO ulke kodu, VARCHAR degisken metin.



\## Katman 2 — Kisitlar

Felsefe: veri kuralini uygulama degil DB korur. PRIMARY KEY, FOREIGN KEY (ON DELETE RESTRICT), UNIQUE, NOT NULL, CHECK (8.0.16+), DEFAULT. Hata kodlari kategori belirtir: 3819 CHECK ihlali, 1452 FK ihlali, 1062 UNIQUE ihlali.



\## Katman 3 — Iliskiler ve JOIN

1:N (tesis-uretici), N:M (transfer junction table). INNER vs LEFT JOIN. "Esi olmayani bul" icin LEFT JOIN + IS NULL kalibi. COALESCE ile NULL aritmetigini engelleme. MySQL'de FULL OUTER JOIN yok (UNION ile taklit).



\## Katman 4 — Aggregation ve Analitik

GROUP BY + HAVING (WHERE gruplamadan once, HAVING sonra). CTE (WITH). Agirlikli ortalama. Window functions: MAX() OVER (), RANK(), SUM() OVER (PARTITION BY ... ORDER BY ...) running total. CCI'da "en kotuye gore" vs "esik-tabanli" normalize karari.



\## Katman 5 — Indeksleme ve Performans

EXPLAIN kolonlari: type (ALL/range/ref/const), key, rows, Extra. Composite index + leftmost prefix (kolon sirasi onemli). Secicilik: dusuk cardinality'de optimizer indeksi kullanmaz. Covering index (Using index). EXPLAIN ANALYZE gercek sure.



\## Katman 6 — Transaction, Trigger, Procedure

Transaction (ACID): START/COMMIT/ROLLBACK, atomiklik. MySQL varsayilan izolasyon REPEATABLE READ. Trigger: AFTER UPDATE audit log, BEFORE INSERT kapasite kontrolu (cok-satir toplami, CHECK yapamaz) + SIGNAL ile ozel hata. DELIMITER, OLD/NEW. View

