'use strict';
/* Sıralama-çıkarım bulmacaları üreteci (c grubu, c-2 yapısı: Sıra + 3 kategori × 5 öğe).
   İpuçları YALNIZ karşılaştırma/olumsuzlama türündedir:
     "X, Y'den önce bitirdi" · "Z en uzun değildir" · "aralarında tam 2 kişi vardır"
   Çözüm tam bir sıralamadır. Her bulmaca kaba kuvvetle TEK ÇÖZÜMLÜ olduğu doğrulanır.

   data/uretec.js puzzles.json ve cozumler.md dosyalarını SIFIRDAN yazar; bu üreteç ise
   kendi bulmacalarını mevcut dosyalara EKLER (aynı id varsa günceller). Sıra:
     node data/uretec.js  &&  node data/siralama.js                                   */

const fs = require('fs');
const path = require('path');
const { Cozucu } = require('./anlatim');

/* ---------- Türkçe ekler ---------- */
const ARKA = 'aıouâ', ON = 'eiöü', SERT = 'pçtkfhsş';
function sonSesli(ad) {
  let v = 'a';
  for (const h of ad.toLocaleLowerCase('tr')) if (ARKA.includes(h) || ON.includes(h)) v = h;
  return v;
}
const kalin = (ad) => ARKA.includes(sonSesli(ad));
/* ayrılma hâli: -den/-dan/-ten/-tan (iyelik ekinden sonra kaynaştırma: fidesinden) */
function ablStr(ad, ozel, iyelik) {
  const son = ad.toLocaleLowerCase('tr').slice(-1);
  const d = (!iyelik && SERT.includes(son)) ? 't' : 'd';
  return ad + (ozel ? "'" : '') + (iyelik ? 'n' : '') + d + (kalin(ad) ? 'a' : 'e') + 'n';
}
/* tamlayan hâli: -in/-ın/-un/-ün (ünlüden sonra kaynaştırma: Peri'nin) */
function genStr(ad, ozel) {
  const son = ad.toLocaleLowerCase('tr').slice(-1);
  const unlu = ARKA.includes(son) || ON.includes(son);
  return ad + (ozel ? "'" : '') + (unlu ? 'n' : '') + (kalin(ad) ? 'ı' : 'i') + 'n';
}
const abl = (r) => ablStr(r.ad, r.ozel, r.iyelik);
const buyut = (c) => c.charAt(0).toLocaleUpperCase('tr') + c.slice(1);

/* ---------- cümle şablonları ---------- */
// varış sıralı temalar (yarış): birinci/sonuncu bitirme dili
const YARIS = (birim, fiil, birinci, sonuncu) => ({
  once: (A, B) => `${A.ad}, ${abl(B)} önce bitirdi.`,
  hemenOnce: (A, B) => `${A.ad} ${fiil} bitirdikten hemen sonra ${B.ad} bitirdi.`,
  arada: (A, B, k) => `${A.ad} ile ${B.ad} arasında tam ${k} ${birim} ${fiil} bitirdi.`,
  degil: (A, p, n) => (p === 0 ? `${A.ad} ${birinci}` : p === n - 1 ? `${A.ad} ${sonuncu}`
    : `${A.ad} ${fiil} ${p + 1}. bitirmedi.`)
});
// büyüklük sıralı temalar (boy/yaş): karşılaştırma dili
const SIRA = (dizilis, onek, birim, enAz, enCok, kucuk) => ({
  once: (A, B) => `${A.ad}, ${abl(B)} daha ${kucuk}.`,
  hemenOnce: (A, B) => `${dizilis} dizilince önce ${A.ad}, hemen ardından ${B.ad} gelir.`,
  arada: (A, B, k) => `${onek} ${A.ad} ile ${B.ad} arasında tam ${k} ${birim} vardır.`,
  degil: (A, p, n) => (p === 0 ? `${A.ad} ${enAz}` : p === n - 1 ? `${A.ad} ${enCok}`
    : `${dizilis} dizilince ${A.ad} ${p + 1}. sırada değildir.`)
});

const isim = (x) => ({ ad: x, ozel: true, iyelik: false });
const kalip = (son) => (x) => ({ ad: son(x), ozel: false, iyelik: false });
const kalipIyelik = (son) => (x) => ({ ad: son(x), ozel: false, iyelik: true });

