'use strict';
/* Ölçme ve veri standardı (CLAUDE.md) — TÜM OYUNLARDA BİREBİR AYNI şema.
   Sütun adları ASLA değiştirilmez; oyunlar arası birleştirilebilirlik buna bağlıdır.
   Veri yalnız BELLEKTE tutulur (Render diski kalıcı değildir) — ders sonunda CSV indirilir.
   Kayıtlarda öğrencinin adı değil KODU (E-01…) yazar; isim↔kod eşlemesi yalnız panelde görünür. */

const SUTUNLAR = [
  'zaman', 'oyun', 'set_veya_paket', 'grup', 'ogrenci_kod', 'gorev_id',
  'kategori', 'chc', 'zorluk', 'sonuc', 'sure_sn', 'deneme', 'ipucu_kullanildi'
];
/* Standart 13 sütundan SONRA gelen ek sütunlar (standart adlar hiç değişmez):
   ders_etiketi · mod (bireysel/takim/birlikte) · ilerleme (senkron/bireysel) ·
   tablo_kullandi (0/1 — öğrenci ızgarayı kullandı mı; araştırma için)
   ogrenci_ad yalnız "isimli" dışa aktarımda eklenir. */
const MOD_ADI = { yaris: 'bireysel', ikili: 'takim', birlikte: 'birlikte' };
const EK_SUTUNLAR = ['ders_etiketi', 'mod', 'ilerleme', 'tablo_kullandi'];
const OYUN = 'izgara-cikarim';

/* Bulmacada kategori/chc alanı varsa o kullanılır; yoksa seviyeden türetilir. */
const SEVIYE_KATEGORI = {
  'e-1': 'dogrudan', 'e-2': 'olumsuz', 'i-1': 'olumsuz',
  'i-2': 'coklu-kategori', 'c-1': 'kosullu', 'c-2': 'konum'
};
const SEVIYE_CHC = {
  'e-1': ['Gf', 'Gsm'], 'e-2': ['Gf', 'Gsm'], 'i-1': ['Gf', 'Gsm'],
  'i-2': ['Gf', 'Gsm'], 'c-1': ['Gf', 'Gsm'], 'c-2': ['Gf', 'Gsm', 'Gv']
};
const KADEME_SIRA = ['e-1', 'e-2', 'i-1', 'i-2', 'c-1', 'c-2'];

