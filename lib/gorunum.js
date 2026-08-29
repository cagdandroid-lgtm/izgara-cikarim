'use strict';
/* Durumun dışa açılan görünümleri. Oyun mantığı içermez; yalnız paket hazırlar.
   ÖNEMLİ: Bir oturum TEK gruba aittir — skor tablosu ve sayaçlar yalnız AKTİF
   grubun oyuncularını gösterir. Farklı gruptan giren oyuncu sahnede sayılmaz,
   yalnız öğretmen panelinde "farklı grup ⚠" işaretiyle listelenir. */
const bulmacalar = require('./bulmacalar');
const { ilerleme } = require('./kontrol');

const aktifGruptaMi = (d, o) => o.grup === d.grup;

function skorlar(d) {
  return [...d.oyuncular.values()]
    .filter((o) => aktifGruptaMi(d, o))
    .sort((a, b) => b.puan - a.puan || (a.bitisMs ?? 1e15) - (b.bitisMs ?? 1e15) || a.ad.localeCompare(b.ad, 'tr'))
    .map((o, i) => ({
      id: o.id, ad: o.ad, puan: o.puan, cevrimici: o.cevrimici,
      bitti: o.bitti, sira: i + 1
    }));
}

function kamu(d) {
  return {
    faz: d.faz, mod: d.mod, duraklatildi: d.duraklatildi,
    girisKilitli: d.girisKilitli,
    secimYapildi: d.secimYapildi,
    grup: d.grup, seviye: d.seviye, turNo: d.turNo,
    bulmaca: bulmacalar.acik(d.bulmaca),
    kalanSn: d.kalanSn(), sureSn: d.sureSn,
    skorlar: skorlar(d),
    podyum: d.podyum.map((p) => ({ ad: p.ad, sure: p.sure, sira: p.sira, puan: p.puan }))
  };
}

function kisisel(d, sid) {
  const o = d.oyuncular.get(sid);
  if (!o) return null;
  const t = d.mod === 'ikili' ? d.takim(o.id) : null;
  return {
    id: o.id, ad: o.ad, kod: o.kod, puan: o.puan, bitti: o.bitti, denemeler: o.denemeler,
    isaretler: d.isaretTablosu(o),
    sonSonuc: d.mod === 'birlikte' ? d.sonKontrol : (t ? t.sonSonuc : o.sonSonuc),
    takim: t ? {
      id: t.id, ad: d.takimAdi(t), bitti: t.bitti, denemeler: t.denemeler,
      uyeler: t.uyeler.map((id) => {
        const u = d.oyuncular.get(id);
        return u ? { id: u.id, ad: u.ad, cevrimici: u.cevrimici, ben: u.id === o.id } : null;
      }).filter(Boolean)
    } : null
  };
}

/* Giriş ekranı paketi: yalnız AKTİF grubun aktif öğrencileri (başka grup asla görünmez) */
function lobi(d) {
  return {
    secimYapildi: d.secimYapildi,
    grup: d.secimYapildi ? d.grup : null,
    girisKilitli: d.girisKilitli,
    ogrenciler: d.secimYapildi ? d.liste.lobi(d.grup, d.oyuncular) : []
  };
}

function ogretmenEk(d) {
  const oyuncular = [...d.oyuncular.values()].map((o) => {
    const ilr = d.bulmaca ? ilerleme(d.bulmaca, d.isaretTablosu(o)) : { yuzde: 0, kesin: 0 };
    const t = d.mod === 'ikili' ? d.takim(o.id) : null;
    return {
      id: o.id, ad: o.ad, kod: o.kod, grup: o.grup, misafir: !!o.misafir,
      farkliGrup: !aktifGruptaMi(d, o),
      puan: o.puan, cevrimici: o.cevrimici, bitti: o.bitti,
      denemeler: o.denemeler, ilerleme: ilr.yuzde, kesin: ilr.kesin,
      turPuani: d.turPuanlari[o.id] || 0,
      takimId: t ? t.id : null, takimAd: t ? d.takimAdi(t) : null
    };
  }).sort((a, b) => Number(a.farkliGrup) - Number(b.farkliGrup) ||
    b.puan - a.puan || a.ad.localeCompare(b.ad, 'tr'));
  return {
    oyuncular,
    sahnede: oyuncular.filter((o) => !o.farkliGrup).length,
    takimlar: d.takimOzet(),
    cozum: d.bulmaca ? d.bulmaca.cozum : null,
    olcum: d.olcum.panel(d.oyuncular),
    liste: d.liste.hepsi(),
    lobi: lobi(d),
    bulmacaListesi: bulmacalar.ozet(),
    gruplar: bulmacalar.gruplar,
    seviyeler: bulmacalar.seviyeler
  };
}

module.exports = { skorlar, kamu, kisisel, lobi, ogretmenEk };
