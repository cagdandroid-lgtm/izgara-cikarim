/* Izgara Çıkarım – bulmaca üreteci.
   Rastgele çözüm üretir, doğru ipuçlarından minimal + TEK çözümlü bir küme seçer,
   data/puzzles.json dosyasını yazar. Repo'ya girmez; yalnızca içerik üretimi içindir. */
'use strict';
const fs = require('fs');
const path = require('path');
const { Cozucu } = require('./anlatim');

/* ---------- seeded rng ---------- */
let seed = 20260807;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function shuffle(a) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }
function pick(a) { return a[Math.floor(rnd() * a.length)]; }

const { nesne, isim, sira, THEMES, E_THEMES } = require('./temalar');

/* ---------- permütasyonlar ---------- */
const permCache = {};
function perms(n) {
  if (permCache[n]) return permCache[n];
  const out = [];
  const a = Array.from({ length: n }, (_, i) => i);
  (function rec(k) {
    if (k === n) { out.push(a.slice()); return; }
    for (let i = k; i < n; i++) { [a[k], a[i]] = [a[i], a[k]]; rec(k + 1); [a[k], a[i]] = [a[i], a[k]]; }
  })(0);
  permCache[n] = out;
  return out;
}

/* ---------- ipucu türleri ----------
   P: P[k][e] = e numaralı varlığın k kategorisindeki değer indeksi (P[0] = kimlik) */
function ent(P, k, v) { const col = P[k]; for (let e = 0; e < col.length; e++) if (col[e] === v) return e; return -1; }

function EQ(ka, va, kb, vb) { return { kind: 'eq', t: (P) => P[kb][ent(P, ka, va)] === vb, ka, va, kb, vb }; }
function NEQ(ka, va, kb, vb) { return { kind: 'neq', t: (P) => P[kb][ent(P, ka, va)] !== vb, ka, va, kb, vb }; }
function COND(ka, va, kb, vb, kc, vc) {
  return { kind: 'cond', t: (P) => { const e = ent(P, ka, va); return P[kb][e] === vb || P[kc][e] === vc; }, ka, va, kb, vb, kc, vc };
}
function LEFT(kb, vb, kc, vc) { return { kind: 'left', t: (P) => ent(P, kb, vb) + 1 === ent(P, kc, vc), kb, vb, kc, vc }; }
function NEXT(kb, vb, kc, vc) { return { kind: 'next', t: (P) => Math.abs(ent(P, kb, vb) - ent(P, kc, vc)) === 1, kb, vb, kc, vc }; }

function metin(cats, c) {
  const C = cats;
  switch (c.kind) {
    case 'eq': return cap(`${C[c.ka].s(C[c.ka].ogeler[c.va])} ${C[c.kb].p(C[c.kb].ogeler[c.vb])}.`);
    case 'neq': return cap(`${C[c.ka].s(C[c.ka].ogeler[c.va])} ${C[c.kb].n(C[c.kb].ogeler[c.vb])}.`);
    case 'cond': return cap(`${C[c.ka].s(C[c.ka].ogeler[c.va])} ${C[c.kb].nc(C[c.kb].ogeler[c.vb])} ${C[c.kc].p(C[c.kc].ogeler[c.vc])}.`);
    case 'left': return cap(`Soldan sağa doğru önce ${C[c.kb].s(C[c.kb].ogeler[c.vb])}, hemen ardından ${C[c.kc].s(C[c.kc].ogeler[c.vc])} gelir.`);
    case 'next': return cap(`${C[c.kb].s(C[c.kb].ogeler[c.vb])} ile ${C[c.kc].s(C[c.kc].ogeler[c.vc])} yan yanadır.`);
  }
}
function cap(s) { return s.charAt(0).toLocaleUpperCase('tr') + s.slice(1); }

