'use strict';
/* ASIL SORU üreteci. Tablo bir ARAÇTIR, cevap değil: her bulmacadan, öğrencinin
   cevaplayacağı tek bir soru ve seçenek kartları türetilir.
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
 * @returns {{metin, secenekler:string[], dogru:number, hedefSn:number,
 *            soruKat:string, cevapKat:string, ipucu:string}}
 */
function soruUret(bulmaca, tohum) {
  const b = bulmaca;
  const rnd = tohumla(`${b.id}#${tohum || 0}`);
  const tema = temaKategorileri(b);
  const cevapKat = cevapKategorisi(b, tema);
  const adaylar = b.kategoriler.filter((k) => k.ad !== cevapKat.ad);
  const soruKat = adaylar[Math.floor(rnd() * adaylar.length)] || b.kategoriler[0];

  const satir = b.cozum[Math.floor(rnd() * b.cozum.length)];
  const oge = satir[soruKat.ad];
  const dogruOge = satir[cevapKat.ad];

  const kisiMi = !!(tema && tema.tema.kisiAd === cevapKat.ad);
  const soruSonu = kisiMi ? 'kim?' : 'hangisi?';

  let metin;
  const kalip = tema && tema.harita.get(soruKat.ad);
  if (kalip && typeof kalip.s === 'function') {
    const ifade = kalip.s(oge);
    metin = soruKat.sirali || kalip.sirali
      ? `${buyut(ifade)} ${kucuk(cevapKat.ad)} ${soruSonu}`
      : `${buyut(ifade)} ${soruSonu}`;
  } else if (soruKat.sirali) {
    metin = `${soruKat.ad} sırasında ${oge} olan ${kucuk(cevapKat.ad)} ${soruSonu}`;
  } else {
    metin = `«${soruKat.ad}: ${oge}» ile eşleşen ${kucuk(cevapKat.ad)} ${soruSonu}`;
  }

  return {
    metin,
    secenekler: cevapKat.ogeler.slice(),
    dogru: cevapKat.ogeler.indexOf(dogruOge),
    hedefSn: HEDEF_SN[b.seviye] || 120,
    soruKat: soruKat.ad,
    cevapKat: cevapKat.ad
  };
}

/* İstemciye giden sürüm: doğru cevap YOK */
function acik(soru) {
  if (!soru) return null;
  return { metin: soru.metin, secenekler: soru.secenekler, cevapKat: soru.cevapKat };
}

module.exports = { soruUret, acik, HEDEF_SN };
