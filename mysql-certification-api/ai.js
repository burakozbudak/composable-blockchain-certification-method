// HydroCert × EVREN yapay zeka uclari
//   POST /ai/asistan   CBAM / RED III asistani (glm-5.3, panel verisiyle baglamli)
//   POST /ai/belge     Belge gorselinden sertifika formu (dots-ocr + glm-5.3)
//   GET  /ai/risk/:seri RFNBO uyum / risk skoru (clef + kural tabanli kontrol)
//   POST /ai/ara       Anlamsal arama (qwen3-embedding-8b + qwen3-reranker-8b)
import crypto from 'crypto';
import express from 'express';
import { evrenAktif, sohbet, ocr, karar, gomme, yenidenSirala, EvrenHatasi } from './evren.js';

// RED III / Delege Tuzuk (AB) 2023/1185: RFNBO icin fosil karsilastiriciya
// (94 gCO2e/MJ) gore en az %70 azaltim → 28,2 gCO2e/MJ × 120 MJ/kg (AID) ≈ 3,38 kgCO2e/kgH2.
export const RFNBO_ESIK = 3.38;

// --- Basit IP bazli hiz sinirlayici (ucretsiz kotayi korumak icin) ---------
export function hizSiniri({ pencereMs = 60_000, max = 20 } = {}) {
  const kayit = new Map();
  return (req, res, next) => {
    const simdi = Date.now();
    const ip = req.ip || 'bilinmiyor';
    const liste = (kayit.get(ip) || []).filter((t) => simdi - t < pencereMs);
    if (liste.length >= max) {
      return res.status(429).json({ hata: 'Cok fazla istek, biraz sonra tekrar deneyin' });
    }
    liste.push(simdi);
    kayit.set(ip, liste);
    if (kayit.size > 5000) kayit.clear();
    next();
  };
}

function hataYaniti(res, e) {
  if (e instanceof EvrenHatasi) {
    console.error(e.message);
    const status = e.kod === 'evren_kapali' ? 503 : e.status === 429 ? 429 : 502;
    const mesaj =
      e.kod === 'evren_kapali'
        ? 'EVREN yapay zeka ozellikleri kapali (EVREN_API_KEY tanimli degil)'
        : e.kod === 'terms_not_accepted'
          ? 'EVREN kullanim sartlari onaylanmamis (Test Alani → anahtar kutusu)'
          : e.status === 429
            ? 'EVREN kotasi/hiz siniri doldu, biraz sonra tekrar deneyin'
            : 'EVREN servisine ulasilamadi';
    return res.status(status).json({ hata: mesaj, kod: e.kod });
  }
  console.error(e);
  return res.status(500).json({ hata: 'Sunucu hatasi' });
}