/* ---------- çözüm uzayı (kod tabanlı: bellek dostu) ---------- */
function toplamKod(n, K) { return Math.pow(perms(n).length, K - 1); }
function coz(n, K, kod, P) {
  const ps = perms(n), L = ps.length;
  let c = kod;
  for (let k = 1; k < K; k++) { P[k] = ps[c % L]; c = Math.floor(c / L); }
  return P;
}
function yeniP(n, K) {
  const P = new Array(K);
  P[0] = Array.from({ length: n }, (_, i) => i);
  return P;
}
function tumKodlar(n, K) {
  const t = toplamKod(n, K), out = new Int32Array(t);
  for (let i = 0; i < t; i++) out[i] = i;
  return out;
}
function suz(kodlar, n, K, clue) {
  const P = yeniP(n, K), out = [];
  for (let i = 0; i < kodlar.length; i++) { coz(n, K, kodlar[i], P); if (clue.t(P)) out.push(kodlar[i]); }
  return Int32Array.from(out);
}
function sayCoz(n, K, clues, limit) {
  const P = yeniP(n, K), t = toplamKod(n, K);
  let c = 0;
  for (let i = 0; i < t; i++) {
    coz(n, K, i, P);
    let ok = true;
    for (const cl of clues) if (!cl.t(P)) { ok = false; break; }
    if (ok) { c++; if (c >= limit) return c; }
  }
  return c;
}

/* ---------- bulmaca kur ---------- */
function havuz(n, K, sol, opts) {
  // sol[k][e] = değer indeksi (sol[0] kimlik)
  const out = [];
  const val = (k, e) => sol[k][e];
  for (let ka = 0; ka < K; ka++) for (let kb = 0; kb < K; kb++) {
    if (ka === kb) continue;
    // e grubu: cümlenin öznesi DAİMA ilk kategoridir ("🐻 Ayı 🍯 bal sever.")
    if (opts.yalnizAnchor && ka !== 0) continue;
    for (let e = 0; e < n; e++) {
      out.push(EQ(ka, val(ka, e), kb, val(kb, e)));
      if (opts.olumsuzYok) continue;
      for (let v = 0; v < n; v++) if (v !== val(kb, e)) out.push(NEQ(ka, val(ka, e), kb, v));
    }
  }
  if (opts.cond) {
    for (let e = 0; e < n; e++) for (let kb = 1; kb < K; kb++) for (let kc = 1; kc < K; kc++) {
      if (kb === kc) continue;
      // antesedan yanlış (varlık gerçekten vb'ye sahip) → gerçek bir "ya / ya da" ipucu
      for (let vc = 0; vc < n; vc++) if (vc !== val(kc, e)) out.push(COND(0, val(0, e), kb, val(kb, e), kc, vc));
      // antesedan doğru → sonuç gerçekleşmiş olmalı
      for (let vb = 0; vb < n; vb++) if (vb !== val(kb, e)) out.push(COND(0, val(0, e), kb, vb, kc, val(kc, e)));
    }
  }
  if (opts.pos) {
    for (let e = 0; e + 1 < n; e++) for (let kb = 1; kb < K; kb++) for (let kc = 1; kc < K; kc++) {
      out.push(LEFT(kb, val(kb, e), kc, val(kc, e + 1)));
      if (kb < kc) NEXTpush(out, kb, kc, val, e);
    }
  }
  return out;
}
function NEXTpush(out, kb, kc, val, e) {
  out.push(NEXT(kb, val(kb, e), kc, val(kc, e + 1)));
  out.push(NEXT(kb, val(kb, e + 1), kc, val(kc, e)));
}

