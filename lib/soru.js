'use strict';
/* ASIL GÖREV üreteci: TAM EŞLEŞTİRME. Tablo bir ARAÇTIR, cevap değil.
   Öğrenci her özneye (kişi/varlık) karşılığını atar; aynı seçenek iki özneye verilemez.
   Olasılık sayısı n! olduğundan (3×3 → 6, 4×4 → 24, 5×5 → 120) tahminle geçmek pratikte imkânsızdır.
   Bulmaca içeriği ÜRETİLMEZ; yalnız var olan kategoriler/çözüm okunarak soru kurulur.
   Cümle kalıpları data/temalar.js'teki kategori fabrikalarından gelir (uretec ile aynı dil). */
const { THEMES, E_THEMES } = require('../data/temalar');

/* Hız bonusu için hedef süre (sn) — zorluk katmanına göre, öğrenciye gösterilmez. */
const HEDEF_SN = { 'e-1': 45, 'e-2': 45, 'i-1': 60, 'i-2': 90, 'c-1': 150, 'c-2': 240 };

const temaHaritasi = new Map();
for (const t of [...THEMES, ...E_THEMES]) temaHaritasi.set(t.tema, t);

/* Tohumlu, deterministik seçim: aynı bulmaca + tur → aynı soru (senkron modda şart) */
function tohumla(metin) {
  let t = 2166136261;
  for (const h of String(metin)) t = Math.imul(t ^ h.charCodeAt(0), 16777619) >>> 0;
  return () => ((t = Math.imul(t ^ (t >>> 15), 2246822507) >>> 0) / 4294967296);
}

const buyut = (c) => c.charAt(0).toLocaleUpperCase('tr') + c.slice(1);
const kucuk = (c) => c.toLocaleLowerCase('tr');

/* Tema sözlüğündeki kategori nesneleri (s/p/n cümle kalıplarıyla) */
function temaKategorileri(b) {
  const t = temaHaritasi.get(b.tema);
  if (!t) return null;
  const harita = new Map();
  try {
    for (const uret of t.kats || []) {
      const k = uret();
      if (k && k.ad) harita.set(k.ad, k);
    }
  } catch (e) { return null; }
  return { tema: t, harita };
}

/* Cevap kategorisi: kişi kategorisi (isimler) — yoksa sıralı olmayan ilk kategori */
function cevapKategorisi(b, tema) {
  if (tema && tema.tema.kisiAd) {
    const k = b.kategoriler.find((x) => x.ad === tema.tema.kisiAd);
    if (k) return k;
  }
  return b.kategoriler.find((x) => !x.sirali) || b.kategoriler[0];
}

/**
 * Tam eşleştirme görevi.
 * @returns {{metin, ozneKat, ozneler:string[], hedefKat, secenekler:string[],
 *            dogru:number[], hedefSn:number, olasilik:number}}
 */
function soruUret(bulmaca, tohum) {
  const b = bulmaca;
  const rnd = tohumla(`${b.id}#${tohum || 0}`);
  const tema = temaKategorileri(b);
  const ozneKat = cevapKategorisi(b, tema);                       // özneler: kişiler/varlıklar
  const adaylar = b.kategoriler.filter((k) => k.ad !== ozneKat.ad);
  const hedefKat = adaylar[Math.floor(rnd() * adaylar.length)] || b.kategoriler[0];

  // her öznenin doğru karşılığı (çözümden okunur, istemciye GİTMEZ)
  const dogru = ozneKat.ogeler.map((oge) => {
    const satir = b.cozum.find((r) => r[ozneKat.ad] === oge);
    return hedefKat.ogeler.indexOf(satir ? satir[hedefKat.ad] : null);
  });

  const kalip = tema && tema.harita.get(hedefKat.ad);
  let metin;
  if (kalip && typeof kalip.s === 'function') {
    // "kedi besleyen çocuk" → "Her çocuğu beslediği hayvanla eşleştir."
    metin = `Her ${kucuk(ozneKat.ad)} için doğru ${kucuk(hedefKat.ad)} hangisi?`;
  } else if (hedefKat.sirali) {
    metin = `Her ${kucuk(ozneKat.ad)} için doğru ${kucuk(hedefKat.ad)} sırası hangisi?`;
  } else {
    metin = `Her ${kucuk(ozneKat.ad)} için doğru ${kucuk(hedefKat.ad)} hangisi?`;
  }

  let olasilik = 1;
  for (let i = 2; i <= ozneKat.ogeler.length; i++) olasilik *= i;

  return {
    metin,
    ozneKat: ozneKat.ad,
    ozneler: ozneKat.ogeler.slice(),
    hedefKat: hedefKat.ad,
    secenekler: hedefKat.ogeler.slice(),
    dogru,
    olasilik,
    hedefSn: HEDEF_SN[b.seviye] || 120
  };
}

/** Öğrenciye gösterilecek doğru eşleştirme (yalnız cevap verildikten SONRA) */
function dogruEslestirme(soru) {
  if (!soru) return [];
  return soru.ozneler.map((oge, i) => ({ ozne: oge, dogru: soru.secenekler[soru.dogru[i]] }));
}

/* İstemciye giden sürüm: doğru cevap YOK */
function acik(soru) {
  if (!soru) return null;
  return {
    metin: soru.metin,
    ozneKat: soru.ozneKat, ozneler: soru.ozneler,
    hedefKat: soru.hedefKat, secenekler: soru.secenekler,
    olasilik: soru.olasilik
  };
}

module.exports = { soruUret, acik, dogruEslestirme, HEDEF_SN };
