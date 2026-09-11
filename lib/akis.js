'use strict';
/* Oyun akışı: ASIL SORU, cevap değerlendirme, puanlama ve ilerleme modu.
   Tablo (ızgara) yalnız bir ARAÇTIR: puan CEVAPTAN gelir, tablodan değil.
   İlerleme modları:
     senkron  — herkes aynı soruda; geçiş "otomatik" ya da "öğretmen onaylı"
     bireysel — herkes kendi hızında; bitiren beklemez, sıradaki bulmacaya geçer */
const bulmacalar = require('./bulmacalar');
const soruUreteci = require('./soru');
const { soruUret } = soruUreteci;
const { tutarlilik } = require('./kontrol');

/* TEK GÖNDERİM: doğru tam eşleştirme = taban + hedef süreye göre azalan hız bonusu.
   Yanlış gönderim puan getirmez (tekrar hakkı yoktur, tahmin cezalandırılmaz ama ödüllendirilmez). */
const CEVAP_PUAN = { taban: 500, hizMax: 500 };
const GECIS_MS = 6000;          // senkron + otomatik geçişte sonuç sahnesi süresi

const simdi = () => Date.now();

/** Doğru eşleştirme puanı: taban + hedef süreye göre azalan hız bonusu */
function puanHesapla(sureMs, hedefSn) {
  const sureSn = Math.max(0, sureMs) / 1000;
  const oran = Math.max(0, 1 - sureSn / Math.max(1, hedefSn));
  return CEVAP_PUAN.taban + Math.round(CEVAP_PUAN.hizMax * oran);
}