export function aiRouter({ pool, cciHesapla }) {
  const r = express.Router();
  r.use(hizSiniri({ max: Number(process.env.AI_RATE_LIMIT_PER_MIN) || 20 }));

  // Panel verisinin LLM'e verilecek ozet hali.
  async function panelBaglami() {
    const [uretici] = await pool.query(`SELECT id, ad, ulke FROM uretici`);
    const [tesis] = await pool.query(
      `SELECT id, uretici_id, ad, konum, kapasite_mw, enerji_kaynagi FROM tesis`,
    );
    const [parti] = await pool.query(
      `SELECT id, tesis_id, baslangic, bitis, h2_kg, enerji_kwh, karbon_yogunlugu, durum
       FROM uretim_partisi ORDER BY id DESC LIMIT 100`,
    );
    const [sertifika] = await pool.query(
      `SELECT s.seri_no, s.parti_id, s.toplam_kg, s.ihrac_tarihi, s.gecerlilik, s.durum,
              s.metadata, s.zincir_durum, COALESCE(SUM(t.miktar_kg),0) AS satilan_kg
       FROM sertifika s LEFT JOIN transfer t ON t.sertifika_id = s.id
       GROUP BY s.id ORDER BY s.id DESC LIMIT 100`,
    );
    const cci = await cciHesapla(3.0);
    return { uretici, tesis, uretim_partisi: parti, sertifika, cci_esik_3: cci };
  }

  // ---------------------------------------------------------------- asistan
  r.post('/asistan', async (req, res) => {
    const soru = String(req.body?.soru || '').trim().slice(0, 2000);
    if (!soru) return res.status(400).json({ hata: 'Soru bos' });
    const gecmis = Array.isArray(req.body?.gecmis)
      ? req.body.gecmis
          .filter((m) => ['user', 'assistant'].includes(m?.role) && typeof m.content === 'string')
          .slice(-8)
          .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
      : [];
    try {
      const baglam = await panelBaglami();
      const sistem = `Sen HydroCert panelinin CBAM / RED III uyum asistanisin. Turkce, kisa ve net yanit ver.
HydroCert, Turkiye–AB yenilenebilir hidrojen koridoru icin uretim partilerini sertifikalayan, sertifika ozetlerini Ethereum'a (CertAnchor) sabitleyen bir sistemdir.
Kurallar:
- Panel verisiyle ilgili sorularda YALNIZCA asagidaki JSON verisini kullan; veride olmayan sayi uydurma.
- karbon_yogunlugu birimi kgCO2e/kgH2. RFNBO esigi ≈ ${RFNBO_ESIK} kgCO2e/kgH2 (fosil karsilastiriciya gore %70 azaltim).
- CCI = 100 × (1 − agirlikli_karbon / esik); yuksek CCI daha temiz uretim demektir.
- Mevzuat (CBAM, RED III, Delege Tuzukler) hakkinda genel bilgi verebilirsin ama kesin hukuki yorum yapma; resmi metne bakilmasini oner.
Panel verisi (JSON):
${JSON.stringify(baglam)}`;
      const yanit = await sohbet([{ role: 'system', content: sistem }, ...gecmis, { role: 'user', content: soru }]);
      res.json({ yanit });
    } catch (e) {
      hataYaniti(res, e);
    }
  });

  // ---------------------------------------------------------------- belge
  r.post('/belge', async (req, res) => {
    const gorsel = String(req.body?.gorsel || '');
    if (!/^data:image\/(png|jpe?g|webp);base64,/.test(gorsel)) {
      return res.status(400).json({ hata: 'PNG, JPEG veya WebP gorsel (data URL) gonderin' });
    }
    try {
      const metin = await ocr(gorsel);
      const [partiler] = await pool.query(
        `SELECT p.id, t.ad AS tesis, u.ad AS uretici, p.baslangic, p.bitis, p.h2_kg, p.karbon_yogunlugu
         FROM uretim_partisi p JOIN tesis t ON t.id=p.tesis_id JOIN uretici u ON u.id=t.uretici_id
         ORDER BY p.id DESC LIMIT 100`,
      );
      const cikti = await sohbet(
        [
          {
            role: 'system',
            content: `Bir hidrojen uretim raporu / sertifika belgesinin OCR metninden sertifika form alanlarini cikar.
Yalnizca JSON dondur:
{"parti_id": sayi|null, "seri_no": metin|null, "toplam_kg": sayi|null, "ihrac_tarihi": "YYYY-AA-GG"|null,
 "gecerlilik": "YYYY-AA-GG"|null, "karbon_yogunlugu": sayi|null, "uretici": metin|null, "tesis": metin|null,
 "guven": "dusuk"|"orta"|"yuksek", "notlar": "kisa Turkce aciklama"}
Kurallar: Belgede olmayan alani null birak, tahmin etme. parti_id'yi yalnizca belgedeki tesis ve donem asagidaki partilerden biriyle acikca eslesirse doldur.
Gecerlilik belgede yoksa null birak. Sayilarda binlik ayiriciyi kaldir.
Kayitli partiler: ${JSON.stringify(partiler)}`,
          },
          { role: 'user', content: metin.slice(0, 30_000) },
        ],
        { json: true, maxTokens: 2048 },
      );
      let alanlar;
      try {
        alanlar = JSON.parse(cikti.replace(/^```(json)?|```$/g, '').trim());
      } catch {
        alanlar = { notlar: 'Model gecerli JSON dondurmedi', ham: cikti.slice(0, 500) };
      }
      res.json({ alanlar, ocr_metni: metin.slice(0, 5000) });
    } catch (e) {
      hataYaniti(res, e);
    }
  });

  // ---------------------------------------------------------------- risk
  r.get('/risk/:seri_no', async (req, res) => {
    try {
      const [rows] = await pool.execute(
        `SELECT s.seri_no, s.toplam_kg, s.ihrac_tarihi, s.gecerlilik, s.durum, s.metadata, s.zincir_durum,
                p.id AS parti_id, p.baslangic, p.bitis, p.h2_kg, p.enerji_kwh, p.karbon_yogunlugu,
                t.ad AS tesis, t.enerji_kaynagi, t.kapasite_mw, u.ad AS uretici, u.ulke,
                (SELECT COALESCE(SUM(miktar_kg),0) FROM transfer tr WHERE tr.sertifika_id=s.id) AS satilan_kg
         FROM sertifika s
         JOIN uretim_partisi p ON p.id = s.parti_id
         JOIN tesis t ON t.id = p.tesis_id
         JOIN uretici u ON u.id = t.uretici_id
         WHERE s.seri_no = ?`,
        [req.params.seri_no],
      );
      if (!rows.length) return res.status(404).json({ hata: 'Sertifika bulunamadi' });
      const k = rows[0];
      const meta = typeof k.metadata === 'string' ? JSON.parse(k.metadata || 'null') : k.metadata;
      const bugun = new Date().toISOString().slice(0, 10);

      // Kesin (deterministik) kontroller — modelden bagimsiz.
      const kurallar = [
        { ad: 'RFNBO karbon esigi', gecti: k.karbon_yogunlugu <= RFNBO_ESIK,
          detay: `${k.karbon_yogunlugu} ≤ ${RFNBO_ESIK} kgCO2e/kgH2` },
        { ad: 'Miktar ≤ parti uretimi', gecti: k.toplam_kg <= k.h2_kg,
          detay: `${k.toplam_kg} kg / ${k.h2_kg} kg` },
        { ad: 'Gecerlilik suresi', gecti: k.gecerlilik >= bugun, detay: `gecerlilik ${k.gecerlilik}` },
        { ad: 'Denetim bilgisi', gecti: Boolean(meta?.denetci && meta?.standart),
          detay: meta ? `${meta.denetci || '?'} · ${meta.standart || '?'}` : 'metadata yok' },
        { ad: 'Zincire sabitlenme', gecti: k.zincir_durum === 'onaylandi', detay: k.zincir_durum },
      ];

      let model = null;
      let model_hatasi = null;
      if (evrenAktif()) {
        try {
          const state = `HydroCert yesil hidrojen sertifika kaydi (bugun: ${bugun}). RFNBO esigi ${RFNBO_ESIK} kgCO2e/kgH2.\n` +
            JSON.stringify({ ...k, metadata: meta });
          model = await karar(state, {
            rfnbo_uyum: { type: 'noul',
              instructions: 'Bu sertifika AB RED III RFNBO (yenilenebilir kaynakli yakit) kosullarini karsiliyor gorunuyor mu? Karbon yogunlugu, enerji kaynagi ve denetim bilgisine bak.' },
            belge_yeterliligi: { type: 'score',
              instructions: 'CBAM / AB ithalati icin denetim ve belge bilgisi ne kadar yeterli?',
              criteria: ['yetersiz', 'kismi', 'yeterli'] },
            risk_duzeyi: { type: 'choice',
              instructions: 'AB alicisi icin bu sertifikanin uyum riski nedir?',
              criteria: {
                dusuk: 'esik altinda, denetlenmis, gecerli ve zincire sabitlenmis',
                orta: 'bir veya iki eksik ya da belirsiz alan var',
                yuksek: 'esik asimi, suresi gecmis veya denetimsiz',
              } },
          });
        } catch (e) {
          model_hatasi = e.message;
        }
      }
      res.json({ sertifika: k.seri_no, kurallar, model, model_hatasi, evren: evrenAktif() });
    } catch (e) {
      hataYaniti(res, e);
    }
  });

  // ---------------------------------------------------------------- arama
  let indeks = { anahtar: null, belgeler: [], vektorler: [] };

  async function indeksiGuncelle() {
    const [s] = await pool.query(
      `SELECT s.seri_no, s.toplam_kg, s.ihrac_tarihi, s.gecerlilik, s.durum, s.metadata, s.zincir_durum,
              p.karbon_yogunlugu, p.baslangic, p.bitis, t.ad AS tesis, t.konum, t.enerji_kaynagi,
              u.ad AS uretici, u.ulke
       FROM sertifika s JOIN uretim_partisi p ON p.id=s.parti_id
       JOIN tesis t ON t.id=p.tesis_id JOIN uretici u ON u.id=t.uretici_id
       ORDER BY s.id DESC LIMIT 500`,
    );
    const [t] = await pool.query(
      `SELECT t.ad, t.konum, t.kapasite_mw, t.enerji_kaynagi, u.ad AS uretici, u.ulke
       FROM tesis t JOIN uretici u ON u.id=t.uretici_id`,
    );
    const belgeler = [
      ...s.map((x) => ({
        tur: 'sertifika',
        baslik: x.seri_no,
        metin: `Sertifika ${x.seri_no}: ${x.uretici} (${x.ulke}), tesis ${x.tesis} / ${x.konum}, kaynak ${x.enerji_kaynagi}. ` +
          `${x.toplam_kg} kg H2, uretim ${x.baslangic}–${x.bitis}, karbon ${x.karbon_yogunlugu} kgCO2e/kgH2, ` +
          `ihrac ${x.ihrac_tarihi}, gecerlilik ${x.gecerlilik}, durum ${x.durum}, zincir ${x.zincir_durum}. ` +
          (x.metadata ? `Denetim: ${typeof x.metadata === 'string' ? x.metadata : JSON.stringify(x.metadata)}` : 'Denetim bilgisi yok.'),
      })),
      ...t.map((x) => ({
        tur: 'tesis',
        baslik: x.ad,
        metin: `Tesis ${x.ad} (${x.konum}), ${x.kapasite_mw} MW ${x.enerji_kaynagi} kaynakli; uretici ${x.uretici} (${x.ulke}).`,
      })),
    ];
    const anahtar = crypto.createHash('sha1').update(belgeler.map((b) => b.metin).join('\n')).digest('hex');
    if (anahtar !== indeks.anahtar) {
      const vektorler = [];
      for (let i = 0; i < belgeler.length; i += 64) {
        vektorler.push(...(await gomme(belgeler.slice(i, i + 64).map((b) => b.metin))));
      }
      indeks = { anahtar, belgeler, vektorler };
    }
    return indeks;
  }

  const kosinus = (a, b) => {
    let d = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    return d / (Math.sqrt(na) * Math.sqrt(nb) || 1);
  };

  r.post('/ara', async (req, res) => {
    const sorgu = String(req.body?.sorgu || '').trim().slice(0, 500);
    if (!sorgu) return res.status(400).json({ hata: 'Sorgu bos' });
    try {
      const { belgeler, vektorler } = await indeksiGuncelle();
      if (!belgeler.length) return res.json({ sonuclar: [] });
      const [qv] = await gomme([sorgu]);
      let adaylar = belgeler
        .map((b, i) => ({ ...b, benzerlik: kosinus(qv, vektorler[i]) }))
        .sort((a, b) => b.benzerlik - a.benzerlik)
        .slice(0, 10);
      let siralama = 'gomme';
      try {
        const rr = await yenidenSirala(sorgu, adaylar.map((a) => a.metin), 5);
        if (rr.length) {
          adaylar = rr.map((x) => ({ ...adaylar[x.index], alaka: x.skor }));
          siralama = 'gomme+rerank';
        }
      } catch (e) {
        console.warn('Rerank atlandi:', e.message);
      }
      res.json({ siralama, sonuclar: adaylar.slice(0, 5) });
    } catch (e) {
      hataYaniti(res, e);
    }
  });

  return r;
}
