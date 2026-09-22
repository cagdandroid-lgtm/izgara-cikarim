'use strict';
/* OTURUM YAŞAM DÖNGÜSÜ ve AKIŞ (CLAUDE.md "Oturum yaşam döngüsü" + "İlerleme ve geçiş").

   Durum makinesi:  BOŞTA ──(grup + etkinlik yayınla)──► LOBİ ──(Başlat)──► OYUN ⇄ ARA ──► SONUÇ
                      ▲                                                                    │
                      └──────────────────── ⏹ Etkinliği Bitir ─────────────────────────────┘

   Grup/etkinlik seçimi yalnız BOŞTA ve LOBİ'de yapılır; oyun başlayınca kilitlenir ve
   değiştirmenin TEK yolu "Etkinliği Bitir"dir. Burada oyun MEKANİĞİ yoktur, yalnız oturum akışı;
   cevap/puan lib/akis.js'te, görünümler lib/gorunum.js'tedir. */
const bulmacalar = require('./bulmacalar');
const gruplar = require('./gruplar');
const akis = require('./akis');
const soruUreteci = require('./soru');
const ilerleme = require('./ilerleme');

const simdi = () => Date.now();

/* Ders etiketi: kayıtlara ve karne/rapor başlığına yazılır. Serbest metindir. */
function etiketAyarla(d, metin) {
  d.dersEtiketi = String(metin || '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return d.dersEtiketi;
}

function ayarla(d, { grup, seviye, mod, sureSn, dersEtiketi, ilerlemeMod, gecis, otomatikDoldur }) {
  if (dersEtiketi !== undefined) d.etiketAyarla(dersEtiketi);
  // tur SÜRERKEN ilerleme modu değişimi oyuncuları görevsiz bırakabilir: sonraki tura ertelenir
  if ((ilerlemeMod === 'senkron' || ilerlemeMod === 'bireysel') && ilerlemeMod !== d.ilerlemeMod) {
    if (d.faz === 'oyun') d.bekleyenIlerlemeMod = ilerlemeMod;
    else d.ilerlemeMod = ilerlemeMod;
  }
  if (gecis === 'otomatik' || gecis === 'onayli') d.gecis = gecis;
  if (otomatikDoldur !== undefined) d.otomatikDoldur = !!otomatikDoldur;
  // öğretmenin ilk grup/etkinlik seçimi bekleme ekranlarını isim kartlarına çevirir
  if ((grup || seviye) && d.faz === 'lobi') d.secimYapildi = true;
  // Grup ve etkinlik YALNIZ boşta/lobide değişir. Tur başladıysa değişmez:
  // tek yol "Etkinliği Bitir"dir (oturum boşa döner).
  const secilebilir = d.faz === 'lobi';
  if (secilebilir) {
    grup = grup ? gruplar.normal(grup) : grup;              // eski "i"/"c" → "u"
    if (grup && bulmacalar.gruplar.includes(grup)) d.grup = grup;
    if (seviye && bulmacalar.seviyeler.includes(seviye)) d.seviye = seviye;
  }
  if (mod === 'yaris' || mod === 'birlikte' || mod === 'ikili') d.mod = mod;
  // bireysel ilerlemede herkes kendi bulmacasındadır; ortak/ikili tablo anlamsızdır
  if (d.ilerlemeMod === 'bireysel') d.mod = 'yaris';
  // ikiliye geçildiğinde takım yoksa hemen kur (öğrenciler takımsız kalmasın)
  if (d.mod === 'ikili' && !d.takimlar.length && d.oyuncular.size) d.takimKur();
  if (Number.isFinite(sureSn) && sureSn >= 0 && sureSn <= 3600) d.sureSn = Math.floor(sureSn);
}

function basla(d, bulmacaId) {
  d.secimYapildi = true;
  if (d.bekleyenIlerlemeMod) {          // tur sırasında istenen mod değişimi şimdi uygulanır
    d.ilerlemeMod = d.bekleyenIlerlemeMod;
    d.bekleyenIlerlemeMod = null;
    if (d.ilerlemeMod === 'bireysel') d.mod = 'yaris';
  }
  const b0 = bulmacaId ? bulmacalar.bul(bulmacaId) : null;
  if (b0 && b0.grup !== d.grup) {
    return { hata: 'Bu bulmaca yayınlanan grubun değil. Grubu değiştirmek için önce etkinliği bitirin.' };
  }
  // Oturum kuyruğu bir kez kurulur; senkronda "önceki/sonraki/şu soruya atla" bunun üstünde çalışır
  if (!d.kuyruk.length || d.kuyruk[0].grup !== d.grup || d.kuyruk[0].seviye !== d.seviye) {
    akis.kuyrukKur(d);
    d.soruIndeksi = 0;
  }
  if (!d.kuyruk.length) return { hata: 'Bu grup/seviye için bulmaca yok.' };
  if (b0) {
    const i = d.kuyruk.findIndex((x) => x.id === b0.id);
    d.soruIndeksi = i >= 0 ? i : 0;
  }
  const b = d.kuyruk[d.soruIndeksi] || d.kuyruk[0];
  d.turSifirla();
  // ikili modda ilk başlatışta takımlar kurulur, sonrakilerde eşleşmeler korunur
  if (d.mod === 'ikili') {
    if (!d.takimlar.length) d.takimKur();
    else d.takimlariTazele();
  }
  d.grup = b.grup;
  d.seviye = b.seviye;
  d.turNo++;
  d.faz = 'oyun';
  d.baslangic = simdi();

  if (d.ilerlemeMod === 'bireysel') {
    // herkes kendi hızında: kuyruğun başından başlar, bitiren beklemeden sıradakine geçer
    d.soruIndeksi = 0;
    d.bulmaca = d.kuyruk[0];
    d.oynanan.add(d.kuyruk[0].id);
    for (const o of d.oyuncular.values()) {
      o.sira = 0;
      o.tamamlandi = false;
      ilerleme.sifirla(o);                    // tavansız yol uzantısı temizlenir
      o.yanlisSeri = 0;
      akis.oyuncuSoruVer(d, o);
    }
    d.soru = null;
  } else {
    d.bulmaca = b;
    d.oynanan.add(b.id);
    d.soru = soruUreteci.soruUret(b, d.turNo);
    for (const o of d.oyuncular.values()) akis.soruSifirla(o);
  }
  return { bulmaca: b };
}

function duraklat(d, deger) {
  if (d.faz !== 'oyun') return;
  if (deger && !d.duraklatildi) {
    d.duraklatildi = true;
    d.duraklamaBaslangic = simdi();
  } else if (!deger && d.duraklatildi) {
    d.duraklatildi = false;
    d.duraklananMs += simdi() - d.duraklamaBaslangic;
    d.duraklamaBaslangic = 0;
  }
}

/* Turu Bitir: YALNIZ bu turu kapatır. Oturum, grup ve öğrenciler yerinde kalır. */
function bitir(d) { if (d.faz === 'oyun') d.faz = 'sonuc'; }

/* Etkinliği Bitir: oturumu BOŞTA durumuna döndürür.
   Tur durur, öğrenciler oturumdan düşer (cihazlarındaki kimlik temizlenir) ve
   öğretmen yeni grup yayınlayana kadar bekleme ekranında kalırlar.
   Ölçüm kayıtları ve isim↔kod eşlemesi KORUNUR (raporlar/karneler çalışmayı sürdürür). */
function etkinligiBitir(d) {
  const dusen = [...d.oyuncular.values()].map((o) => ({ id: o.id, kod: o.kod, ad: o.ad }));
  if (d.faz === 'oyun' && d.bulmaca) d.olcum.turKapat(d);   // cevapsızlar 'atlandi'
  d.turSifirla();
  d.oyuncular.clear();
  d.tk.liste = [];
  d.secimYapildi = false;
  d.gonderildi = false;
  d.kuyruk = [];
  d.soruIndeksi = 0;
  d.oynanan.clear();
  return dusen;
}

/* SORU ATLAMA (yalnız senkron): önceki · sonraki · belirli bir soruya.
   Bireysel modda herkes kendi sırasında olduğu için bu kontrol kapalıdır. */
function soruAtla(d, hedef) {
  if (d.ilerlemeMod !== 'senkron') {
    return { hata: 'Soru atlama yalnız senkron modda kullanılır.' };
  }
  if (!d.kuyruk.length) return { hata: 'Önce etkinliği başlatın.' };
  let i = d.soruIndeksi;
  if (hedef === 'onceki') i -= 1;
  else if (hedef === 'sonraki') i += 1;
  else if (Number.isInteger(hedef)) i = hedef;
  else return { hata: 'Geçersiz hedef.' };
  if (i < 0) return { hata: 'Bu ilk soru; öncesi yok.' };
  if (i >= d.kuyruk.length) return { hata: 'Bu son soru; sonrası yok.' };
  d.soruIndeksi = i;
  return d.basla(d.kuyruk[i].id);
}

/* Senkron + "öğretmen onaylı" geçişte sıradaki soruya elle geçilir. */
function sonraki(d) { return d.soruAtla('sonraki'); }

module.exports = { etiketAyarla, ayarla, basla, duraklat, bitir, etkinligiBitir, soruAtla, sonraki };