function kur(n, K, sol, opts) {
  const pool = shuffle(havuz(n, K, sol, opts));
  // tür ağırlığı: aynı gücü veren ipuçlarında çeşitliliği (olumsuz/koşullu/konum) öne al
  const agirlik = opts.agirlik || { eq: 1.18, neq: 1.0, cond: 0.88, left: 0.85, next: 0.85 };

  let secili = [];
  let kalan = tumKodlar(n, K);
  const kullanildi = new Set();
  while (kalan.length > 1 && secili.length < (opts.maks || 14)) {
    // her adımda havuzdan örnek çek, en çok eleyeni seç
    let enIyi = null, enIyiKalan = null, enIyiSkor = Infinity;
    const ornek = [];
    for (let t = 0; t < 45; t++) {
      const i = Math.floor(rnd() * pool.length);
      if (kullanildi.has(i)) continue;
      ornek.push(i);
    }
    for (const i of ornek) {
      const yeni = suz(kalan, n, K, pool[i]);
      if (yeni.length === kalan.length) { kullanildi.add(i); continue; }
      const skor = yeni.length * agirlik[pool[i].kind];
      if (skor < enIyiSkor) { enIyiSkor = skor; enIyi = i; enIyiKalan = yeni; }
    }
    if (enIyi === null) break;
    kullanildi.add(enIyi);
    secili.push(pool[enIyi]);
    kalan = enIyiKalan;
  }
  if (kalan.length !== 1) return null;

  // budama: tek geçiş, önce "ucuz" türleri (doğrudan eşitlik) atmaya çalış
  const atmaSirasi = { eq: 0, neq: 1, next: 2, left: 3, cond: 4 };
  const sira2 = secili.map((c, i) => i).sort((a, b) => atmaSirasi[secili[a].kind] - atmaSirasi[secili[b].kind]);
  const atildi = new Set();
  for (const i of sira2) {
    const dene = secili.filter((_, j) => j !== i && !atildi.has(j));
    if (sayCoz(n, K, dene, 2) === 1) atildi.add(i);
  }
  secili = secili.filter((_, j) => !atildi.has(j));
  if (opts.maksSon && secili.length > opts.maksSon) return null;

  // eksik tür kotalarını ve alt sınırı doğru (ama gereksiz) ipuçlarıyla tamamla:
  // fazladan ipuçları çözümü değiştirmez, yalnız çocuklara doğrulama kolaylığı sağlar
  const anahtar = (c) => [c.kind, c.ka, c.va, c.kb, c.vb, c.kc, c.vc].join('|');
  const varOlan = new Set(secili.map(anahtar));
  const ekle = (filtre) => {
    for (const c of shuffle(pool)) {
      if (!filtre(c) || varOlan.has(anahtar(c))) continue;
      secili.push(c); varOlan.add(anahtar(c));
      return true;
    }
    return false;
  };
  if (opts.gerekli) for (const [kind, adet] of Object.entries(opts.gerekli)) {
    let eksik = adet - secili.filter((c) => c.kind === kind).length;
    while (eksik-- > 0) if (!ekle((c) => c.kind === kind)) return null;
  }
  const tercih = opts.doldurTur || ['neq'];
  while (opts.min && secili.length < opts.min) {
    if (!ekle((c) => tercih.includes(c.kind))) return null;
  }
  if (opts.enCok) for (const [kind, adet] of Object.entries(opts.enCok)) {
    if (secili.filter((c) => c.kind === kind).length > adet) return null;
  }
  // istenen tür GERÇEKTEN gerekli olmalı: atılınca çözüm tekliği bozulmalı
  if (opts.etkinTur) for (const kind of opts.etkinTur) {
    if (sayCoz(n, K, secili.filter((c) => c.kind !== kind), 2) === 1) return null;
  }
  // fazladan ipuçları eklendikten sonra çözüm hâlâ tek olmalı (olmalı, hepsi doğru)
  if (sayCoz(n, K, secili, 2) !== 1) return null;
  return shuffle(secili);
}

/* ---------- seviye tanımları ---------- */
const SEVIYELER = [
  { seviye: 'i-1', grup: 'i', n: 3, ekKat: 1, sirali: false, opts: { min: 4, maksSon: 5, maks: 6, doldurTur: ['neq'] } },
  { seviye: 'i-2', grup: 'i', n: 3, ekKat: 2, sirali: false, opts: { min: 5, maksSon: 7, maks: 8, doldurTur: ['neq'] } },
  { seviye: 'c-1', grup: 'c', n: 4, ekKat: 2, sirali: false, opts: { cond: true, min: 6, maksSon: 10, maks: 12, gerekli: { neq: 2, cond: 1 }, doldurTur: ['neq','cond'] } },
  { seviye: 'c-2', grup: 'c', n: 5, ekKat: 2, sirali: true, opts: { cond: true, pos: true, min: 8, maksSon: 14, maks: 16, gerekli: { left: 1, neq: 2 }, doldurTur: ['neq','next','cond'] } },
  // e grubu en SONA eklenir: böylece rastgele sayı akışı bozulmaz ve
  // mevcut i/c bulmacaları birebir aynı kalır.
  { seviye: 'e-1', grup: 'e', n: 3, ekKat: 1, sirali: false, temalar: 'e', turleriYaz: true,
    opts: { yalnizAnchor: true, olumsuzYok: true, min: 3, maksSon: 4, maks: 4, doldurTur: ['eq'] } },
  { seviye: 'e-2', grup: 'e', n: 3, ekKat: 1, sirali: false, temalar: 'e', turleriYaz: true,
    // Tek olumsuz ipucunun işe yaraması için doğrudan ipucu sayısı 1'de kalmalı:
    // 3×3'te iki doğrudan ipucu tabloyu tek başına çözer, olumsuz ipucu süs olurdu.
    opts: { yalnizAnchor: true, min: 2, maksSon: 3, maks: 4,
            agirlik: { eq: 1.0, neq: 0.75 },   // eşit güçte ise olumsuzu yeğle → gerçek bir eleme adımı
            gerekli: { neq: 1 }, enCok: { neq: 1 }, etkinTur: ['neq'], doldurTur: ['eq'] } }
];

