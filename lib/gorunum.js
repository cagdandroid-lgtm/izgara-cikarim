'use strict';
/* Durumun dışa açılan görünümleri. Oyun mantığı içermez; yalnız paket hazırlar.
   ÖNEMLİ: Bir oturum TEK gruba aittir — skor tablosu ve sayaçlar yalnız AKTİF
   grubun oyuncularını gösterir. Farklı gruptan giren oyuncu sahnede sayılmaz,
   yalnız öğretmen panelinde "farklı grup ⚠" işaretiyle listelenir. */
const bulmacalar = require('./bulmacalar');
const { ilerleme } = require('./kontrol');
const akis = require('./akis');
const soruUreteci = require('./soru');

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
    ilerlemeMod: d.ilerlemeMod, gecis: d.gecis, otomatikDoldur: d.otomatikDoldur,
    grup: d.grup, turNo: d.turNo,
    rozetler: d.faz === 'sonuc' ? akis.rozetler(d) : null,
    bulmaca: d.ilerlemeMod === 'bireysel' ? null : bulmacalar.acik(d.bulmaca),
    kalanSn: d.kalanSn(), sureSn: d.sureSn,
    skorlar: skorlar(d),
    toplamSoru: d.kuyruk.length,
    podyum: d.podyum.map((p) => ({ ad: p.ad, sure: p.sure, sira: p.sira, puan: p.puan }))
  };
}

function kisisel(d, sid) {
  const o = d.oyuncular.get(sid);
  if (!o) return null;
  const t = d.mod === 'ikili' ? d.takim(o.id) : null;
  const sirala = skorlar(d);
  const benimSira = (sirala.find((x) => x.id === o.id) || {}).sira || null;
  return {
    id: o.id, ad: o.ad, kod: o.kod, puan: o.puan, bitti: o.bitti, denemeler: o.denemeler,
    // kendi ilerlemesi ve sırası (tam liste öğrenciye açılmaz; herkes KENDİ sırasını görür)
    soruNo: (o.sira || 0) + 1, toplamSoru: d.kuyruk.length, tamamlandi: !!o.tamamlandi,
    siram: benimSira, oyuncuSayisi: sirala.length,
    soru: soruUreteci.acik(akis.aktifSoru(d, o)),
    bulmaca: d.ilerlemeMod === 'bireysel' ? bulmacalar.acik(akis.aktifBulmaca(d, o)) : null,
    gonderildi: d.mod === 'birlikte' ? !!d.gonderildi : !!o.gonderildi,
    ilerlemeyeHazir: !!o.ilerlemeyeHazir,
    // Doğru eşleştirme SENKRON modda ancak tur bitince açılır (erken bitiren sınıfa söylemesin);
    // bireyselde herkes başka bulmacada olduğu için hemen gösterilir.
    sonGonderim: o.sonGonderim
      ? (d.ilerlemeMod === 'bireysel' || d.faz === 'sonuc'
        ? o.sonGonderim
        : { dogru: o.sonGonderim.dogru, puan: o.sonGonderim.puan, atamalar: o.sonGonderim.atamalar, gizli: true })
      : null,
    tabloKullandi: !!o.tabloKullandi,
    dogruSayisi: o.dogruSayisi || 0, soruSayisi: o.soruSayisi || 0,
    isabet: o.dogruSayisi || 0,
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
    const kendiB = akis.aktifBulmaca(d, o);
    const ilr = kendiB ? ilerleme(kendiB, d.isaretTablosu(o)) : { yuzde: 0, kesin: 0 };
    const t = d.mod === 'ikili' ? d.takim(o.id) : null;
    return {
      id: o.id, ad: o.ad, kod: o.kod, grup: o.grup, misafir: !!o.misafir,
      farkliGrup: !aktifGruptaMi(d, o),
      puan: o.puan, cevrimici: o.cevrimici, bitti: o.bitti,
      soruNo: (o.sira || 0) + 1, soruSayisi: o.soruSayisi || 0, dogruSayisi: o.dogruSayisi || 0,
      isabet: o.dogruSayisi || 0,
      tamamlandi: !!o.tamamlandi, tabloKullandi: !!o.tabloKullandi,
      gonderildi: !!o.gonderildi,
      denemeler: o.denemeler, ilerleme: ilr.yuzde, kesin: ilr.kesin,
      turPuani: d.turPuanlari[o.id] || 0,
      takimId: t ? t.id : null, takimAd: t ? d.takimAdi(t) : null
    };
  }).sort((a, b) => Number(a.farkliGrup) - Number(b.farkliGrup) ||
    b.puan - a.puan || a.ad.localeCompare(b.ad, 'tr'));
  return {
    oyuncular,
    dersEtiketi: d.dersEtiketi,
    ilerlemeMod: d.ilerlemeMod, gecis: d.gecis, otomatikDoldur: d.otomatikDoldur,
    seviye: d.seviye,
    soru: d.soru ? { ...soruUreteci.acik(d.soru), dogruAtama: soruUreteci.dogruEslestirme(d.soru) } : null,
    kuyrukUzunluk: d.kuyruk.length,
    rozetler: akis.rozetler(d),
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
