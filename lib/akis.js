'use strict';
/* Oyun akışı: ASIL SORU, cevap değerlendirme, puanlama ve ilerleme modu.
   Tablo (ızgara) yalnız bir ARAÇTIR: puan CEVAPTAN gelir, tablodan değil.
   İlerleme modları:
     senkron  — herkes aynı soruda; geçiş "otomatik" ya da "öğretmen onaylı"
     bireysel — herkes kendi hızında; bitiren beklemez, sıradaki bulmacaya geçer */
const bulmacalar = require('./bulmacalar');
const { soruUret } = require('./soru');
const { kontrolEt } = require('./kontrol');

const CEVAP_PUAN = { taban: 500, hizMax: 500, ilkDeneme: 100 };
const GECIS_MS = 6000;          // senkron + otomatik geçişte sonuç sahnesi süresi

const simdi = () => Date.now();

/** Doğru cevap puanı: taban + hedef süreye göre azalan hız bonusu + ilk deneme bonusu */
function puanHesapla(sureMs, hedefSn, ilkDeneme) {
  const sureSn = Math.max(0, sureMs) / 1000;
  const oran = Math.max(0, 1 - sureSn / Math.max(1, hedefSn));
  const hiz = Math.round(CEVAP_PUAN.hizMax * oran);
  return CEVAP_PUAN.taban + hiz + (ilkDeneme ? CEVAP_PUAN.ilkDeneme : 0);
}

/* ---------------- soru durumu ---------------- */
function soruSifirla(o) {
  o.soruDeneme = 0;
  o.soruBaslangic = simdi();
  o.tabloKullandi = false;
  o.bitti = false;
  o.sonSonuc = null;
  o.isaretler = {};
}

/** Bireysel modda oyuncuya sıradaki bulmacayı verir. */
function oyuncuSoruVer(durum, o) {
  const b = durum.kuyruk[o.sira];
  if (!b) { o.tamamlandi = true; o.bulmacaId = null; o.soru = null; o.bitti = true; return null; }
  o.bulmacaId = b.id;
  o.soru = soruUret(b, durum.turNo * 100 + o.sira);
  soruSifirla(o);
  return b;
}

const aktifBulmaca = (durum, o) =>
  (durum.ilerlemeMod === 'bireysel' ? (o && o.bulmacaId ? bulmacalar.bul(o.bulmacaId) : null) : durum.bulmaca);
const aktifSoru = (durum, o) =>
  (durum.ilerlemeMod === 'bireysel' ? (o ? o.soru : null) : durum.soru);

/** Oturum kuyruğu: bu grup/seviyedeki bulmacalar (bireysel modda sırayla verilir) */
function kuyrukKur(durum) {
  const havuz = bulmacalar.liste(durum.grup, durum.seviye).slice();
  for (let i = havuz.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [havuz[i], havuz[j]] = [havuz[j], havuz[i]];
  }
  durum.kuyruk = havuz;
  return havuz;
}

/* ---------------- cevap ---------------- */
/**
 * @returns {{hata?:string, dogru?:boolean, puan?:number, sira?:number, dogruIndeks?:number,
 *            oyuncu?:object, bulmaca?:object, deneme?:number, tabloKullandi?:boolean,
 *            sureMs?:number, ilerledi?:boolean, tamamlandi?:boolean, turBitti?:boolean,
 *            oda?:string, takimAd?:string, uyeler?:string[]}}
 */