const ADET = 8;
const puzzles = [];
const anlatimlar = [];
let sayac = 0;
let cozulemeyen = 0;

/* Bir bulmacanın anlatımlı çözümünü Markdown parçası olarak üretir */
function anlatimYaz(id, S, th, cats, clues, sol, cozum) {
  const c = new Cozucu(cats, clues, sol);
  const { adimlar, cozuldu } = c.coz();
  const tutarli = c.dogrulandiMi();
  if (!cozuldu || !tutarli) cozulemeyen++;

  const satirlar = [];
  satirlar.push(`### ${id} · ${th.emoji} ${th.baslik}`);
  satirlar.push('');
  satirlar.push(`**Tablolar:** ` + cats.map((k) => `${k.ad} _(${k.ogeler.join(', ')})_`).join(' × '));
  satirlar.push('');
  satirlar.push('**İpuçları**');
  satirlar.push('');
  clues.forEach((cl, i) => satirlar.push(`${i + 1}. ${metin(cats, cl)}`));
  satirlar.push('');
  satirlar.push('**Adım adım çözüm**');
  satirlar.push('');
  if (adimlar.length) adimlar.forEach((a, i) => satirlar.push(`${i + 1}. ${a}`));
  else satirlar.push('_(İpuçları tabloyu doğrudan verir; ek çıkarım gerekmez.)_');
  if (!cozuldu || !tutarli) {
    satirlar.push('');
    satirlar.push('> ⚠️ Bu bulmaca yalnız adım adım çıkarımla sonuna kadar götürülemedi; aşağıdaki tabloyu kullanın.');
  }
  satirlar.push('');
  satirlar.push('**Sonuç**');
  satirlar.push('');
  satirlar.push('| ' + cats.map((k) => k.ad).join(' | ') + ' |');
  satirlar.push('|' + cats.map(() => '---').join('|') + '|');
  cozum.forEach((r) => satirlar.push('| ' + cats.map((k) => r[k.ad]).join(' | ') + ' |'));
  satirlar.push('');
  return { seviye: S.seviye, metin: satirlar.join('\n') };
}

