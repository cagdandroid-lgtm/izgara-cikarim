'use strict';
/* TAVANSIZ YOL (yalnız bireysel mod) — CLAUDE.md "İlerleme ve geçiş".
   Oturum kuyruğunu bitiren öğrenci bekleme ekranında KALMAZ:
     1) grubunun bir ÜST zorluk katmanındaki bulmacaları alır (mevcut içerik; yeni içerik yazılmaz),
     2) en üst katmana varınca O KATMANIN bulmacalarından karışık, sonsuz bir tur sürer
        (önce henüz görmediği bulmacalar gelir, sonra tekrarlar). Alt katmanlar GERİ GELMEZ:
        daha küçük bulmacalar (3×3 → 6 olasılık) sonsuz turda tahmin şansını büyütürdü.
   Tekrar gelen bulmacaya puan verilmez (lib/akis.js) — sonsuz tur puan çiftliği olamaz.
   Katman bilgisi öğrenciye GİTMEZ (zorluk gizliliği); öğrenci yalnız "Soru N" görür. */
const bulmacalar = require('./bulmacalar');

const KADEME_SIRA = ['e-1', 'e-2', 'i-1', 'i-2', 'c-1', 'c-2'];

function karistir(dizi) {
  const a = dizi.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Grubun içeriği olan katmanları, zorluk sırasıyla */
function grupKatmanlari(grup) {
  const var_ = new Set(bulmacalar.liste(grup).map((b) => b.seviye));
  return KADEME_SIRA.filter((k) => var_.has(k));
}

/** Öğrencinin kişisel uzantı kuyruğuna bir sonraki parti eklenir. Eklenen yoksa false. */
function genislet(durum, o) {
  const katmanlar = grupKatmanlari(durum.grup);
  const simdiki = o.ekKademe || durum.seviye;
  const i = katmanlar.indexOf(simdiki);
  const ust = simdiki !== 'karisik' && i >= 0 ? katmanlar[i + 1] : null;

  let parti;
  if (ust) {
    parti = karistir(bulmacalar.liste(durum.grup, ust));
    o.ekKademe = ust;
  } else {
    // en üst katman: YALNIZ o katmandan karışık sonsuz tur — önce görülmemişler
    const enUst = katmanlar[katmanlar.length - 1];
    const gorulen = o.cevaplananlar instanceof Set ? o.cevaplananlar : new Set();
    const hepsi = karistir(bulmacalar.liste(durum.grup, enUst));
    parti = hepsi.filter((b) => !gorulen.has(b.id)).concat(hepsi.filter((b) => gorulen.has(b.id)));
    o.ekKademe = 'karisik';
  }
  if (!parti.length) return false;
  o.ekKuyruk = (o.ekKuyruk || []).concat(parti);
  return true;
}

/** Öğrencinin o.sira konumundaki bulmacası: önce oturum kuyruğu, sonra tavansız uzantı */
function bulmacaAl(durum, o) {
  const n = durum.kuyruk.length;
  if (o.sira < n) return durum.kuyruk[o.sira];
  const j = o.sira - n;
  let guvenlik = 0;
  while (!(o.ekKuyruk && o.ekKuyruk[j]) && guvenlik++ < 10) {
    if (!genislet(durum, o)) return null;              // grubun hiç içeriği yoksa
  }
  return (o.ekKuyruk && o.ekKuyruk[j]) || null;
}

/** Oturum yeniden başlarken tavansız durum sıfırlanır */
function sifirla(o) {
  o.ekKuyruk = [];
  o.ekKademe = null;
}

/** Öğretmen için özet: öğrenci oturum kuyruğunda mı, üst katmanda mı, karışık turda mı */
function asama(durum, o) {
  if ((o.sira || 0) < durum.kuyruk.length) return 'kuyruk';
  return o.ekKademe === 'karisik' ? 'karisik' : (o.ekKademe || 'kuyruk');
}

module.exports = { KADEME_SIRA, grupKatmanlari, genislet, bulmacaAl, sifirla, asama };