function cevapVer(durum, sid, secim) {
  const o = durum.oyuncular.get(sid);
  if (!o) return { hata: 'Oyuncu bulunamadı.' };
  if (durum.faz !== 'oyun') return { hata: 'Şu anda cevap verilemez.' };
  if (durum.duraklatildi) return { hata: 'Oyun duraklatıldı. ⏸' };

  const b = aktifBulmaca(durum, o);
  const soru = aktifSoru(durum, o);
  if (!b || !soru) return { hata: 'Soru hazır değil.' };

  const takim = durum.mod === 'ikili' ? durum.takim(o.id) : null;
  if (durum.mod === 'ikili' && !takim) return { hata: 'Henüz bir takıma atanmadın. 👥' };
  if (takim && takim.bitti) return { hata: 'Takımınız bu soruyu cevapladı. 🎉' };
  if (!takim && o.bitti) return { hata: 'Bu soruyu cevapladın. 🎉' };
  if (!Number.isInteger(secim) || secim < 0 || secim >= soru.secenekler.length) {
    return { hata: 'Geçersiz seçim.' };
  }

  const dogru = secim === soru.dogru;
  const sureMs = simdi() - (takim ? (takim.soruBaslangic || durum.baslangic) : o.soruBaslangic || durum.baslangic);
  const sahip = takim || o;
  sahip.soruDeneme = (sahip.soruDeneme || 0) + 1;
  const ilkDeneme = sahip.soruDeneme === 1;
  o.tabloKullandi = !!o.tabloKullandi;

  const cikti = {
    dogru, oyuncu: o, bulmaca: b, deneme: sahip.soruDeneme, sureMs,
    tabloKullandi: !!o.tabloKullandi, dogruIndeks: dogru ? soru.dogru : undefined
  };

  if (!dogru) {
    o.sonSonuc = { tur: 'cevap', dogru: false, zaman: simdi() };
    if (takim) takim.sonSonuc = o.sonSonuc;
    return cikti;
  }

  const puan = puanHesapla(sureMs, soru.hedefSn, ilkDeneme);
  cikti.puan = puan;
  cikti.dogruIndeks = soru.dogru;

  if (durum.mod === 'birlikte') {
    // sınıf birlikte cevaplar: puan çevrimiçi herkese yazılır, tur biter
    for (const p of durum.oyuncular.values()) {
      if (!p.cevrimici) continue;
      durum.puanVer(p, puan);
      p.bitti = true;
      p.soruSayisi = (p.soruSayisi || 0) + 1;
      p.dogruSayisi = (p.dogruSayisi || 0) + 1;
      if (ilkDeneme) p.ilkDenemeDogru = (p.ilkDenemeDogru || 0) + 1;
    }
    durum.sonKontrol = { tur: 'cevap', dogru: true, zaman: simdi() };
    durum.podyum.push({ id: o.id, ad: 'Sınıf', sure: sureMs, puan, sira: 1 });
    durum.faz = 'sonuc';
    cikti.turBitti = true;
    return cikti;
  }

  if (takim) {
    takim.bitti = true;
    takim.bitisMs = sureMs;
    takim.sonSonuc = { tur: 'cevap', dogru: true, zaman: simdi() };
    for (const uid of takim.uyeler) {
      const u = durum.oyuncular.get(uid);
      if (!u) continue;
      durum.puanVer(u, puan);
      u.bitti = true;
      u.soruSayisi = (u.soruSayisi || 0) + 1;
      u.dogruSayisi = (u.dogruSayisi || 0) + 1;
      if (ilkDeneme) u.ilkDenemeDogru = (u.ilkDenemeDogru || 0) + 1;
    }
    cikti.sira = durum.podyum.length + 1;
    durum.podyum.push({ id: takim.id, ad: durum.takimAdi(takim), sure: sureMs, puan, sira: cikti.sira });
    cikti.oda = `takim:${takim.id}`;
    cikti.takimAd = durum.takimAdi(takim);
    cikti.uyeler = takim.uyeler.slice();
  } else {
    durum.puanVer(o, puan);
    o.bitti = true;
    o.bitisMs = sureMs;
    o.soruSayisi = (o.soruSayisi || 0) + 1;
    o.dogruSayisi = (o.dogruSayisi || 0) + 1;
    if (ilkDeneme) o.ilkDenemeDogru = (o.ilkDenemeDogru || 0) + 1;
    o.sonSonuc = { tur: 'cevap', dogru: true, puan, zaman: simdi() };
    cikti.sira = durum.podyum.length + 1;
    if (durum.ilerlemeMod === 'senkron') {
      durum.podyum.push({ id: o.id, ad: o.ad, sure: sureMs, puan, sira: cikti.sira });
    }
  }

  if (durum.ilerlemeMod === 'bireysel') {
    // bitiren BEKLEMEZ: sıradaki bulmacaya hemen geçer
    o.sira = (o.sira || 0) + 1;
    const yeni = oyuncuSoruVer(durum, o);
    cikti.ilerledi = !!yeni;
    cikti.tamamlandi = !yeni;
    cikti.siradaki = o.sira + 1;
  } else {
    const aktif = [...durum.oyuncular.values()].filter((p) => p.cevrimici && p.grup === durum.grup);
    if (aktif.length && aktif.every((p) => p.bitti)) { durum.faz = 'sonuc'; cikti.turBitti = true; }
  }
  return cikti;
}

/* ---------------- tabloyu denetle (PUANSIZ yardım) ---------------- */
function denetle(durum, sid) {
  const o = durum.oyuncular.get(sid);
  if (!o) return { hata: 'Oyuncu bulunamadı.' };
  if (durum.faz !== 'oyun') return { hata: 'Şu anda denetlenemez.' };
  if (durum.duraklatildi) return { hata: 'Oyun duraklatıldı. ⏸' };
  const b = aktifBulmaca(durum, o);
  if (!b) return { hata: 'Bulmaca hazır değil.' };
  const sonuc = kontrolEt(b, durum.isaretTablosu(o));
  return { dogru: sonuc.dogru, kesinlesen: sonuc.kesinlesen, oyuncu: o };
}

/* ---------------- kapanış rozetleri ----------------
   🏆 En Yüksek Puan · 🎯 En İsabetli (İLK DENEMEDE doğru bilme yüzdesi) */
function rozetler(durum) {
  const liste = [...durum.oyuncular.values()].filter((o) => o.grup === durum.grup && (o.soruSayisi || 0) > 0);
  if (!liste.length) return null;
  const enYuksek = liste.reduce((a, b) => (b.puan > a.puan ? b : a));
  const oran = (o) => (o.soruSayisi ? (o.ilkDenemeDogru || 0) / o.soruSayisi : 0);
  const enIsabetli = liste.reduce((a, b) => (oran(b) > oran(a) ? b : a));
  return {
    enYuksekPuan: { ad: enYuksek.ad, kod: enYuksek.kod, puan: enYuksek.puan },
    enIsabetli: {
      ad: enIsabetli.ad, kod: enIsabetli.kod,
      yuzde: Math.round(100 * oran(enIsabetli)),
      dogru: enIsabetli.ilkDenemeDogru || 0, toplam: enIsabetli.soruSayisi || 0
    }
  };
}

module.exports = {
  CEVAP_PUAN, GECIS_MS, puanHesapla, soruSifirla, oyuncuSoruVer,
  aktifBulmaca, aktifSoru, kuyrukKur, cevapVer, denetle, rozetler
};
