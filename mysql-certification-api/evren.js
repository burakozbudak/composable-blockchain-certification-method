// EVREN LLM API istemcisi (https://evren.ssyz.org.tr/llm/models).
// OpenAI uyumlu gecit; ek olarak /v1/ocr ve /v1/systemone uclari var.
// EVREN_API_KEY tanimli degilse tum yapay zeka ozellikleri kapali kalir,
// panelin geri kalani (MySQL + zincir) etkilenmez.

const BASE_URL = (process.env.EVREN_BASE_URL || 'https://evren-llmapi.ssyz.org.tr/v1').replace(/\/$/, '');
const API_KEY = process.env.EVREN_API_KEY;

export const MODELLER = {
  sohbet: process.env.EVREN_CHAT_MODEL || 'glm-5.3',
  ocr: process.env.EVREN_OCR_MODEL || 'dots-ocr',
  karar: process.env.EVREN_DECISION_MODEL || 'clef',
  gomme: process.env.EVREN_EMBED_MODEL || 'qwen3-embedding-8b',
  siralama: process.env.EVREN_RERANK_MODEL || 'qwen3-reranker-8b',
};

export function evrenAktif() {
  return Boolean(API_KEY);
}

export class EvrenHatasi extends Error {
  constructor(mesaj, status, kod) {
    super(mesaj);
    this.status = status;
    this.kod = kod;
  }
}

async function istek(yol, govde, { timeoutMs = 90_000 } = {}) {
  if (!API_KEY) throw new EvrenHatasi('EVREN_API_KEY tanimli degil', 503, 'evren_kapali');
  const r = await fetch(BASE_URL + yol, {
    method: 'POST',
    headers: { Authorization: `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(govde),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const metin = await r.text();
  let veri;
  try {
    veri = JSON.parse(metin);
  } catch {
    veri = { ham: metin };
  }
  if (!r.ok) {
    const kod = veri?.error?.code || `http_${r.status}`;
    const mesaj = veri?.error?.message || metin.slice(0, 300);
    throw new EvrenHatasi(`EVREN ${yol}: ${mesaj}`, r.status, kod);
  }
  return veri;
}

// --- Sohbet (glm-5.3) -------------------------------------------------------
export async function sohbet(mesajlar, { json = false, maxTokens = 4096 } = {}) {
  const govde = {
    model: MODELLER.sohbet,
    messages: mesajlar,
    max_tokens: maxTokens,
    // Panel icin hizli yanit: dusunme modu kapali (EVREN'e ozgu parametre).
    thinking: false,
    temperature: 0.2,
  };
  if (json) govde.response_format = { type: 'json_object' };
  const veri = await istek('/chat/completions', govde);
  return veri.choices?.[0]?.message?.content?.trim() || '';
}

// --- Belge OCR (dots-ocr) ---------------------------------------------------
// Yanit seklinin farkli surumlerine dayanikli olmak icin bilinen alanlar sirayla denenir.
function ocrMetni(veri) {
  if (typeof veri === 'string') return veri;
  const adaylar = [
    veri.text,
    veri.markdown,
    veri.content,
    veri.output_text,
    veri.result?.text,
    veri.data?.text,
    veri.choices?.[0]?.message?.content,
    Array.isArray(veri.pages) ? veri.pages.map((p) => p.text || p.markdown || '').join('\n\n') : null,
    Array.isArray(veri.data) ? veri.data.map((p) => p.text || p.markdown || '').join('\n\n') : null,
  ];
  const bulunan = adaylar.find((a) => typeof a === 'string' && a.trim());
  return bulunan ? bulunan.trim() : JSON.stringify(veri).slice(0, 20_000);
}

export async function ocr(dataUrl) {
  const veri = await istek('/ocr', { model: MODELLER.ocr, image: dataUrl }, { timeoutMs: 120_000 });
  return ocrMetni(veri);
}

// --- Tipli karar (clef) -----------------------------------------------------
export async function karar(state, questions) {
  const veri = await istek('/systemone', { model: MODELLER.karar, state, questions });
  return veri.answers || {};
}

// --- Gomme ve yeniden siralama ---------------------------------------------
export async function gomme(metinler) {
  const veri = await istek('/embeddings', { model: MODELLER.gomme, input: metinler });
  return veri.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export async function yenidenSirala(sorgu, belgeler, topN = 5) {
  const veri = await istek('/rerank', {
    model: MODELLER.siralama,
    query: sorgu,
    documents: belgeler,
    top_n: topN,
  });
  return (veri.results || veri.data || []).map((r) => ({
    index: r.index,
    skor: r.relevance_score ?? r.score ?? null,
  }));
}
