'use strict';
/* Socket.io olay bağlantıları. İstemciden gelen her veri burada/durum.js'te doğrulanır. */
const { Durum } = require('./durum');
const akis = require('./akis');

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

  /* Senkron + "otomatik" geçişte sonuç sahnesinden sonra sıradaki soru kendiliğinden gelir.
     "Öğretmen onaylı" modda öğretmen "Sıradaki" diyene kadar sonuç ekranı kalır. */
  let gecisZaman = null;
  function gecisiPlanla() {
    if (durum.ilerlemeMod !== 'senkron' || durum.gecis !== 'otomatik') return;
    clearTimeout(gecisZaman);
    gecisZaman = setTimeout(() => {
      if (durum.faz !== 'sonuc') return;
      const r = durum.basla(null);
      if (r.hata) { gunluk('⚠️ otomatik geçiş: ' + r.hata); return; }
      gunluk(`⏭ otomatik geçiş → ${r.bulmaca.id}`);
      io.emit('yeniTur', { bulmacaId: r.bulmaca.id });
      yayinla();
    }, akis.GECIS_MS);
  }

  function yayinla() {
    // tur kapandıysa cevap vermeyenler 'atlandi' olarak kaydedilir (ölçme standardı)
    if (durum.faz === 'sonuc') {
      const atlayan = durum.olcum.turKapat(durum);
      if (atlayan) gunluk(`📊 ${atlayan} öğrenci 'atlandi' olarak kaydedildi`);
    }
    const kamu = durum.kamu();
    for (const [socketId, sid] of sidler) {
      const s = io.sockets.sockets.get(socketId);
      if (s) s.emit('durum', { ...kamu, ben: durum.kisisel(sid) });
    }
    io.to('ogretmen').emit('durum', { ...kamu, ogretmen: durum.ogretmenEk() });
    lobiYayinla();
  }

  /* Giriş ekranı: yalnız AKTİF grubun aktif öğrencileri gider (başka grup asla).
     Öğretmen seçim yapar yapmaz bekleyen ekranlar kendiliğinden isim kartlarına döner. */
  function lobiYayinla() { io.emit('lobi', durum.lobi()); }

  setInterval(() => {
    if (durum.faz !== 'oyun') return;
    const kalan = durum.kalanSn();
    if (kalan === null) return;
    if (kalan <= 0) { durum.bitir(); gunluk('⏱ süre doldu'); yayinla(); turBittiBildir('sure'); gecisiPlanla(); return; }
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
    socket.emit('lobi', durum.lobi());

    socket.on('katil', ({ kod, sid } = {}, cb) => {
      const sonuc = durum.katil(kod, typeof sid === 'string' ? sid.slice(0, 40) : null);
      if (sonuc.hata) { if (cb) cb({ hata: sonuc.hata, baskaGrup: !!sonuc.baskaGrup }); return; }
      sidler.set(socket.id, sonuc.oyuncu.id);
      durum.olcum.kod(sonuc.oyuncu, durum.oyuncular);   // takma ad ilk girişte bağlanır
      // ikili modda oyuncu takımsızsa yerleştirilir; kopup dönen ESKİ takımına döner
      if (durum.mod === 'ikili') durum.takimlariTazele();
      odalariTazele();
      const t = durum.mod === 'ikili' ? durum.takim(sonuc.oyuncu.id) : null;
      gunluk(`👋 katıldı: ${sonuc.oyuncu.kod} ${sonuc.oyuncu.ad}${sonuc.geriDondu ? ' (geri döndü)' : ''}` +
        (t ? ` → takım ${durum.takimAdi(t)}` : ''));
      if (cb) cb({ ok: true, sid: sonuc.oyuncu.id, ad: sonuc.oyuncu.ad, kod: sonuc.oyuncu.kod });
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

    /* Bireysel modda öğrencinin kendi isteğiyle sıradaki bulmacaya geçmesi */
    socket.on('ilerle', (_, cb) => {
      const sid = sidler.get(socket.id);
      if (!sid) return;
      const r = durum.ilerle(sid);
      if (cb) cb(r);
      if (!r.hata) yayinla();
    });

    /* Tabloyu denetle — PUANSIZ yardım (kayıt tutulmaz, ceza yok) */
    socket.on('kontrol', (_, cb) => {
      const sid = sidler.get(socket.id);
      if (!sid) return;
      const r = durum.kontrol(sid);
      if (cb) cb(r.hata ? { hata: r.hata } : { tutarli: r.tutarli, catismalar: r.catismalar, isaretli: r.isaretli });
    });

    /* TAM EŞLEŞTİRME cevabı — TEK GÖNDERİM; puan, ilerleme ve ölçme kaydı burada */
    socket.on('cevap', ({ atamalar } = {}, cb) => {
      const sid = sidler.get(socket.id);
      if (!sid) return;
      const r = durum.cevap(sid, Array.isArray(atamalar) ? atamalar.map((x) => (x === null ? null : Number(x))) : null);
      if (r.hata) { if (cb) cb({ hata: r.hata, eksik: r.eksik }); return; }

      const hedefler = r.uyeler && r.uyeler.length
        ? r.uyeler.map((id) => durum.oyuncular.get(id)).filter(Boolean)
        : (durum.mod === 'birlikte' && r.dogru
          ? [...durum.oyuncular.values()].filter((p) => p.cevrimici)
          : [r.oyuncu]);
      for (const p of hedefler) {
        durum.olcum.yaz(durum, p, {
          sonuc: r.dogru ? 'dogru' : 'yanlis', sureMs: r.sureMs,
          deneme: r.deneme, tabloKullandi: p === r.oyuncu ? r.tabloKullandi : p.tabloKullandi
        });
      }
      gunluk(`🧠 gönderim: ${r.oyuncu.kod} ${r.oyuncu.ad} → ${r.dogru ? 'DOĞRU +' + r.puan : 'yanlış (0 puan)'}` +
        ` (${r.bulmaca.id}, tam eşleştirme, tablo ${r.tabloKullandi ? 'kullanıldı' : 'kullanılmadı'})`);

      if (cb) {
        // senkronda doğru eşleştirme tur bitmeden gönderilmez (bkz. lib/gorunum.js)
        const acilabilir = durum.ilerlemeMod === 'bireysel' || durum.faz === 'sonuc';
        cb({
          dogru: r.dogru, puan: r.puan, sira: r.sira,
          dogruAtama: acilabilir ? r.dogruAtama : null, gizli: !acilabilir,
          atamalar: r.atamalar,
          ilerledi: r.ilerledi, tamamlandi: r.tamamlandi, siradaki: r.siradaki
        });
      }
      if (r.oda) {
        io.to(r.oda).emit('takimSonuc', {
          dogru: r.dogru, puan: r.puan, sira: r.sira, kimden: r.oyuncu.ad,
          dogruAtama: durum.faz === 'sonuc' ? r.dogruAtama : null
        });
      }
      if (r.dogru) io.emit('kutlama', { ad: r.takimAd || r.oyuncu.ad, sira: r.sira || null, mod: durum.mod });
      yayinla();
      if (r.turBitti) { turBittiBildir('hepsi'); gecisiPlanla(); }
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
      T('t:bitir', () => { durum.bitir(); gunluk('⏹ tur bitirildi (oturum sürüyor)'); });

      /* ETKİNLİĞİ BİTİR — oturumu boşa döndürür, öğrencilerin kimliği cihazlarından silinir */
      T('t:etkinlikBitir', () => {
        clearTimeout(gecisZaman);
        const dusen = durum.etkinligiBitir();
        gunluk(`🛑 etkinlik bitirildi · ${dusen.length} öğrenci oturumdan düştü: ` +
          (dusen.map((o) => o.kod).join(', ') || '—'));
        for (const [socketId, sid] of [...sidler]) {
          const sk = io.sockets.sockets.get(socketId);
          if (sk) {
            for (const oda of sk.rooms) if (typeof oda === 'string' && oda.startsWith('takim:')) sk.leave(oda);
            if (dusen.some((o) => o.id === sid)) sk.emit('etkinlikBitti');
          }
          if (dusen.some((o) => o.id === sid)) sidler.delete(socketId);
        }
        return { ok: true, dusen: dusen.length };
      });
      T('t:sonraki', () => {
        const r = durum.sonraki();
        if (r.hata) return r;
        gunluk(`⏭ öğretmen onayıyla sıradaki soru: ${r.bulmaca.id}`);
        io.emit('yeniTur', { bulmacaId: r.bulmaca.id });
        return { ok: true, bulmacaId: r.bulmaca.id };
      });
      T('t:iptal', () => {
        const geri = durum.iptal();
        const silinen = durum.olcum.turIptal(durum.turNo);
        gunluk(`♻️ tur iptal edildi, ${geri} puan geri alındı, ${silinen} ölçüm kaydı silindi`);
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
      T('t:kilit', (v) => { durum.kilit(v.tip, v.deger); gunluk(`🔒 ${v.tip}: ${v.deger}`); });
      /* ---------- sınıf oturumu: grup yayını, isim kartları, misafir ---------- */
      T('t:etiket', (v) => {
        const e = durum.etiketAyarla(v.metin);
        gunluk(`🏷 ders etiketi: ${e || '(boş)'}`);
        return { ok: true, dersEtiketi: e };
      });
      T('t:yayinla', (v) => {
        if (v.dersEtiketi !== undefined) durum.etiketAyarla(v.dersEtiketi);
        durum.secimYapildi = true;
        gunluk(`🎬 oturum açıldı → grup ${durum.grup}` +
          (durum.dersEtiketi ? ` · ${durum.dersEtiketi}` : '') + ' · isim kartları yayınlandı');
        return { ok: true, grup: durum.grup };
      });
      T('t:serbest', (v) => {
        const o = durum.serbest(v.id);
        if (!o) return { hata: 'Oyuncu bulunamadı.' };
        odalariTazele();
        gunluk(`🔓 serbest bırakıldı: ${o.kod} ${o.ad}`);
        for (const [socketId, sid] of [...sidler]) {
          if (sid !== o.id) continue;
          const sk = io.sockets.sockets.get(socketId);
          if (sk) sk.emit('serbest');
          sidler.delete(socketId);
        }
        return { ok: true, ad: o.ad };
      });
      T('t:grubaTasi', (v) => {
        const o = durum.grubaTasi(v.id);
        if (o) gunluk(`↪️ aktif gruba taşındı: ${o.kod} ${o.ad} → ${durum.grup}`);
      });
      T('t:misafir', (v) => {
        const r = durum.liste.misafirEkle(v.ad, durum.grup);
        if (r.hata) return r;
        gunluk(`🙋 misafir eklendi: ${r.kayit.kod} ${r.kayit.isim} (grup ${durum.grup})`);
        return { ok: true, kod: r.kayit.kod, isim: r.kayit.isim };
      });

      /* ---------- öğrenci listesi yönetimi (oturum içi; kalıcılık için "Listeyi İndir") ---------- */
      T('t:listeEkle', (v) => {
        const r = durum.liste.ekle({ kod: v.kod, isim: v.isim, grup: v.grup });
        if (r.hata) return r;
        gunluk(`🧾 listeye eklendi: ${r.kayit.kod} ${r.kayit.isim}`);
        return { ok: true, kod: r.kayit.kod };
      });
      T('t:listeGuncelle', (v) => {
        const r = durum.liste.guncelle(v.kod, { isim: v.isim, grup: v.grup, aktif: v.aktif });
        if (r.hata) return r;
        durum.isimTazele(v.kod);
        gunluk(`🧾 liste güncellendi: ${r.kayit.kod} ${r.kayit.isim} (${r.kayit.aktif ? 'aktif' : 'pasif'})`);
        return { ok: true };
      });
      socket.on('t:listeIndir', (_, cb) => {
        gunluk('📥 ogrenciler.json indirildi');
        if (cb) cb({ ad: 'ogrenciler.json', icerik: durum.liste.json() });
      });

      /* ---------- ölçme ve raporlar (yalnız öğretmen) ---------- */
      socket.on('t:csv', (v, cb) => {
        const isimli = !!(v && v.isimli);
        const icerik = durum.olcum.csv({ isimli });
        gunluk(`📥 CSV dışa aktarıldı (${isimli ? 'isimli' : 'kodlu'}, ${durum.olcum.kayitlar.length} kayıt)`);
        if (cb) cb({ ad: durum.olcum.dosyaAdi(durum.grup), icerik, kayit: durum.olcum.kayitlar.length });
        yayinla();
      });
      T('t:olcumSifirla', () => {
        const n = durum.olcum.kayitlar.length;
        durum.olcum.sifirla();
        gunluk(`🧹 ölçüm verisi sıfırlandı (${n} kayıt silindi)`);
        return { silinen: n };
      });

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
