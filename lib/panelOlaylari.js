'use strict';
/* Öğretmen paneli olayları: misafir, öğrenci listesi yönetimi, ℹ️ Etkinlik Bilgisi, ölçme/CSV.
   YALNIZ öğretmen soketlerinde kaydedilir (lib/oyun.js → ogretmenMi). Oyun akışına dokunmaz. */
const fs = require('fs');
const path = require('path');

const BILGI_DOSYASI = path.join(__dirname, '..', 'ETKINLIK_BILGI.json');

/**
 * @param socket  öğretmen soketi
 * @param T       (ad, fn) → fn(veri) sonucunu cb'ye yazar ve durumu yayınlar
 */
module.exports = function panelOlaylari(socket, T, durum, gunluk, yayinla) {
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
  /* ℹ️ Etkinlik Bilgisi — ETKINLIK_BILGI.json (yalnız öğretmen; öğrenciye asla gitmez) */
  socket.on('t:etkinlikBilgisi', (_, cb) => {
    try {
      const ham = fs.readFileSync(BILGI_DOSYASI, 'utf8');
      if (cb) cb({ ok: true, bilgi: JSON.parse(ham) });
    } catch (e) {
      if (cb) cb({ hata: 'ETKINLIK_BILGI.json okunamadı.' });
    }
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
};