for (const S of SEVIYELER) {
  let uretilen = 0, deneme = 0;
  while (uretilen < ADET && deneme < 400) {
    deneme++;
    const temaHavuzu = S.temalar === 'e' ? E_THEMES : THEMES;
    const th = temaHavuzu[uretilen % temaHavuzu.length];
    const n = S.n;
    // kategorileri kur
    const kisiler = shuffle(th.kisi).slice(0, n);
    const ekler = shuffle(th.kats).slice(0, S.ekKat).map((f) => {
      const c = f();
      return Object.assign({}, c, { ogeler: shuffle(c.ogeler).slice(0, n) });
    });
    const cats = S.sirali
      ? [sira(n), isim(th.kisiAd, kisiler), ...ekler]
      : [isim(th.kisiAd, kisiler), ...ekler];
    const K = cats.length;
    // rastgele çözüm
    const sol = [Array.from({ length: n }, (_, i) => i)];
    for (let k = 1; k < K; k++) sol.push(shuffle(Array.from({ length: n }, (_, i) => i)));

    const clues = kur(n, K, sol, S.opts);
    if (!clues) continue;

    const cozum = [];
    for (let e = 0; e < n; e++) {
      const rec = {};
      for (let k = 0; k < K; k++) rec[cats[k].ad] = cats[k].ogeler[sol[k][e]];
      cozum.push(rec);
    }
    sayac++;
    const id = `${S.seviye}-${String(uretilen + 1).padStart(2, '0')}`;
    anlatimlar.push(anlatimYaz(id, S, th, cats, clues, sol, cozum));
    puzzles.push({
      id,
      grup: S.grup,
      seviye: S.seviye,
      tema: th.tema,
      baslik: `${th.emoji} ${th.baslik}`,
      kategoriler: cats.map((c) => ({ ad: c.ad, ogeler: c.ogeler, sirali: !!c.sirali })),
      ipuclari: clues.map((c) => metin(cats, c)),
      // e grubunda arayüz olumsuz ipuçlarına 🚫 simgesi koyar
      ...(S.turleriYaz ? { ipucuTurleri: clues.map((c) => (c.kind === 'neq' ? 'olumsuz' : 'dogrudan')) } : {}),
      cozum
    });
    uretilen++;
  }
  console.log(`${S.seviye}: ${uretilen} bulmaca (${deneme} deneme)`);
}

const hedef = path.join(__dirname, 'puzzles.json');
fs.writeFileSync(hedef, JSON.stringify(puzzles, null, 2), 'utf8');
console.log(`toplam ${puzzles.length} bulmaca → ${hedef}`);

/* ---------- anlatımlı çözümler ---------- */
const SEVIYE_BASLIK = {
  'e-1': 'e-1 · 1.–2. sınıf, tamamen doğrudan ipuçları',
  'e-2': 'e-2 · 1.–2. sınıf, tek olumsuz ipucu',
  'i-1': 'i-1 · tek tablo, 3×3',
  'i-2': 'i-2 · çift kategori, 3×3',
  'c-1': 'c-1 · 4×4, olumsuz ve koşullu ipuçları',
  'c-2': 'c-2 · 5×5 Einstein klasiği'
};
const md = [];
md.push('# 🔑 Izgara Çıkarım — Anlatımlı Çözümler');
md.push('');
md.push('> **Bu dosya öğretmen içindir, öğrencilerle paylaşılmaz.**');
md.push('> Sunucu bu dosyayı hiçbir zaman istemciye servis etmez; yalnız depoda/diskte durur.');
md.push('');
md.push('Her bulmaca, öğrencinin tabloda izleyeceği sırayla çözülmüştür:');
md.push('ipucunu uygula → satır/sütunda kalan tek seçeneği işaretle → köprü kategori üzerinden ele.');
md.push('Bazı zor bulmacalarda “deneyelim → çelişki” adımı kullanılır; bu da sınıfta gösterilebilecek geçerli bir yöntemdir.');
md.push('');
md.push('Bulmacayı **id** ile arayın (örn. `c-1-03`); id öğretmen panelinin sağ üstünde ve “Bulmaca ve Çözüm” bölümünde yazar.');
md.push('');
md.push('## İçindekiler');
md.push('');
for (const s of Object.keys(SEVIYE_BASLIK)) {
  const kayitlar = anlatimlar.filter((a) => a.seviye === s);
  if (kayitlar.length) md.push(`- **${SEVIYE_BASLIK[s]}** — ${kayitlar.length} bulmaca`);
}
md.push('');
for (const s of Object.keys(SEVIYE_BASLIK)) {
  const kayitlar = anlatimlar.filter((a) => a.seviye === s);
  if (!kayitlar.length) continue;
  md.push('---');
  md.push('');
  md.push(`## ${SEVIYE_BASLIK[s]}`);
  md.push('');
  kayitlar.forEach((k) => { md.push(k.metin); });
}
const hedefMd = path.join(__dirname, 'cozumler.md');
fs.writeFileSync(hedefMd, md.join('\n'), 'utf8');
console.log(`anlatımlı çözümler → ${hedefMd}` +
  (cozulemeyen ? `  (⚠️ ${cozulemeyen} bulmaca yalnız çıkarımla bitirilemedi)` : '  (hepsi adım adım çözüldü)'));