/* ---------- bulmaca tanımları ----------
   cozum[k][p] = p konumundaki k kategorisinin öğe indeksi (k: Sıra hariç kategoriler) */
const TANIMLAR = [
  {
    id: 'c-2-09', tema: 'kosu', baslik: '🏃 Sınıflar Arası Koşu', tohum: 20250821,
    siraAd: 'Varış', siraOgeleri: ['1.', '2.', '3.', '4.', '5.'],
    soz: YARIS('koşucu', 'yarışı', 'yarışı birinci bitirmedi.', 'yarışı sonuncu bitirmedi.'),
    kats: [
      { ad: 'Koşucu', ogeler: ['Selin', 'Kaan', 'Melis', 'Tuna', 'Ada'], ref: isim },
      { ad: 'Forma', ogeler: ['mavi', 'sarı', 'yeşil', 'turuncu', 'mor'], ref: kalip((x) => `${x} formalı koşucu`) },
      { ad: 'Kahvaltı', ogeler: ['muz', 'simit', 'yumurta', 'peynir', 'zeytin'], ref: kalip((x) => `${x} yiyen koşucu`) }
    ],
    cozum: [[3, 0, 4, 1, 2], [2, 4, 0, 3, 1], [1, 3, 4, 0, 2]]
  },
  {
    id: 'c-2-10', tema: 'boy-sirasi', baslik: '📏 Boy Sırası', tohum: 771324,
    siraAd: 'Boy', siraOgeleri: ['1. (en kısa)', '2.', '3.', '4.', '5. (en uzun)'],
    soz: SIRA('Kısadan uzuna', 'Boy sırasında', 'öğrenci', 'en kısa değildir.', 'en uzun değildir.', 'kısadır'),
    kats: [
      { ad: 'Öğrenci', ogeler: ['Baran', 'Ceyda', 'Poyraz', 'Nehir', 'Umut'], ref: isim },
      { ad: 'Tişört', ogeler: ['beyaz', 'lacivert', 'yeşil', 'kırmızı', 'gri'], ref: kalip((x) => `${x} tişörtlü öğrenci`) },
      { ad: 'Spor', ogeler: ['basketbol', 'yüzme', 'satranç', 'voleybol', 'tenis'], ref: kalip((x) => `${x} yapan öğrenci`) }
    ],
    cozum: [[1, 4, 0, 3, 2], [3, 0, 2, 4, 1], [4, 2, 3, 1, 0]]
  },
  {
    id: 'c-2-11', tema: 'yas-sirasi', baslik: '🎂 Kuzenlerin Yaş Sırası', tohum: 4410097,
    siraAd: 'Yaş', siraOgeleri: ['1. (en küçük)', '2.', '3.', '4.', '5. (en büyük)'],
    soz: SIRA('Küçükten büyüğe', 'Yaş sırasında', 'kuzen', 'en küçük değildir.', 'en büyük değildir.', 'küçüktür'),
    kats: [
      { ad: 'Kuzen', ogeler: ['Zeynep', 'Mert', 'İpek', 'Doruk', 'Ela'], ref: isim },
      { ad: 'Hediye', ogeler: ['uçurtma', 'kitap', 'yapboz', 'kaykay', 'düdük'], ref: kalip((x) => `${x} alan kuzen`) },
      { ad: 'Meyve', ogeler: ['çilek', 'karpuz', 'kiraz', 'erik', 'incir'], ref: kalip((x) => `${x} seven kuzen`) }
    ],
    cozum: [[2, 0, 4, 1, 3], [4, 3, 1, 2, 0], [0, 2, 3, 4, 1]]
  },
  {
    id: 'c-2-12', tema: 'yuzme', baslik: '🏊 Yüzme Yarışı', tohum: 66120931,
    siraAd: 'Varış', siraOgeleri: ['1.', '2.', '3.', '4.', '5.'],
    soz: YARIS('yüzücü', 'yarışı', 'yarışı birinci bitirmedi.', 'yarışı sonuncu bitirmedi.'),
    kats: [
      { ad: 'Yüzücü', ogeler: ['Derin', 'Alp', 'Naz', 'Berk', 'Sude'], ref: isim },
      { ad: 'Bone', ogeler: ['kırmızı', 'siyah', 'turkuaz', 'pembe', 'beyaz'], ref: kalip((x) => `${x} boneli yüzücü`) },
      { ad: 'Stil', ogeler: ['kelebek', 'kurbağalama', 'serbest', 'sırtüstü', 'karışık'], ref: kalip((x) => `${x} yüzen yüzücü`) }
    ],
    cozum: [[4, 1, 3, 0, 2], [2, 3, 0, 4, 1], [3, 0, 1, 2, 4]]
  },
  {
    id: 'c-2-13', tema: 'bisiklet', baslik: '🚲 Bisiklet Turu', tohum: 3355771,
    siraAd: 'Varış', siraOgeleri: ['1.', '2.', '3.', '4.', '5.'],
    soz: YARIS('bisikletçi', 'turu', 'turu birinci bitirmedi.', 'turu sonuncu bitirmedi.'),
    kats: [
      { ad: 'Bisikletçi', ogeler: ['Kerem', 'Lale', 'Onur', 'Bilge', 'Emir'], ref: isim },
      { ad: 'Bisiklet', ogeler: ['kırmızı', 'yeşil', 'mavi', 'gümüş', 'sarı'], ref: kalip((x) => `${x} bisikletli sporcu`) },
      { ad: 'Şehir', ogeler: ['Bursa', 'İzmir', 'Rize', 'Konya', 'Mardin'], ref: kalip((x) => `${ablStr(x, true, false)} gelen bisikletçi`) }
    ],
    cozum: [[1, 3, 0, 4, 2], [0, 2, 4, 1, 3], [3, 1, 2, 0, 4]]
  },
  {
    id: 'c-2-14', tema: 'fideler', baslik: '🌱 Fide Boyları', tohum: 918273,
    siraAd: 'Boy', siraOgeleri: ['1. (en kısa)', '2.', '3.', '4.', '5. (en uzun)'],
    soz: SIRA('Kısadan uzuna', 'Boy sırasında', 'fide', 'en kısa değildir.', 'en uzun değildir.', 'kısadır'),
    kats: [
      { ad: 'Öğrenci', ogeler: ['Deren', 'Yiğit', 'Bade', 'Arda', 'Peri'], ref: (x) => ({ ad: `${genStr(x, true)} fidesi`, ozel: false, iyelik: true }) },
      { ad: 'Bitki', ogeler: ['fesleğen', 'nane', 'domates', 'lavanta', 'biber'], ref: kalipIyelik((x) => `${x} fidesi`) },
      { ad: 'Saksı', ogeler: ['mavi', 'kahverengi', 'beyaz', 'yeşil', 'turuncu'], ref: kalip((x) => `${x} saksıdaki fide`) }
    ],
    cozum: [[2, 4, 1, 3, 0], [0, 3, 4, 2, 1], [4, 1, 0, 3, 2]]
  }
];

