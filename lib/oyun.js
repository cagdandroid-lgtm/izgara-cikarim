'use strict';
/* Socket.io olay bağlantıları. İstemciden gelen her veri burada/durum.js'te doğrulanır. */
const { Durum } = require('./durum');

module.exports = function oyunuKur(io, ogretmenMi) {
  const durum = new Durum();
  const sidler = new Map();      // socket.id -> oyuncu sid

  const gunluk = (...a) => console.log(new Date().toLocaleTimeString('tr-TR'), ...a);

  /* İkili modda her takımın kendi Socket.io odası vardır: takim:<id> */
  function odalariTazele() {
    for (const [socketId, sid] of sidler) {
      const s = io.sockets.sockets.get(socketId);
      if (!s) continue;
      for (const oda of s.rooms) if (typeof oda === 'string' && oda.startsWith('takim:')) s.leave(oda);
      if (durum.mod !== 'ikili') continue;
      const t = durum.takim(sid);
      if (t) s.join(`takim:${t.id}`);
    }
  }

  /* Tur kendiliğinden bittiğinde (herkes bitirdi ya da süre doldu) öğretmene bildirim.
     Öğretmenin kendi bitirdiği/iptal ettiği turlarda bildirim gönderilmez (gürültü olmasın). */
  let bildirilenTur = 0;
  function turBittiBildir(sebep) {
    if (durum.faz !== 'sonuc' || bildirilenTur === durum.turNo) return;
    bildirilenTur = durum.turNo;
    const oyuncular = [...durum.oyuncular.values()];
    const ikili = durum.mod === 'ikili';
    io.to('ogretmen').emit('turBitti', {
      sebep,                                   // 'hepsi' | 'sure'
      mod: durum.mod,
      bulmacaId: durum.bulmaca ? durum.bulmaca.id : null,
      bitiren: ikili ? durum.takimlar.filter((t) => t.bitti).length : oyuncular.filter((o) => o.bitti).length,
      toplam: ikili ? durum.takimlar.length : oyuncular.filter((o) => o.cevrimici).length,
      podyum: durum.podyum.slice(0, 3)
    });
    gunluk(`🔔 tur bitti (${sebep}) → öğretmene bildirildi`);
  }

  function yayinla() {
    const kamu = durum.kamu();
    for (const [socketId, sid] of sidler) {
      const s = io.sockets.sockets.get(socketId);
      if (s) s.emit('durum', { ...kamu, ben: durum.kisisel(sid) });
    }
    io.to('ogretmen').emit('durum', { ...kamu, ogretmen: durum.ogretmenEk() });
  }

  setInterval(() => {
    if (durum.faz !== 'oyun') return;
    const kalan = durum.kalanSn();
    if (kalan === null) return;
    if (kalan <= 0) { durum.bitir(); gunluk('⏱ süre doldu'); yayinla(); turBittiBildir('sure'); return; }
    io.emit('saat', { kalanSn: kalan, duraklatildi: durum.duraklatildi });
  }, 1000);

  io.on('connection', (socket) => {
    const ogretmen = ogretmenMi(socket);
    if (ogretmen) {
      socket.join('ogretmen');
      socket.emit('durum', { ...durum.kamu(), ogretmen: durum.ogretmenEk() });
      gunluk('👩‍🏫 öğretmen paneli bağlandı');
    }

    /* ---------- öğrenci ---------- */
    socket.on('katil', ({ ad, sid } = {}, cb) => {
      const sonuc = durum.katil(ad, typeof sid === 'string' ? sid.slice(0, 40) : null);
      if (sonuc.hata) { if (cb) cb({ hata: sonuc.hata }); return; }
      sidler.set(socket.id, sonuc.oyuncu.id);
      // ikili modda oyuncu takımsızsa yerleştirilir; kopup dönen ESKİ takımına döner
      if (durum.mod === 'ikili') durum.takimlariTazele();
      odalariTazele();
      const t = durum.mod === 'ikili' ? durum.takim(sonuc.oyuncu.id) : null;
      gunluk(`👋 katıldı: ${sonuc.oyuncu.ad}${sonuc.geriDondu ? ' (geri döndü)' : ''}` +
        (t ? ` → takım ${durum.takimAdi(t)}` : ''));
      if (cb) cb({ ok: true, sid: sonuc.oyuncu.id, ad: sonuc.oyuncu.ad });
      yayinla();
    });

    socket.on('isaret', ({ p, c, d } = {}) => {
      const sid = sidler.get(socket.id);
      if (!sid) return;
      const sonuc = durum.isaret(sid, p, c, d);
      if (!sonuc) return;
      if (sonuc.oda) {
        // ikili: yalnız eşin ekranına düşer + öğretmen doluluk çubuğu canlı güncellenir
        io.to(sonuc.oda).emit('ortakIsaret', { p, c, d });
        const t = durum.takim(sid);
        if (t) io.to('ogretmen').emit('takimIlerleme', durum.takimOzet().find((x) => x.id === t.id));
      } else if (sonuc.ortak) {
        io.emit('ortakIsaret', { p, c, d });                 // birlikte modunda herkeste canlı
      }
    });

    socket.on('temizle', () => {
      const sid = sidler.get(socket.id);
      if (!sid) return;
      if (durum.temizle(sid)) yayinla();
    });

    socket.on('kontrol', (_, cb) => {
      const sid = sidler.get(socket.id);
      if (!sid) return;
      const r = durum.kontrol(sid);
      if (r.hata) { if (cb) cb({ hata: r.hata }); return; }
      if (r.ikili) {
        // sonuç İKİ EŞE BİRDEN gider; ack yalnızca "sonuç odaya yollandı" der
        gunluk(`✅ kontrol (takım ${r.takimAd}, ${r.oyuncu.ad}) → ${r.dogru ? 'DOĞRU' : 'eksik/hatalı'}`);
        if (cb) cb({ ikili: true });
        io.to(r.oda).emit('takimSonuc', {
          dogru: r.dogru, kesinlesen: r.kesinlesen, puan: r.puan, sira: r.sira, kimden: r.oyuncu.ad
        });
        if (r.dogru) io.emit('kutlama', { ad: r.takimAd, sira: r.sira || null, mod: 'ikili' });
        yayinla();
        turBittiBildir('hepsi');
        return;
      }
      gunluk(`✅ kontrol: ${r.oyuncu.ad} → ${r.dogru ? 'DOĞRU' : 'eksik/hatalı'}`);
      if (cb) cb({ dogru: r.dogru, kesinlesen: r.kesinlesen, puan: r.puan, sira: r.sira });
      if (r.dogru) io.emit('kutlama', { ad: r.oyuncu.ad, sira: r.sira || null, mod: durum.mod });
      yayinla();
      turBittiBildir('hepsi');
    });

    /* ---------- öğretmen ---------- */
    if (ogretmen) {
      const T = (ad, fn) => socket.on(ad, (veri, cb) => { const r = fn(veri || {}) || {}; if (cb) cb(r); yayinla(); });

      T('t:ayar', (v) => {
        durum.ayarla(v);
        odalariTazele();
        gunluk('⚙️ ayar', durum.grup, durum.seviye, durum.mod);
      });
      T('t:karistir', () => {
        if (durum.mod !== 'ikili') return { hata: 'Takımlar yalnız İkili Modda kullanılır.' };
        durum.takimKur();
        odalariTazele();
        gunluk(`🔀 takımlar yeniden kuruldu: ${durum.takimlar.length} takım`);
        io.emit('duyuru', { mesaj: 'Takımlar yeniden dağıtıldı 🔀 Eşine merhaba de!' });
        return { ok: true, takim: durum.takimlar.length };
      });
      T('t:esle', (v) => {
        if (durum.mod !== 'ikili') return { hata: 'Takımlar yalnız İkili Modda kullanılır.' };
        const r = durum.elleEsle(v.id1, v.id2);
        if (r.hata) return r;
        odalariTazele();
        gunluk(`🔗 elle eşleme: ${r.ad}`);
        return { ok: true, ad: r.ad };
      });
      T('t:basla', (v) => {
        const r = durum.basla(typeof v.bulmacaId === 'string' ? v.bulmacaId : null);
        if (r.hata) return r;
        odalariTazele();
        gunluk(`▶️ başladı: ${r.bulmaca.id} (${durum.mod}` +
          (durum.mod === 'ikili' ? `, ${durum.takimlar.length} takım` : '') + ')');
        io.emit('yeniTur', { bulmacaId: r.bulmaca.id });
        return { ok: true, bulmacaId: r.bulmaca.id };
      });
      T('t:duraklat', (v) => { durum.duraklat(!!v.deger); gunluk(v.deger ? '⏸ duraklatıldı' : '▶️ devam'); });
      T('t:bitir', () => { durum.bitir(); gunluk('⏹ tur bitirildi'); });
      T('t:iptal', () => {
        const geri = durum.iptal();
        gunluk(`♻️ tur iptal edildi, ${geri} puan geri alındı`);
        io.emit('duyuru', { mesaj: 'Öğretmen bu bulmacayı iptal etti. Puanlar geri alındı. ♻️' });
      });
      T('t:sifirla', () => { durum.sifirlaHepsi(); gunluk('🔄 oyun sıfırlandı'); });
      T('t:puan', (v) => {
        const r = durum.puanDuzelt(v.id, Number(v.delta));
        if (r) gunluk(`✏️ puan düzeltme: ${r.ad} (${r.uyeSayisi} kişi) ${v.delta > 0 ? '+' : ''}${v.delta}`);
      });
      T('t:at', (v) => {
        const o = durum.at(v.id);
        if (!o) return;
        odalariTazele();
        gunluk(`🚫 atıldı: ${o.ad}`);
        for (const [socketId, sid] of [...sidler]) {
          if (sid !== o.id) continue;
          const s = io.sockets.sockets.get(socketId);
          if (s) { s.emit('atildin'); s.disconnect(true); }
          sidler.delete(socketId);
        }
      });
      T('t:isim', (v) => { const o = durum.isimDegistir(v.id, v.ad); if (o) gunluk(`✏️ isim: ${o.ad}`); });
      T('t:kilit', (v) => { durum.kilit(v.tip, v.deger); gunluk(`🔒 ${v.tip}: ${v.deger}`); });
      T('t:duyuru', (v) => {
        const m = String(v.mesaj || '').slice(0, 200);
        if (m) io.emit('duyuru', { mesaj: m });
      });
    }

    socket.on('disconnect', () => {
      const sid = sidler.get(socket.id);
      if (!sid) return;
      sidler.delete(socket.id);
      // aynı oyuncunun başka bir sekmesi açıksa çevrimdışı işaretleme
      if (![...sidler.values()].includes(sid)) {
        const o = durum.cevrimdisi(sid);
        if (o) gunluk(`🔴 çevrimdışı: ${o.ad}`);
      }
      yayinla();
    });
  });

  return durum;
};
