'use strict';
/* Cevap denetimi DAİMA sunucuda yapılır.
   İşaret biçimi: isaretler["i-j"]["a-b"] = "y" (✔) | "n" (✖)
   i<j kategori indeksleri, a/b öğe indeksleridir. */

/* (i,j) çiftinde (a,b) hücresinin gerçek değeri: çözümde aynı satırda buluşuyorlar mı? */
function gercek(sol, i, j, a, b) {
  for (let e = 0; e < sol[i].length; e++) if (sol[i][e] === a && sol[j][e] === b) return true;
  return false;
}

function ciftler(K) {
  const out = [];
  for (let i = 0; i < K; i++) for (let j = i + 1; j < K; j++) out.push([i, j]);
  return out;
}

/* Tek bir işaretin biçimsel geçerliliği (istemciden gelen her veri doğrulanır) */
function isaretGecerli(bulmaca, p, c, d) {
  if (typeof p !== 'string' || typeof c !== 'string') return false;
  if (d !== 'y' && d !== 'n' && d !== '') return false;
  const K = bulmaca.kategoriler.length, n = bulmaca._n;
  const pm = /^(\d+)-(\d+)$/.exec(p), cm = /^(\d+)-(\d+)$/.exec(c);
  if (!pm || !cm) return false;
  const i = +pm[1], j = +pm[2], a = +cm[1], b = +cm[2];
  return i >= 0 && j > i && j < K && a >= 0 && a < n && b >= 0 && b < n;
}

function isaretUygula(isaretler, p, c, d) {
  if (!isaretler[p]) isaretler[p] = {};
  if (d === '') delete isaretler[p][c];
  else isaretler[p][c] = d;
  return isaretler;
}

/* ÇÖZÜME BAKMAYAN tutarlılık denetimi: öğrenciye yalnız kendi tablosundaki
   mantık çelişkilerini söyler (aynı satır/sütunda iki ✓, tamamı ✗ olan satır,
   üç tablo arası geçişsizlik). Cevabı sızdırmaz — sınırsız kullanılabilir. */
function tutarlilik(bulmaca, isaretler) {
  const n = bulmaca._n, K = bulmaca.kategoriler.length;
  const catis = [];
  let isaretli = 0;
  for (const [i, j] of ciftler(K)) {
    const t = isaretler[`${i}-${j}`] || {};
    const satirEvet = new Array(n).fill(0), sutunEvet = new Array(n).fill(0);
    const satirHayir = new Array(n).fill(0), sutunHayir = new Array(n).fill(0);
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const d = t[`${a}-${b}`];
      if (d === 'y' || d === 'n') isaretli++;
      if (d === 'y') { satirEvet[a]++; sutunEvet[b]++; }
      if (d === 'n') { satirHayir[a]++; sutunHayir[b]++; }
    }
    const ad = (k, x) => bulmaca.kategoriler[k].ogeler[x];
    for (let a = 0; a < n; a++) {
      if (satirEvet[a] > 1) catis.push(`${ad(i, a)} satırında birden çok ✓ var`);
      if (satirHayir[a] === n) catis.push(`${ad(i, a)} satırının tamamı ✗`);
    }
    for (let b = 0; b < n; b++) {
      if (sutunEvet[b] > 1) catis.push(`${ad(j, b)} sütununda birden çok ✓ var`);
      if (sutunHayir[b] === n) catis.push(`${ad(j, b)} sütununun tamamı ✗`);
    }
  }
  // geçişsizlik: A=B ve B=C ise A=C olmalı (üç kategorili tablolarda)
  for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) for (let k = 0; k < K; k++) {
    if (i === j || j === k || i === k) continue;
    const ab = isaretler[`${Math.min(i, j)}-${Math.max(i, j)}`] || {};
    const bc = isaretler[`${Math.min(j, k)}-${Math.max(j, k)}`] || {};
    const ac = isaretler[`${Math.min(i, k)}-${Math.max(i, k)}`] || {};
    const oku = (t, x, y, ters) => t[ters ? `${y}-${x}` : `${x}-${y}`];
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) for (let c = 0; c < n; c++) {
      if (oku(ab, a, b, i > j) !== 'y' || oku(bc, b, c, j > k) !== 'y') continue;
      if (oku(ac, a, c, i > k) === 'n') {
        catis.push(`${bulmaca.kategoriler[i].ogeler[a]} ile ${bulmaca.kategoriler[k].ogeler[c]} hem bağlı hem değil`);
      }
    }
  }
  const benzersiz = [...new Set(catis)];
  return { tutarli: benzersiz.length === 0, catismalar: benzersiz.slice(0, 4), isaretli };
}

/**
 * @returns {{dogru:boolean, kesinlesen:number[], isaretli:number, toplam:number}}
 *  kesinlesen: ilk kategorinin (satır başlıklarının) TAMAMEN doğru belirlenmiş öğe indeksleri.
 *  Hücre bazlı hiçbir bilgi sızdırılmaz.
 */
function kontrolEt(bulmaca, isaretler) {
  const sol = bulmaca._sol, n = bulmaca._n, K = bulmaca.kategoriler.length;
  const cs = ciftler(K);
  let dogru = true, isaretli = 0;
  const toplam = cs.length * n * n;

  for (const [i, j] of cs) {
    const tablo = isaretler[`${i}-${j}`] || {};
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const d = tablo[`${a}-${b}`];
      if (d === 'y' || d === 'n') isaretli++;
      const g = gercek(sol, i, j, a, b);
      if (g && d !== 'y') dogru = false;          // doğru eşleşme ✔ ile işaretlenmeli
      if (!g && d === 'y') dogru = false;         // yanlış eşleşmeye ✔ konulamaz
    }
  }

  const kesinlesen = [];
  for (let e = 0; e < n; e++) {
    const a = sol[0][e];
    let tam = true;
    for (let k = 1; k < K && tam; k++) {
      const tablo = isaretler[`0-${k}`] || {};
      let evetSayisi = 0, dogruYer = false;
      for (let b = 0; b < n; b++) {
        if (tablo[`${a}-${b}`] === 'y') { evetSayisi++; if (b === sol[k][e]) dogruYer = true; }
      }
      if (evetSayisi !== 1 || !dogruYer) tam = false;
    }
    if (tam) kesinlesen.push(a);
  }

  return { dogru, kesinlesen, isaretli, toplam };
}

/* Öğretmen paneli için ilerleme yüzdesi */
function ilerleme(bulmaca, isaretler) {
  const { isaretli, toplam, kesinlesen } = kontrolEt(bulmaca, isaretler);
  return { yuzde: toplam ? Math.round((isaretli / toplam) * 100) : 0, kesin: kesinlesen.length };
}

module.exports = {
  tutarlilik, kontrolEt, isaretGecerli, isaretUygula, ilerleme, ciftler };