/* ---------- ipucu havuzu + tek çözüm arayışı ---------- */
function yap(t) {
  const { kats, cozum } = t;
  const n = kats[0].ogeler.length;
  const K = kats.length;
  const S = t.soz;
  const konum = (k, i) => cozum[k].indexOf(i);
  const R = (k, i) => kats[k].ref(kats[k].ogeler[i]);

  const havuz = [];
  // ipucu: { cats (yerel indeks), test, metin, uc, coz } — coz: Cozucu'nun anladığı biçim
  const ekle = (cats, test, metin, coz, uc) => havuz.push({
    cats: [...new Set(cats)].sort(), test, metin: buyut(metin), coz, uc: uc || false
  });

  for (let a = 0; a < K; a++) for (let b = 0; b < K; b++) {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (a === b && i >= j) continue;              // aynı kategorideki çifti bir kez ele al
      const pa = konum(a, i), pb = konum(b, j);
      if (pa === pb) continue;                      // aynı satırdaki iki öğe: karşılaştırılmaz
      const A = R(a, i), B = R(b, j);
      const [onceKat, onceOge, sonraKat, sonraOge, ilk, son] = pa < pb
        ? [a, i, b, j, A, B] : [b, j, a, i, B, A];
      ekle([a, b], (p) => p(onceKat, onceOge) < p(sonraKat, sonraOge), S.once(ilk, son),
        { kind: 'once', kb: onceKat + 1, vb: onceOge, kc: sonraKat + 1, vc: sonraOge });
      if (Math.abs(pa - pb) === 1) {
        ekle([a, b], (p) => p(sonraKat, sonraOge) - p(onceKat, onceOge) === 1, S.hemenOnce(ilk, son),
          { kind: 'left', kb: onceKat + 1, vb: onceOge, kc: sonraKat + 1, vc: sonraOge });
      } else {
        const fark = Math.abs(pa - pb);
        ekle([a, b], (p) => Math.abs(p(a, i) - p(b, j)) === fark, S.arada(A, B, fark - 1),
          { kind: 'ara', kb: a + 1, vb: i, kc: b + 1, vc: j, k: fark });
      }
    }
  }
  for (let a = 0; a < K; a++) for (let i = 0; i < n; i++) {
    const A = R(a, i), pa = konum(a, i);
    for (let p0 = 0; p0 < n; p0++) {
      if (p0 === pa) continue;
      ekle([a], (p) => p(a, i) !== p0, S.degil(A, p0, n),
        { kind: 'neq', ka: 0, va: p0, kb: a + 1, vb: i }, (p0 === 0 || p0 === n - 1) ? a + ':' + i : false);
    }
  }

  const permler = [];
  (function perm(arr, kalan) {
    if (!kalan.length) return permler.push(arr.slice());
    kalan.forEach((x, i) => perm([...arr, x], kalan.filter((_, j) => j !== i)));
  })([], [...Array(n).keys()]);

  function cozumSayisi(ipuclari, sinir = 2) {
    const grup = [];
    for (let k = 0; k < K; k++) grup.push(ipuclari.filter((c) => Math.max(...c.cats) === k));
    const kon = [];
    const p = (k, i) => kon[k][i];
    let bulunan = 0;
    (function dal(k) {
      if (bulunan >= sinir) return;
      if (k === K) { bulunan++; return; }
      const yer = new Array(n);
      kon[k] = yer;
      for (const perm of permler) {
        for (let q = 0; q < n; q++) yer[perm[q]] = q;
        if (grup[k].every((c) => c.test(p))) dal(k + 1);
        if (bulunan >= sinir) return;
      }
      kon[k] = null;
    })(0);
    return bulunan;
  }

  let tohum = t.tohum;
  const rnd = () => (tohum = (tohum * 1103515245 + 12345) % 2147483648) / 2147483648;
  const sirali = havuz.slice().sort(() => rnd() - 0.5);

  // her bulmacada en az iki "uç" olumsuzu bulunsun ("... en uzun değildir")
  const secilen = [];
  for (const c of sirali) {
    if (secilen.length >= 2) break;
    if (c.uc && !secilen.some((x) => x.uc === c.uc)) secilen.push(c);
  }
  const zorunlu = secilen.length;
  for (const c of sirali) {
    if (secilen.some((x) => x.metin === c.metin)) continue;
    secilen.push(c);
    if (secilen.length >= 5 && cozumSayisi(secilen) === 1) break;
  }
  if (cozumSayisi(secilen) !== 1) throw new Error(`${t.id}: tek çözüme ulaşılamadı`);

  let budandi = secilen.slice();
  for (let degisti = true; degisti;) {
    degisti = false;
    for (let i = zorunlu; i < budandi.length; i++) {      // uç olumsuzlar korunur
      const aday = budandi.filter((_, j) => j !== i);
      if (aday.length >= 4 && cozumSayisi(aday) === 1) { budandi = aday; degisti = true; break; }
    }
  }

  const kategoriler = [
    { ad: t.siraAd, ogeler: t.siraOgeleri, sirali: true },
    ...kats.map((k) => ({ ad: k.ad, ogeler: k.ogeler, sirali: false }))
  ];
  const cozumSatirlari = [];
  for (let p0 = 0; p0 < n; p0++) {
    const satir = { [t.siraAd]: t.siraOgeleri[p0] };
    kats.forEach((k, ki) => { satir[k.ad] = k.ogeler[cozum[ki][p0]]; });
    cozumSatirlari.push(satir);
  }
  return {
    bulmaca: {
      id: t.id, grup: 'c', seviye: 'c-2', tema: t.tema, baslik: t.baslik,
      kategori: 'siralama',                       // ölçme kaydındaki "kategori" sütunu (lib/olcum.js)
      kategoriler, ipuclari: budandi.map((c) => c.metin), cozum: cozumSatirlari
    },
    clues: budandi.map((c) => c.coz),
    sol: [[...Array(n).keys()], ...cozum]     // sol[k][p] = p konumundaki öğe indeksi
  };
}