const iki = (n) => String(n).padStart(2, '0');
const bugun = (d = new Date()) => `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;

class Olcum {
  constructor() {
    this.kayitlar = [];          // standart alanlar + _tur / _oyuncuId (CSV'ye yazılmaz)
    this.kodTablosu = new Map(); // oyuncuId -> { kod, ad }
    this.sayac = 0;
    this.sonAktarim = 0;         // en son dışa aktarımda kaç kayıt vardı
    this.kapanan = new Set();    // ölçümü kapatılmış tur numaraları
  }

  /* ---------- takma ad (pseudonym) ---------- */
  kod(oyuncu, oyuncular) {
    // Sınıf oturumu modelinde kod KALICI listeden gelir (data/ogrenciler.json, misafirlerde M-01…)
    if (oyuncu.kod) {
      this.kodTablosu.set(oyuncu.id, { kod: oyuncu.kod, ad: oyuncu.ad, misafir: !!oyuncu.misafir });
      return oyuncu.kod;
    }
    const v = this.kodTablosu.get(oyuncu.id);
    if (v) { v.ad = oyuncu.ad; return v.kod; }
    // atılıp aynı isimle dönen öğrenci (artık oyunda olmayan kayıt) eski kodunu korur
    const kucuk = oyuncu.ad.toLocaleLowerCase('tr');
    for (const [id, k] of this.kodTablosu) {
      if (oyuncular && oyuncular.has(id)) continue;
      if (k.ad.toLocaleLowerCase('tr') === kucuk) {
        this.kodTablosu.delete(id);
        this.kodTablosu.set(oyuncu.id, { kod: k.kod, ad: oyuncu.ad });
        return k.kod;
      }
    }
    const kod = 'X-' + iki(++this.sayac);      // listede olmayan oyuncu (olmaması gerekir)
    this.kodTablosu.set(oyuncu.id, { kod, ad: oyuncu.ad, misafir: false });
    return kod;
  }

  eslesme(oyuncular) {
    const out = [];
    for (const [id, k] of this.kodTablosu) {
      const o = oyuncular ? oyuncular.get(id) : null;
      out.push({ id, kod: k.kod, ad: o ? o.ad : k.ad, misafir: !!k.misafir, oyunda: !!o });
    }
    return out.sort((a, b) => a.kod.localeCompare(b.kod, 'tr'));
  }

  /* ---------- olay kaydı ---------- */
  gorevBilgisi(b) {
    return {
      set_veya_paket: b.tema || b.seviye || '—',
      gorev_id: b.id,
      kategori: b.kategori || SEVIYE_KATEGORI[b.seviye] || 'genel',
      chc: (b.chc || SEVIYE_CHC[b.seviye] || ['Gf']).join('|'),
      zorluk: b.seviye
    };
  }

  /** Tek bir cevap/görev kaydı. sonuc: 'dogru' | 'yanlis' | 'atlandi' */
  yaz(durum, oyuncu, { sonuc, sureMs, deneme, tabloKullandi }) {
    // bireysel modda her öğrenci farklı bulmacadadır: kayıt onun ETKİN bulmacasına yazılır
    const b = require('./akis').aktifBulmaca(durum, oyuncu) || durum.bulmaca;
    if (!b || !oyuncu) return null;
    const kayit = {
      zaman: new Date().toISOString(),
      oyun: OYUN,
      ...this.gorevBilgisi(b),
      grup: b.grup,
      ogrenci_kod: this.kod(oyuncu, durum.oyuncular),
      sonuc,
      ders_etiketi: durum.dersEtiketi || '',
      mod: MOD_ADI[durum.mod] || durum.mod,
      ilerleme: durum.ilerlemeMod || 'senkron',
      tablo_kullandi: tabloKullandi ? 1 : 0,
      sure_sn: Math.round(Math.max(0, sureMs || 0) / 100) / 10,
      deneme: Math.max(1, Math.trunc(deneme || 1)),
      ipucu_kullanildi: 0,          // bu oyunda ayrı bir ipucu dağıtımı yoktur
      _tur: durum.turNo,
      _oyuncuId: oyuncu.id
    };
    this.kayitlar.push(kayit);
    return kayit;
  }

  varMi(turNo, oyuncuId) {
    return this.kayitlar.some((k) => k._tur === turNo && k._oyuncuId === oyuncuId);
  }

  /** Tur kapanınca cevap vermemiş herkes 'atlandi' olarak kaydedilir (bir kez). */
  turKapat(durum) {
    if (!durum.bulmaca || this.kapanan.has(durum.turNo)) return 0;
    this.kapanan.add(durum.turNo);
    // Öğretmen sorular arasında gezinirken açılıp kapanan çok kısa turlar (kimse cevaplamadan)
    // 'atlandi' yığını üretmesin — ölçüm verisi temiz kalsın.
    const cevapVarMi = this.kayitlar.some((k) => k._tur === durum.turNo);
    if (!cevapVarMi && durum.gecenMs() < 10000) return 0;
    let n = 0;
    for (const o of durum.oyuncular.values()) {
      if (this.varMi(durum.turNo, o.id)) continue;
      this.yaz(durum, o, {
        sonuc: 'atlandi', sureMs: durum.gecenMs(),
        deneme: Math.max(1, o.soruDeneme || o.denemeler || 1), tabloKullandi: o.tabloKullandi
      });
      n++;
    }
    return n;
  }

  /** Soru iptal edilince o turun ölçüm kayıtları da silinir (hatalı/tartışmalı soru). */
  turIptal(turNo) {
    const once = this.kayitlar.length;
    this.kayitlar = this.kayitlar.filter((k) => k._tur !== turNo);
    this.kapanan.add(turNo);
    const silinen = once - this.kayitlar.length;
    if (this.sonAktarim > this.kayitlar.length) this.sonAktarim = this.kayitlar.length;
    return silinen;
  }

  sifirla() {
    this.kayitlar = [];
    this.kapanan.clear();
    this.sonAktarim = 0;
    // isim↔kod eşlemesi korunur ki aynı sınıf aynı kodlarla devam etsin
  }

  /* ---------- CSV ---------- */
  dosyaAdi(grup) { return `${OYUN}_${grup || 'genel'}_${bugun()}.csv`; }

  csv({ isimli } = {}) {
    const alanlar = isimli ? [...SUTUNLAR, ...EK_SUTUNLAR, 'ogrenci_ad'] : [...SUTUNLAR, ...EK_SUTUNLAR];
    // isimli çıktıda misafirler "(misafir)" ile işaretlenir — araştırma setine dahil edilmezler
    const adlar = new Map([...this.kodTablosu.values()].map((k) => [k.kod, k.ad + (k.misafir ? ' (misafir)' : '')]));
    const kacir = (v) => {
      const s = String(v === undefined || v === null ? '' : v);
      return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const satirlar = [alanlar.join(',')];
    for (const k of this.kayitlar) {
      const satir = alanlar.map((a) => (a === 'ogrenci_ad' ? adlar.get(k.ogrenci_kod) || '' : k[a]));
      satirlar.push(satir.map(kacir).join(','));
    }
    this.sonAktarim = this.kayitlar.length;
    return '﻿' + satirlar.join('\r\n') + '\r\n';   // BOM: Excel Türkçe karakterleri doğru okusun
  }

  /* ---------- öğrenci raporu ---------- */
  ozet(oyuncuId) {
    const kendi = this.kayitlar.filter((k) => k._oyuncuId === oyuncuId);
    const turlar = new Map();     // turNo -> { kategori, zorluk, dogru, sure, deneme }
    for (const k of kendi) {
      const t = turlar.get(k._tur) || { kategori: k.kategori, zorluk: k.zorluk, dogru: false, sure: k.sure_sn, deneme: k.deneme };
      if (k.sonuc === 'dogru') { t.dogru = true; t.sure = k.sure_sn; }
      t.deneme = Math.max(t.deneme, k.deneme);
      turlar.set(k._tur, t);
    }
    const sirali = [...turlar.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v);
    const cozulen = sirali.filter((t) => t.dogru);
    let seri = 0, enUzunSeri = 0;
    for (const t of sirali) { seri = t.dogru ? seri + 1 : 0; enUzunSeri = Math.max(enUzunSeri, seri); }
    const kategoriler = {};
    for (const t of sirali) {
      const k = kategoriler[t.kategori] || (kategoriler[t.kategori] = { toplam: 0, cozulen: 0 });
      k.toplam++;
      if (t.dogru) k.cozulen++;
    }
    for (const k of Object.values(kategoriler)) k.yuzde = Math.round((100 * k.cozulen) / k.toplam);
    const kademeler = cozulen.map((t) => KADEME_SIRA.indexOf(t.zorluk)).filter((i) => i >= 0);
    const ort = (a) => (a.length ? Math.round((a.reduce((x, y) => x + y, 0) / a.length) * 10) / 10 : 0);
    return {
      gorev: sirali.length,
      cozulen: cozulen.length,
      dogruluk: sirali.length ? Math.round((100 * cozulen.length) / sirali.length) : 0,
      ortSureSn: ort(cozulen.map((t) => t.sure)),
      ortDeneme: ort(sirali.map((t) => t.deneme)),
      enUzunSeri,
      kademe: kademeler.length ? KADEME_SIRA[Math.max(...kademeler)] : null,
      kategoriler
    };
  }

  /* Panele giden özet paket (öğrenci ekranına ASLA gitmez) */
  panel(oyuncular) {
    // Özetler, oturuma bir kez katılmış HERKES için üretilir: "Etkinliği Bitir"den sonra da
    // öğretmen raporları ve karneleri açabilsin diye (kodTablosu oturum boyunca korunur).
    const ozetler = {};
    for (const id of new Set([...oyuncular.keys(), ...this.kodTablosu.keys()])) ozetler[id] = this.ozet(id);
    return {
      kayit: this.kayitlar.length,
      aktarilmamis: Math.max(0, this.kayitlar.length - this.sonAktarim),
      kodlar: this.eslesme(oyuncular),
      ozetler,
      sutunlar: [...SUTUNLAR, ...EK_SUTUNLAR]
    };
  }
}

module.exports = { Olcum, SUTUNLAR, EK_SUTUNLAR, OYUN };
