'use strict';
/* Geçerli gruplar — TEK KAYNAK: data/gruplar.json (p, e, u).
   Geriye dönük uyumluluk: eski "i" ve "c" kodlarıyla gelen her veri (öğrenci listesi, bulmaca,
   eski cihaz hafızası) "u" olarak kabul edilir. */
const fs = require('fs');
const path = require('path');

const DOSYA = path.join(__dirname, '..', 'data', 'gruplar.json');
const ham = JSON.parse(fs.readFileSync(DOSYA, 'utf8'));

const LISTE = ham.gruplar.map((g) => ({
  kod: String(g.kod).toLowerCase(), ad: g.ad, emoji: g.emoji, renk: g.renk,
  eskiKodlar: (g.eskiKodlar || []).map((x) => String(x).toLowerCase())
}));
const GECERLI = LISTE.map((g) => g.kod);

const takmaAd = new Map();
for (const g of LISTE) {
  takmaAd.set(g.kod, g.kod);
  for (const e of g.eskiKodlar) takmaAd.set(e, g.kod);
}

/** "i" → "u", "C" → "u", "e" → "e"; tanınmayan değerde null */
function normal(grup) {
  return takmaAd.get(String(grup || '').trim().toLowerCase()) || null;
}

/** Grup kartı bilgisi (istemciye gider): { kod, ad, emoji, renk } */
function bilgi(grup) {
  const g = LISTE.find((x) => x.kod === normal(grup));
  return g ? { kod: g.kod, ad: g.ad, emoji: g.emoji, renk: g.renk } : null;
}

const hepsi = () => LISTE.map(({ kod, ad, emoji, renk, eskiKodlar }) => ({ kod, ad, emoji, renk, eskiKodlar }));

module.exports = { GECERLI, normal, bilgi, hepsi };