/* ---------- anlatımlı çözüm (data/anlatim.js ile) ---------- */
function anlatim(b, clues, sol) {
  const c = new Cozucu(b.kategoriler, clues, sol);
  const { adimlar, cozuldu } = c.coz();
  const tutarli = c.dogrulandiMi();
  const s = [];
  s.push(`### ${b.id} · ${b.baslik}`, '');
  s.push('**Tablolar:** ' + b.kategoriler.map((k) => `${k.ad} _(${k.ogeler.join(', ')})_`).join(' × '), '');
  s.push('**İpuçları**', '');
  b.ipuclari.forEach((cl, i) => s.push(`${i + 1}. ${cl}`));
  s.push('', '**Adım adım çözüm**', '');
  if (adimlar.length) adimlar.forEach((a, i) => s.push(`${i + 1}. ${a}`));
  else s.push('_(İpuçları tabloyu doğrudan verir; ek çıkarım gerekmez.)_');
  if (!cozuldu || !tutarli) {
    s.push('', '> ⚠️ Bu bulmaca yalnız adım adım çıkarımla sonuna kadar götürülemedi; aşağıdaki tabloyu kullanın.');
  }
  s.push('', '**Sonuç**', '');
  s.push('| ' + b.kategoriler.map((k) => k.ad).join(' | ') + ' |');
  s.push('|' + b.kategoriler.map(() => '---').join('|') + '|');
  b.cozum.forEach((r) => s.push('| ' + b.kategoriler.map((k) => r[k.ad]).join(' | ') + ' |'));
  s.push('');
  return { metin: s.join('\n'), cozuldu: cozuldu && tutarli };
}

