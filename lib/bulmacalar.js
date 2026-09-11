'use strict';
/* data/puzzles.json okunur, doğrulanır ve indekslenir.
   Çözüm (cozum) yalnızca sunucuda kalır; istemciye giden sürüm ondan arındırılır. */
const fs = require('fs');
const path = require('path');

const DOSYA = path.join(__dirname, '..', 'data', 'puzzles.json');

function dogrula(b, i) {
  const hata = (m) => { throw new Error(`puzzles.json[${i}] (${b && b.id}): ${m}`); };
  if (!b.id || !b.grup || !b.seviye) hata('id/grup/seviye eksik');
  if (!Array.isArray(b.kategoriler) || b.kategoriler.length < 2) hata('en az 2 kategori gerekir');
  const n = b.kategoriler[0].ogeler.length;
  for (const k of b.kategoriler) {
    if (!k.ad || !Array.isArray(k.ogeler)) hata('kategori biçimi bozuk');
    if (k.ogeler.length !== n) hata('tüm kategoriler aynı sayıda öğe içermeli');
  }
  if (!Array.isArray(b.ipuclari) || !b.ipuclari.length) hata('ipuclari boş');
  if (b.ipucuTurleri && b.ipucuTurleri.length !== b.ipuclari.length) hata('ipucuTurleri ipuclari ile aynı uzunlukta olmalı');
  if (!Array.isArray(b.cozum) || b.cozum.length !== n) hata('cozum satır sayısı hatalı');
  for (const satir of b.cozum) {
    for (const k of b.kategoriler) {
      if (k.ogeler.indexOf(satir[k.ad]) < 0) hata(`cozum içinde tanımsız öğe: ${k.ad}=${satir[k.ad]}`);
    }
  }
  return n;
}

/* sol[k][e] = e numaralı çözüm satırının k kategorisindeki öğe indeksi */
function indeksle(b, n) {
  const sol = b.kategoriler.map(() => new Array(n));
  b.cozum.forEach((satir, e) => {
    b.kategoriler.forEach((k, ki) => { sol[ki][e] = k.ogeler.indexOf(satir[k.ad]); });
  });
  return sol;
}

const hepsi = JSON.parse(fs.readFileSync(DOSYA, 'utf8'));
hepsi.forEach((b, i) => {
  const n = dogrula(b, i);
  Object.defineProperty(b, '_sol', { value: indeksle(b, n), enumerable: false });
  Object.defineProperty(b, '_n', { value: n, enumerable: false });
});

/* istemciye giden sürüm: çözüm YOK */
function acik(b) {
  if (!b) return null;
  // ZORLUK GİZLİLİĞİ: seviye/zorluk alanı öğrenci paketine KONMAZ (CLAUDE.md)
  return {
    id: b.id, grup: b.grup, tema: b.tema, baslik: b.baslik,
    kategoriler: b.kategoriler, ipuclari: b.ipuclari, ipucuTurleri: b.ipucuTurleri || null, n: b._n
  };
}

const seviyeler = [...new Set(hepsi.map((b) => b.seviye))].sort();
const gruplar = [...new Set(hepsi.map((b) => b.grup))].sort();

module.exports = {
  hepsi,
  gruplar,
  seviyeler,
  acik,
  bul: (id) => hepsi.find((b) => b.id === id) || null,
  liste: (grup, seviye) => hepsi.filter((b) => (!grup || b.grup === grup) && (!seviye || b.seviye === seviye)),
  ozet: () => hepsi.map((b) => ({ id: b.id, grup: b.grup, seviye: b.seviye, baslik: b.baslik }))
};
