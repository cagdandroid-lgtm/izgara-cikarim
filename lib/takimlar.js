'use strict';
/* İkili Mod: takım kurulumu, eşleştirme ve takım adına cevap denetimi.
   Yalnız mod === 'ikili' iken kullanılır; bireysel Yarış ve Birlikte modlarına dokunmaz. */
const { ilerleme } = require('./kontrol');

const simdi = () => Date.now();

function karistir(a) {
  const b = a.slice();
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}

class Takimlar {
  /** @param {Map} oyuncular durum.js'teki oyuncu haritasının kendisi (referans) */
  constructor(oyuncular) {
    this.oyuncular = oyuncular;
    this.liste = [];
    this.sayac = 0;
  }

  turSifirla(t) {
    t.isaretler = {};
    t.bitti = false;
    t.bitisMs = null;
    t.denemeler = 0;
    t.sonSonuc = null;
    t.sonKontrolZamani = 0;
    t.soruDeneme = 0;                 // asıl soruya kaçıncı cevap denemesi
    t.soruBaslangic = Date.now();
  }
  hepsiniSifirla() { for (const t of this.liste) this.turSifirla(t); }

  /* tur iptalinde: puanlar geri alınır, takımların bitirme durumu sıfırlanır */
  iptalSifirla() {
    for (const t of this.liste) { t.bitti = false; t.bitisMs = null; t.sonSonuc = null; }
  }

  yeni(uyeler) {
    const t = { id: 't' + (++this.sayac), uyeler: uyeler.slice() };
    this.turSifirla(t);
    return t;
  }

  bul(oyuncuId) { return this.liste.find((t) => t.uyeler.includes(oyuncuId)) || null; }

  ad(t) {
    const adlar = t.uyeler.map((id) => (this.oyuncular.get(id) || {}).ad).filter(Boolean);
    return adlar.length ? adlar.join(' & ') : 'Boş takım';
  }

  /* Rastgele ikişerli eşleştirme; tek kalan öğrenci üç kişilik takıma eklenir.
     Çevrimiçiler önce sıralanır ki eşler mümkün olduğunca iki aktif öğrenciden oluşsun. */
  kur() {
    const hepsi = [...this.oyuncular.values()];
    const sira = [
      ...karistir(hepsi.filter((o) => o.cevrimici).map((o) => o.id)),
      ...karistir(hepsi.filter((o) => !o.cevrimici).map((o) => o.id))
    ];
    this.liste = [];
    this.sayac = 0;
    for (let i = 0; i + 1 < sira.length; i += 2) this.liste.push(this.yeni([sira[i], sira[i + 1]]));
    if (sira.length % 2) {
      const kalan = sira[sira.length - 1];
      if (this.liste.length) this.liste[this.liste.length - 1].uyeler.push(kalan);
      else this.liste.push(this.yeni([kalan]));
    }
    return this.liste;
  }

  /* Ayrılanları temizler, takımsız kalanları yerleştirir (mevcut eşleşmeleri bozmadan).
     Kopup dönen öğrenci kimliği aynı kaldığı için ESKİ takımında bulunur. */
  tazele() {
    for (const t of this.liste) t.uyeler = t.uyeler.filter((id) => this.oyuncular.has(id));
    this.liste = this.liste.filter((t) => t.uyeler.length);
    for (const o of this.oyuncular.values()) {
      if (this.bul(o.id)) continue;
      const eksik = this.liste.find((t) => t.uyeler.length === 1);
      if (eksik) eksik.uyeler.push(o.id);
      else this.liste.push(this.yeni([o.id]));
    }
  }

  /* Öğretmen iki öğrenciyi elle eşler; ikisi de eski takımlarından çıkarılır */
  elleEsle(id1, id2) {
    if (id1 === id2) return { hata: 'Aynı öğrenci iki kez seçilemez.' };
    if (!this.oyuncular.get(id1) || !this.oyuncular.get(id2)) return { hata: 'Öğrenci bulunamadı.' };
    for (const t of this.liste) t.uyeler = t.uyeler.filter((id) => id !== id1 && id !== id2);
    this.liste = this.liste.filter((t) => t.uyeler.length);
    const yeni = this.yeni([id1, id2]);
    this.liste.push(yeni);
    return { takim: yeni, ad: this.ad(yeni) };
  }

  oyuncuyuCikar(id) {
    for (const t of this.liste) t.uyeler = t.uyeler.filter((uid) => uid !== id);
    this.liste = this.liste.filter((t) => t.uyeler.length);
  }

  /* Öğretmen paneli için: üyeler + canlı doluluk yüzdesi */
  ozet(bulmaca) {
    return this.liste.map((t) => {
      const ilr = bulmaca ? ilerleme(bulmaca, t.isaretler) : { yuzde: 0, kesin: 0 };
      return {
        id: t.id, ad: this.ad(t), bitti: t.bitti, denemeler: t.denemeler,
        ilerleme: ilr.yuzde, kesin: ilr.kesin, sure: t.bitisMs,
        uyeler: t.uyeler.map((id) => {
          const u = this.oyuncular.get(id);
          return u ? { id: u.id, ad: u.ad, cevrimici: u.cevrimici, puan: u.puan } : null;
        }).filter(Boolean)
      };
    });
  }
}

/**
 * İkili modda "Kontrol Et": takım adına çalışır, sonuç ve puan iki eşe birden yazılır.
 * @param {object} durum Durum örneği (podyum, puanVer, gecenMs, bulmaca alanlarını kullanır)
 */
module.exports = { Takimlar };