/* ---------- dosyalara işle ---------- */
const BASLIK = '## c-2 · sıralama-çıkarım (boy / yaş / varış sırası)';
const MARKER = '<!-- siralama-bulmacalari -->';

function puzzlesYaz(yeniler) {
  const yol = path.join(__dirname, 'puzzles.json');
  const hepsi = JSON.parse(fs.readFileSync(yol, 'utf8'));
  for (const b of yeniler) {
    const i = hepsi.findIndex((x) => x.id === b.id);
    if (i >= 0) hepsi[i] = b; else hepsi.push(b);
  }
  fs.writeFileSync(yol, JSON.stringify(hepsi, null, 2), 'utf8');
  return { yol, toplam: hepsi.length };
}

function cozumlerYaz(parcalar) {
  const yol = path.join(__dirname, 'cozumler.md');
  let md = fs.readFileSync(yol, 'utf8');
  const bolum = [MARKER, '', '---', '', BASLIK, '',
    '> Bu bölümdeki bulmacalar `node data/siralama.js` ile üretilir.', '',
    ...parcalar].join('\n');
  const yer = md.indexOf(MARKER);
  if (yer >= 0) md = md.slice(0, yer).replace(/\s+$/, '\n\n') + bolum;
  else {
    // İçindekiler listesinin sonuna bir satır ekle
    const satirlar = md.split('\n');
    let sonMadde = -1;
    for (let i = 0; i < satirlar.length && i < 60; i++) if (satirlar[i].startsWith('- **')) sonMadde = i;
    if (sonMadde >= 0) {
      satirlar.splice(sonMadde + 1, 0, `- **${BASLIK.replace('## ', '')}** — ${parcalar.length} bulmaca`);
      md = satirlar.join('\n');
    }
    md = md.replace(/\s+$/, '\n\n') + bolum;
  }
  fs.writeFileSync(yol, md, 'utf8');
  return yol;
}

const uretilen = TANIMLAR.map(yap);
const parcalar = [];
let cozulemeyen = 0;
for (const u of uretilen) {
  const a = anlatim(u.bulmaca, u.clues, u.sol);
  if (!a.cozuldu) cozulemeyen++;
  parcalar.push(a.metin);
  console.log(`${u.bulmaca.id}: ${u.bulmaca.ipuclari.length} ipucu · adım adım çözüldü: ${a.cozuldu ? 'evet' : 'HAYIR'}`);
}
const { yol, toplam } = puzzlesYaz(uretilen.map((u) => u.bulmaca));
console.log(`${uretilen.length} sıralama bulmacası işlendi → ${yol} (toplam ${toplam} bulmaca)`);
console.log(`anlatımlı çözümler → ${cozumlerYaz(parcalar)}` +
  (cozulemeyen ? `  (⚠️ ${cozulemeyen} bulmaca yalnız çıkarımla bitirilemedi)` : '  (hepsi adım adım çözüldü)'));
