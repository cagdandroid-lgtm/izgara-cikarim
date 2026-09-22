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
const ilerleme = require('./ilerleme');

/* Puan (CLAUDE.md formülü): taban 500 + hedef süreye göre azalan hız bonusu (en çok 500)
   + ilk denemede doğruysa 100. TEK GÖNDERİM hakkı olduğu için doğru cevap daima ilk denemedir;
   yanlış gönderim puan getirmez (tahmin cezalandırılmaz ama ödüllendirilmez de). */
const CEVAP_PUAN = { taban: 500, hizMax: 500, ilkDeneme: 100 };
const GECIS_MS = 6000;          // senkron + otomatik geçişte sonuç sahnesi süresi
const EN_AZ_DUSUNME_MS = 5000;  // bu süreden hızlı gönderim kabul edilmez (rastgele tıklamayı keser)
const PAS_GEC_MS = 90000;       // bireysel: bu sürede cevap gönderemeyen öğrenciye "Pas geç" açılır
const EN_COK_DUSUNME_MS = 60000; // bireysel: üst üste yanlışlarda düşünme süresinin tavanı

/* Bireysel modda soru akışı sonsuzdur (tavansız yol); hızlı tahmin göndermek dürüst çözümden
   daha çok puan getirmesin diye üst üste her YANLIŞ gönderim bir sonraki sorudaki en az düşünme
   süresini ikiye katlar (5 → 10 → 20 → 40 → 60 sn). Doğru cevap sıfırlar. Puan cezası YOKTUR. */
function enAzDusunmeMs(durum, o) {
  if (durum.ilerlemeMod !== 'bireysel') return EN_AZ_DUSUNME_MS;
  return Math.min(EN_COK_DUSUNME_MS, EN_AZ_DUSUNME_MS * Math.pow(2, o.yanlisSeri || 0));
}

const simdi = () => Date.now();

/** Doğru eşleştirme puanı: taban + hız bonusu + ilk deneme bonusu */
function puanHesapla(sureMs, hedefSn, ilkDeneme) {
  const sureSn = Math.max(0, sureMs) / 1000;
  const oran = Math.max(0, 1 - sureSn / Math.max(1, hedefSn));
  return CEVAP_PUAN.taban + Math.round(CEVAP_PUAN.hizMax * oran) +
    (ilkDeneme === false ? 0 : CEVAP_PUAN.ilkDeneme);
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

/** Bireysel modda oyuncuya sıradaki bulmacayı verir.
    Oturum kuyruğu bitince TAVANSIZ YOL devreye girer (lib/ilerleme.js): üst katman, sonra
    karışık sonsuz tur. Yalnız grubun hiç içeriği yoksa "tamamlandı" durumuna düşülür. */
function oyuncuSoruVer(durum, o) {
  const b = ilerleme.bulmacaAl(durum, o);
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

/** ÖĞRENCİ KONTROLLÜ İLERLEME (yalnız bireysel): geri bildirim ekranı öğrenci
    "Sonraki soru ▶" diyene kadar kalır; otomatik geçiş yoktur. Senkronda REDDEDİLİR. */
function ilerle(durum, sid) {
  const o = durum.oyuncular.get(sid);
  if (!o) return { hata: 'Oyuncu bulunamadı.' };
  if (durum.ilerlemeMod !== 'bireysel') return { hata: 'Sıradaki soruyu öğretmen açar.' };
  if (durum.faz !== 'oyun' || durum.duraklatildi) return { hata: 'Şu anda ilerlenemez.' };
  if (!o.gonderildi) return { hata: 'Önce bu sorunun cevabını gönder.' };
  o.sira = (o.sira || 0) + 1;
  o.ilerlemeyeHazir = false;
  const yeni = oyuncuSoruVer(durum, o);
  return { ok: true, ilerledi: !!yeni, tamamlandi: !yeni, soruNo: o.sira + 1 };
}

/** PAS GEÇ (yalnız bireysel): bir soruda 90 sn boyunca cevap gönderemeyen öğrenci soruyu geçebilir.
    0 puan; kayda sonuc="atlandi" düşer; doğru eşleştirme gösterilir ve bulmaca "görüldü" sayılır
    (sonsuz turda tekrar gelirse de puan getirmez). Senkronda REDDEDİLİR. */
function pasGec(durum, sid) {
  const o = durum.oyuncular.get(sid);
  if (!o) return { hata: 'Oyuncu bulunamadı.' };
  if (durum.ilerlemeMod !== 'bireysel') return { hata: 'Pas geçme yalnız bireysel modda vardır.' };
  if (durum.faz !== 'oyun' || durum.duraklatildi) return { hata: 'Şu anda pas geçilemez.' };
  const b = aktifBulmaca(durum, o);
  const soru = aktifSoru(durum, o);
  if (!b || !soru) return { hata: 'Soru hazır değil.' };
  if (o.gonderildi) return { hata: 'Bu soruyu zaten gönderdin; "Sonraki soru" ile devam et.' };
  const gecen = simdi() - (o.soruBaslangic || durum.baslangic);
  if (gecen < PAS_GEC_MS) {
    return { hata: `Pas geçmek için ${Math.ceil((PAS_GEC_MS - gecen) / 1000)} sn daha dene. 💪` };
  }
  const dogruAtama = soruUreteci.dogruEslestirme(soru);
  o.gonderildi = true;
  o.bitti = true;
  o.ilerlemeyeHazir = true;
  o.soruSayisi = (o.soruSayisi || 0) + 1;              // isabet paydasına girer (doğru sayılmaz)
  if (o.cevaplananlar instanceof Set) o.cevaplananlar.add(b.id);
  o.sonGonderim = { dogru: false, pas: true, atamalar: [], dogruAtama, puan: 0, zaman: simdi() };
  return { ok: true, oyuncu: o, bulmaca: b, sureMs: gecen, dogruAtama, tabloKullandi: !!o.tabloKullandi };
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

  // (denetim 2) rastgele/çok hızlı gönderim: en az düşünme süresi dolmadan cevap alınmaz
  const gecen = simdi() - ((takim ? takim.soruBaslangic : o.soruBaslangic) || durum.baslangic);
  const enAz = enAzDusunmeMs(durum, o);
  if (gecen < enAz) {
    return { hata: `Acele etme 🙂 İpuçlarını oku; ${Math.ceil((enAz - gecen) / 1000)} sn sonra gönderebilirsin.` };
  }

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

  // (denetim 1) aynı bulmaca tekrar gelebilir (öğretmen geri atladı ya da tavansız sonsuz tur):
  // bu oturumda cevabı daha önce gösterilmiş bulmacaya puan YOK
  const tekrar = dogru && o.cevaplananlar instanceof Set && o.cevaplananlar.has(b.id);
  o.yanlisSeri = dogru ? 0 : (o.yanlisSeri || 0) + 1;              // bireysel düşünme süresi için
  if (o.cevaplananlar instanceof Set) o.cevaplananlar.add(b.id);   // yanlışta da doğru eşleştirme gösterilir
  cikti.tekrar = !!tekrar;
  if (dogru) {
    const puan = tekrar ? 0 : puanHesapla(sureMs, soru.hedefSn, true);  // tek gönderim → doğru = ilk deneme
    cikti.puan = puan;
    gonderimNotu.puan = puan;
    gonderimNotu.tekrar = !!tekrar;
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
  CEVAP_PUAN, GECIS_MS, PAS_GEC_MS, puanHesapla, soruSifirla, oyuncuSoruVer,
  aktifBulmaca, aktifSoru, kuyrukKur, cevapVer, ilerle, pasGec, denetle, rozetler
};