/* ---------------- soru durumu ---------------- */
function soruSifirla(o) {
  o.gonderildi = false;        // TEK GÖNDERİM kilidi
  o.ilerlemeyeHazir = false;
  o.sonGonderim = null;
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

/* ---------------- cevap: TAM EŞLEŞTİRME, TEK GÖNDERİM ---------------- */
/** Gönderilen atamaların biçimsel geçerliliği (sunucu istemciye güvenmez) */
function atamalariDogrula(soru, atamalar) {
  if (!Array.isArray(atamalar) || atamalar.length !== soru.ozneler.length) {
    return { hata: 'Cevap biçimi geçersiz.' };
  }
  const eksik = [];
  const gorulen = new Set();
  for (let i = 0; i < atamalar.length; i++) {
    const v = atamalar[i];
    if (v === null || v === undefined || v === -1) { eksik.push(soru.ozneler[i]); continue; }
    if (!Number.isInteger(v) || v < 0 || v >= soru.secenekler.length) return { hata: 'Cevap biçimi geçersiz.' };
    if (gorulen.has(v)) return { hata: 'Aynı seçenek iki özneye verilemez.' };
    gorulen.add(v);
  }
  if (eksik.length) return { hata: `Şunlar için seçim yapmadın: ${eksik.join(', ')}`, eksik };
  return { ok: true };
}

/** Bireysel modda öğrenci sonucu okuduktan sonra kendi isteğiyle sıradaki bulmacaya geçer. */
function ilerle(durum, sid) {
  const o = durum.oyuncular.get(sid);
  if (!o) return { hata: 'Oyuncu bulunamadı.' };
  if (durum.ilerlemeMod !== 'bireysel') return { hata: 'Sıradaki soruyu öğretmen açar.' };
  if (!o.gonderildi) return { hata: 'Önce bu sorunun cevabını gönder.' };
  o.sira = (o.sira || 0) + 1;
  o.ilerlemeyeHazir = false;
  const yeni = oyuncuSoruVer(durum, o);
  return { ok: true, ilerledi: !!yeni, tamamlandi: !yeni, soruNo: o.sira + 1 };
}

function cevapVer(durum, sid, atamalar) {
  const o = durum.oyuncular.get(sid);
  if (!o) return { hata: 'Oyuncu bulunamadı.' };
  if (durum.faz !== 'oyun') return { hata: 'Şu anda cevap verilemez.' };
  if (durum.duraklatildi) return { hata: 'Oyun duraklatıldı. ⏸' };

  const b = aktifBulmaca(durum, o);
  const soru = aktifSoru(durum, o);
  if (!b || !soru) return { hata: 'Soru hazır değil.' };

  const takim = durum.mod === 'ikili' ? durum.takim(o.id) : null;
  if (durum.mod === 'ikili' && !takim) return { hata: 'Henüz bir takıma atanmadın. 👥' };

  // TEK GÖNDERİM kilidi — birlikte modunda sınıf, ikilide takım, diğerlerinde öğrenci bazında
  const kilitli = durum.mod === 'birlikte' ? durum.gonderildi : (takim ? takim.gonderildi : o.gonderildi);
  if (kilitli) return { hata: 'Bu soru için cevap zaten gönderildi. Tek hakkın vardı. 🔒' };

  const dogrulama = atamalariDogrula(soru, atamalar);
  if (dogrulama.hata) return { hata: dogrulama.hata, eksik: dogrulama.eksik };

  const dogru = soru.dogru.every((d, i) => atamalar[i] === d);
  const sureMs = simdi() - (takim ? (takim.soruBaslangic || durum.baslangic) : o.soruBaslangic || durum.baslangic);
  const dogruAtama = soruUreteci.dogruEslestirme(soru);

  // kilitle (her durumda: doğru da yanlış da tek gönderimdir)
  o.gonderildi = true;
  if (takim) takim.gonderildi = true;
  if (durum.mod === 'birlikte') durum.gonderildi = true;

  const cikti = {
    dogru, oyuncu: o, bulmaca: b, deneme: 1, sureMs,
    tabloKullandi: !!o.tabloKullandi, dogruAtama, atamalar: atamalar.slice()
  };
  // gönderim sonucu oyuncuda saklanır: yenilense/koptuğunda da doğru eşleştirmeyi görebilsin
  const gonderimNotu = { dogru, atamalar: atamalar.slice(), dogruAtama, puan: 0, zaman: simdi() };
  o.sonGonderim = gonderimNotu;

  const puanlananlar = [];
  if (durum.mod === 'birlikte') {
    for (const p of durum.oyuncular.values()) {
      if (!p.cevrimici) continue;
      p.gonderildi = true;
      p.bitti = true;
      p.sonGonderim = gonderimNotu;
      p.soruSayisi = (p.soruSayisi || 0) + 1;
      if (dogru) { p.dogruSayisi = (p.dogruSayisi || 0) + 1; puanlananlar.push(p); }
    }
    durum.sonKontrol = { tur: 'cevap', dogru, zaman: simdi() };
    durum.faz = 'sonuc';
    cikti.turBitti = true;
  } else if (takim) {
    takim.bitti = true;
    takim.bitisMs = sureMs;
    takim.sonSonuc = { tur: 'cevap', dogru, zaman: simdi() };
    for (const uid of takim.uyeler) {
      const u = durum.oyuncular.get(uid);
      if (!u) continue;
      u.gonderildi = true;
      u.bitti = true;
      u.sonGonderim = gonderimNotu;
      u.soruSayisi = (u.soruSayisi || 0) + 1;
      if (dogru) { u.dogruSayisi = (u.dogruSayisi || 0) + 1; puanlananlar.push(u); }
    }
    cikti.oda = `takim:${takim.id}`;
    cikti.takimAd = durum.takimAdi(takim);
    cikti.uyeler = takim.uyeler.slice();
  } else {
    o.bitti = true;
    o.bitisMs = sureMs;
    o.soruSayisi = (o.soruSayisi || 0) + 1;
    if (dogru) { o.dogruSayisi = (o.dogruSayisi || 0) + 1; puanlananlar.push(o); }
    o.sonSonuc = { tur: 'cevap', dogru, zaman: simdi() };
  }

  if (dogru) {
    const puan = puanHesapla(sureMs, soru.hedefSn);
    cikti.puan = puan;
    gonderimNotu.puan = puan;
    for (const p of puanlananlar) durum.puanVer(p, puan);
    cikti.sira = durum.podyum.length + 1;
    if (durum.ilerlemeMod === 'senkron' || durum.mod === 'birlikte') {
      durum.podyum.push({
        id: takim ? takim.id : o.id,
        ad: durum.mod === 'birlikte' ? 'Sınıf' : (cikti.takimAd || o.ad),
        sure: sureMs, puan, sira: cikti.sira
      });
    }
  } else {
    cikti.puan = 0;
  }

  if (durum.ilerlemeMod === 'bireysel') {
    // Sonuç ekranda kalsın: öğrenci doğru eşleştirmeyi okuyup "Sıradaki soru" deyince ilerler.
    o.ilerlemeyeHazir = true;
    cikti.bekliyor = true;
    cikti.siradaki = (o.sira || 0) + 2;
  } else if (durum.mod !== 'birlikte') {
    const aktif = [...durum.oyuncular.values()].filter((p) => p.cevrimici && p.grup === durum.grup);
    if (aktif.length && aktif.every((p) => p.bitti)) { durum.faz = 'sonuc'; cikti.turBitti = true; }
  }
  return cikti;
}

/* ---------------- tabloyu denetle (PUANSIZ, ÇÖZÜME BAKMAZ) ----------------
   Eski sürüm "hangi satırlar doğru" diyordu; bu, sınırsız denenince cevabı sızdıran bir
   kâhin (oracle) oluyordu. Artık yalnız TABLONUN KENDİ İÇİNDE tutarlı olup olmadığına bakılır. */
function denetle(durum, sid) {
  const o = durum.oyuncular.get(sid);
  if (!o) return { hata: 'Oyuncu bulunamadı.' };
  if (durum.faz !== 'oyun') return { hata: 'Şu anda denetlenemez.' };
  if (durum.duraklatildi) return { hata: 'Oyun duraklatıldı. ⏸' };
  const b = aktifBulmaca(durum, o);
  if (!b) return { hata: 'Bulmaca hazır değil.' };
  return { ...tutarlilik(b, durum.isaretTablosu(o)), oyuncu: o };
}

/* ---------------- kapanış rozetleri ----------------
   🏆 En Yüksek Puan · 🎯 En İsabetli (doğru gönderim / gönderilen cevap yüzdesi) */
function rozetler(durum) {
  const liste = [...durum.oyuncular.values()].filter((o) => o.grup === durum.grup && (o.soruSayisi || 0) > 0);
  if (!liste.length) return null;
  const enYuksek = liste.reduce((a, b) => (b.puan > a.puan ? b : a));
  const oran = (o) => (o.soruSayisi ? (o.dogruSayisi || 0) / o.soruSayisi : 0);
  const enIsabetli = liste.reduce((a, b) => (oran(b) > oran(a) ? b : a));
  return {
    enYuksekPuan: { ad: enYuksek.ad, kod: enYuksek.kod, puan: enYuksek.puan },
    enIsabetli: {
      ad: enIsabetli.ad, kod: enIsabetli.kod,
      yuzde: Math.round(100 * oran(enIsabetli)),
      dogru: enIsabetli.dogruSayisi || 0, toplam: enIsabetli.soruSayisi || 0
    }
  };
}

module.exports = {
  CEVAP_PUAN, GECIS_MS, puanHesapla, soruSifirla, oyuncuSoruVer,
  aktifBulmaca, aktifSoru, kuyrukKur, cevapVer, ilerle, denetle, rozetler
};
