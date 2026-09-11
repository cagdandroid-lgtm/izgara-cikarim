'use strict';
/* Tüm oyun durumu sunucuda tutulur; istemci yalnızca görüntüler. */
const bulmacalar = require('./bulmacalar');
const { isaretGecerli, isaretUygula } = require('./kontrol');
const { Takimlar } = require('./takimlar');
const { Olcum } = require('./olcum');
const { Liste } = require('./liste');
const gorunum = require('./gorunum');
const akis = require('./akis');
const soruUreteci = require('./soru');
const { YASAK_MS } = require('./puan');

const simdi = () => Date.now();

class Durum {
  constructor() {
    this.oyuncular = new Map();   // sid -> oyuncu
    this.yasaklar = new Map();    // ad(küçük) -> bitiş zamanı
    // başlangıç grubu/seviyesi daima birbiriyle uyumlu seçilir
    this.grup = bulmacalar.gruplar[0] || 'i';
    this.seviye = (bulmacalar.liste(this.grup)[0] || {}).seviye || bulmacalar.seviyeler[0];
    this.mod = 'yaris';
    this.sureSn = 0;
    this.girisKilitli = false;
    this.turNo = 0;
    this.oynanan = new Set();
    this.tk = new Takimlar(this.oyuncular);   // yalnız "ikili" modunda kullanılır
    this.olcum = new Olcum();                 // olay kaydı + takma ad (lib/olcum.js)
    this.liste = new Liste();                 // kalıcı öğrenci listesi (data/ogrenciler.json)
    this.secimYapildi = false;                // öğretmen grup/etkinlik seçene kadar öğrenciler bekler
    this.dersEtiketi = '';                    // öğretmenin serbest ders etiketi ("2. Ders · 12 Eylül")
    this.ilerlemeMod = 'senkron';             // 'senkron' (herkes aynı soruda) | 'bireysel' (kendi hızında)
    this.bekleyenIlerlemeMod = null;          // tur sürerken seçilen mod, sonraki turda uygulanır
    this.gecis = 'otomatik';                  // senkronda sıradaki soruya geçiş: 'otomatik' | 'onayli'
    this.otomatikDoldur = false;              // ızgarada ✓ konunca satır/sütun ✗'leri — VARSAYILAN KAPALI
    this.kuyruk = [];                         // bireysel modda oturumun bulmaca sırası
    this.turSifirla();
  }

  turSifirla() {
    this.faz = 'lobi';
    this.bulmaca = null;
    this.duraklatildi = false;
    this.baslangic = 0;
    this.duraklananMs = 0;
    this.duraklamaBaslangic = 0;
    this.ortakIsaretler = {};
    this.podyum = [];
    this.turPuanlari = {};
    this.sonKontrol = null;       // birlikte modunda son ortak sonuç
    this.soru = null;             // senkron modda herkesin cevapladığı ASIL GÖREV
    this.gonderildi = false;      // "birlikte" modunda sınıfın TEK gönderim kilidi
    for (const o of this.oyuncular.values()) {
      o.bitisMs = null;
      o.denemeler = 0;
      o.sonKontrolZamani = 0;
      o.bulmacaId = null;
      o.soru = null;
      o.tamamlandi = false;
      akis.soruSifirla(o);
    }
    if (this.tk) this.tk.hepsiniSifirla();
  }

  /* ---------------- ikili mod: takımlara ince arayüz (ayrıntı: lib/takimlar.js) ---------- */
  get takimlar() { return this.tk.liste; }
  takim(oyuncuId) { return this.tk.bul(oyuncuId); }
  takimAdi(t) { return this.tk.ad(t); }
  takimKur() { return this.tk.kur(); }
  takimlariTazele() { return this.tk.tazele(); }
  elleEsle(id1, id2) { return this.tk.elleEsle(id1, id2); }
  takimOzet() { return this.tk.ozet(this.bulmaca); }

  /* ---------------- oyuncular (SINIF OTURUMU MODELİ) ----------------
     Öğrenci isim YAZMAZ, grup SEÇMEZ: öğretmenin açtığı grubun isim kartından
     kendi adına dokunur ve listedeki KODUYLA oturuma bağlanır. */
  katil(kod, sid) {
    if (!this.secimYapildi) return { hata: 'Öğretmenin henüz oturumu açmadı. ⏳' };
    const kayit = this.liste.bul(kod);
    if (!kayit || !kayit.aktif) return { hata: 'Bu isim listede yok. Öğretmenine söyle.' };
    // Yayınlanan grup dışındaki öğrenci giremez; kendi grubu yayınlanana kadar bekleme ekranında kalır.
    if (kayit.grup !== this.grup) {
      return { hata: 'Bu etkinlik senin grubun için değil. Kendi grubunu bekle. ⏳', baskaGrup: true };
    }

    const yasak = this.yasaklar.get(kayit.kod);
    if (yasak && yasak > simdi()) {
      return { hata: 'Öğretmenin seni oyundan çıkardı. Birkaç dakika sonra tekrar dene.' };
    }
    if (yasak) this.yasaklar.delete(kayit.kod);

    // 1) aynı oturum kimliği ile dönüş  2) aynı kodla dönüş (yeni cihaz/sekme)
    let o = sid ? this.oyuncular.get(sid) : null;
    if (o && o.kod !== kayit.kod) o = null;
    if (!o) o = [...this.oyuncular.values()].find((p) => p.kod === kayit.kod) || null;
    if (o) {
      if (o.cevrimici && o.id !== sid) return { hata: 'Bu isim şu an oyunda. Kendi adına dokun. 🎮' };
      o.ad = kayit.isim;
      o.cevrimici = true;
      return { oyuncu: o, geriDondu: true };
    }
    if (this.girisKilitli) return { hata: 'Öğretmen yeni katılımları kapattı. 🔒' };

    const yeni = {
      id: sid || ('o' + Math.random().toString(36).slice(2, 10)),
      kod: kayit.kod, ad: kayit.isim, grup: kayit.grup, misafir: !!kayit.misafir,
      puan: 0, cevrimici: true,
      isaretler: {}, bitti: false, bitisMs: null, denemeler: 0,
      sonSonuc: null, sonKontrolZamani: 0, katilim: simdi(),
      sira: 0, bulmacaId: null, soru: null, soruDeneme: 0, soruBaslangic: simdi(),
      tabloKullandi: false, soruSayisi: 0, dogruSayisi: 0, ilkDenemeDogru: 0, tamamlandi: false
    };
    this.oyuncular.set(yeni.id, yeni);
    // tur sürerken katılan öğrenci görevsiz kalmasın (bireyselde kendi sırası hemen açılır)
    if (this.faz === 'oyun') {
      if (this.ilerlemeMod === 'bireysel') akis.oyuncuSoruVer(this, yeni);
      else akis.soruSifirla(yeni);
    }
    return { oyuncu: yeni, geriDondu: false };
  }

  /* Öğretmen "serbest bırak" derse isim kartı yeniden seçilebilir hâle gelir.
     (Yanlış isme dokunan öğrenci için; yasak konmaz, ölçüm kayıtları silinmez.) */
  serbest(id) {
    const o = this.oyuncular.get(id);
    if (!o) return null;
    this.oyuncular.delete(id);
    delete this.turPuanlari[id];
    this.podyum = this.podyum.filter((p) => p.id !== id);
    this.tk.oyuncuyuCikar(id);
    return o;
  }

  /* Farklı gruptan giren oyuncuyu aktif gruba taşı (sahneye dahil olur) */
  grubaTasi(id) {
    const o = this.oyuncular.get(id);
    if (!o) return null;
    o.grup = this.grup;
    this.liste.guncelle(o.kod, { grup: this.grup });
    return o;
  }

  cevrimdisi(sid) {
    const o = this.oyuncular.get(sid);
    if (o) o.cevrimici = false;     // listeden SİLİNMEZ, puanı korunur
    return o;
  }

  /* ---------------- öğretmen ---------------- */
  /* Ders etiketi: kayıtlara ve karne/rapor başlığına yazılır. Serbest metindir. */
  etiketAyarla(metin) {
    this.dersEtiketi = String(metin || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    return this.dersEtiketi;
  }

  ayarla({ grup, seviye, mod, sureSn, dersEtiketi, ilerlemeMod, gecis, otomatikDoldur }) {
    if (dersEtiketi !== undefined) this.etiketAyarla(dersEtiketi);
    // tur SÜRERKEN ilerleme modu değişimi oyuncuları görevsiz bırakabilir: sonraki tura ertelenir
    if ((ilerlemeMod === 'senkron' || ilerlemeMod === 'bireysel') && ilerlemeMod !== this.ilerlemeMod) {
      if (this.faz === 'oyun') this.bekleyenIlerlemeMod = ilerlemeMod;
      else this.ilerlemeMod = ilerlemeMod;
    }
    if (gecis === 'otomatik' || gecis === 'onayli') this.gecis = gecis;
    if (otomatikDoldur !== undefined) this.otomatikDoldur = !!otomatikDoldur;
    // öğretmenin ilk grup/etkinlik seçimi bekleme ekranlarını isim kartlarına çevirir
    if ((grup || seviye) && this.faz === 'lobi') this.secimYapildi = true;
    // Grup ve etkinlik YALNIZ boşta/lobide değişir. Tur başladıysa değişmez:
    // tek yol "Etkinliği Bitir"dir (oturum boşa döner).
    const secilebilir = this.faz === 'lobi';
    if (secilebilir) {
      if (grup && bulmacalar.gruplar.includes(grup)) this.grup = grup;
      if (seviye && bulmacalar.seviyeler.includes(seviye)) this.seviye = seviye;
    }
    if (mod === 'yaris' || mod === 'birlikte' || mod === 'ikili') this.mod = mod;
    // bireysel ilerlemede herkes kendi bulmacasındadır; ortak/ikili tablo anlamsızdır
    if (this.ilerlemeMod === 'bireysel') this.mod = 'yaris';
    // ikiliye geçildiğinde takım yoksa hemen kur (öğrenciler takımsız kalmasın)
    if (this.mod === 'ikili' && !this.takimlar.length && this.oyuncular.size) this.takimKur();
    if (Number.isFinite(sureSn) && sureSn >= 0 && sureSn <= 3600) this.sureSn = Math.floor(sureSn);
  }

  basla(bulmacaId) {
    this.secimYapildi = true;
    if (this.bekleyenIlerlemeMod) {          // tur sırasında istenen mod değişimi şimdi uygulanır
      this.ilerlemeMod = this.bekleyenIlerlemeMod;
      this.bekleyenIlerlemeMod = null;
      if (this.ilerlemeMod === 'bireysel') this.mod = 'yaris';
    }
    let b = bulmacaId ? bulmacalar.bul(bulmacaId) : null;
    if (b && this.secimYapildi && b.grup !== this.grup) {
      return { hata: 'Bu bulmaca yayınlanan grubun değil. Grubu değiştirmek için önce etkinliği bitirin.' };
    }
    if (!b) {
      const havuz = bulmacalar.liste(this.grup, this.seviye);
      if (!havuz.length) return { hata: 'Bu grup/seviye için bulmaca yok.' };
      const taze = havuz.filter((x) => !this.oynanan.has(x.id));
      const kaynak = taze.length ? taze : havuz;
      b = kaynak[Math.floor(Math.random() * kaynak.length)];
    }
    this.turSifirla();
    // ikili modda ilk başlatışta takımlar kurulur, sonrakilerde eşleşmeler korunur
    if (this.mod === 'ikili') {
      if (!this.takimlar.length) this.takimKur();
      else this.takimlariTazele();
    }
    this.grup = b.grup;
    this.seviye = b.seviye;
    this.turNo++;
    this.faz = 'oyun';
    this.baslangic = simdi();

    if (this.ilerlemeMod === 'bireysel') {
      // herkes kendi hızında: oturum kuyruğu kurulur, herkese ilk soru verilir
      akis.kuyrukKur(this);
      if (this.kuyruk.length) { this.bulmaca = this.kuyruk[0]; this.oynanan.add(this.kuyruk[0].id); }
      for (const o of this.oyuncular.values()) {
        o.sira = 0;
        o.tamamlandi = false;
        akis.oyuncuSoruVer(this, o);
      }
      this.soru = null;
    } else {
      this.bulmaca = b;
      this.oynanan.add(b.id);
      this.soru = soruUreteci.soruUret(b, this.turNo);
      for (const o of this.oyuncular.values()) akis.soruSifirla(o);
    }
    return { bulmaca: b };
  }

  duraklat(deger) {
    if (this.faz !== 'oyun') return;
    if (deger && !this.duraklatildi) {
      this.duraklatildi = true;
      this.duraklamaBaslangic = simdi();
    } else if (!deger && this.duraklatildi) {
      this.duraklatildi = false;
      this.duraklananMs += simdi() - this.duraklamaBaslangic;
      this.duraklamaBaslangic = 0;
    }
  }

  /* Turu Bitir: YALNIZ bu turu kapatır. Oturum, grup ve öğrenciler yerinde kalır. */
  bitir() { if (this.faz === 'oyun') this.faz = 'sonuc'; }

  /* Etkinliği Bitir: oturumu BOŞTA durumuna döndürür.
     Tur durur, öğrenciler oturumdan düşer (cihazlarındaki kimlik temizlenir) ve
     öğretmen yeni grup yayınlayana kadar bekleme ekranında kalırlar.
     Ölçüm kayıtları ve isim↔kod eşlemesi KORUNUR (raporlar/karneler çalışmayı sürdürür). */
  etkinligiBitir() {
    const dusen = [...this.oyuncular.values()].map((o) => ({ id: o.id, kod: o.kod, ad: o.ad }));
    if (this.faz === 'oyun' && this.bulmaca) this.olcum.turKapat(this);   // cevapsızlar 'atlandi'
    this.turSifirla();
    this.oyuncular.clear();
    this.tk.liste = [];
    this.secimYapildi = false;
    this.gonderildi = false;
    this.kuyruk = [];
    this.oynanan.clear();
    return dusen;
  }

  /* Turu iptal et: bu turda dağıtılan TÜM puanlar geri alınır */
  iptal() {
    let geri = 0;
    for (const [id, p] of Object.entries(this.turPuanlari)) {
      const o = this.oyuncular.get(id);
      if (o) { o.puan -= p; geri += p; }
    }
    this.turPuanlari = {};
    this.podyum = [];
    this.faz = 'sonuc';
    for (const o of this.oyuncular.values()) { o.bitti = false; o.sonSonuc = null; }
    // ikili modda takımların bitirme durumu da geri alınır (takımlar korunur)
    for (const t of this.takimlar) { t.bitti = false; t.bitisMs = null; t.sonSonuc = null; }
    return geri;
  }

  puanVer(oyuncu, miktar) {
    oyuncu.puan += miktar;
    this.turPuanlari[oyuncu.id] = (this.turPuanlari[oyuncu.id] || 0) + miktar;
  }

  /* Öğretmenin elle düzeltmesi tur iptalinden etkilenmez.
     İkili modda düzeltme TAKIM bazlıdır: tüm üyelere aynı miktar uygulanır. */
  puanDuzelt(id, delta) {
    const o = this.oyuncular.get(id);
    if (!o || !Number.isFinite(delta)) return null;
    const miktar = Math.trunc(delta);
    if (this.mod === 'ikili') {
      const t = this.takim(o.id);
      if (t) {
        for (const uid of t.uyeler) { const u = this.oyuncular.get(uid); if (u) u.puan += miktar; }
        return { oyuncu: o, takim: t, ad: this.takimAdi(t), uyeSayisi: t.uyeler.length };
      }
    }
    o.puan += miktar;
    return { oyuncu: o, takim: null, ad: o.ad, uyeSayisi: 1 };
  }

  at(id) {
    const o = this.oyuncular.get(id);
    if (!o) return null;
    this.oyuncular.delete(id);
    delete this.turPuanlari[id];
    this.podyum = this.podyum.filter((p) => p.id !== id);
    this.tk.oyuncuyuCikar(id);
    this.yasaklar.set(o.kod, simdi() + YASAK_MS);
    return o;
  }

  /* İsim artık listeden gelir: düzeltme, Öğrenci Listesi bölümünden yapılır
     ve oturumdaki oyuncuya anında yansır. */
  isimTazele(kod) {
    const kayit = this.liste.bul(kod);
    if (!kayit) return null;
    for (const o of this.oyuncular.values()) if (o.kod === kayit.kod) o.ad = kayit.isim;
    return kayit;
  }

  kilit(tip, deger) {
    if (tip === 'giris') this.girisKilitli = !!deger;
  }

  sifirlaHepsi() {
    this.turSifirla();
    this.oynanan.clear();
    this.turNo = 0;
    this.kuyruk = [];
    for (const o of this.oyuncular.values()) {
      o.puan = 0;
      o.sira = 0;
      o.soruSayisi = 0;
      o.dogruSayisi = 0;
      o.ilkDenemeDogru = 0;
      o.tamamlandi = false;
    }
  }

  /* ---------------- öğrenci hamleleri ---------------- */
  isaretTablosu(oyuncu) {
    if (this.ilerlemeMod === 'bireysel') return oyuncu.isaretler;
    if (this.mod === 'birlikte') return this.ortakIsaretler;
    if (this.mod === 'ikili') {
      const t = this.takim(oyuncu.id);
      return t ? t.isaretler : oyuncu.isaretler;   // takımı yoksa kendi tablosu
    }
    return oyuncu.isaretler;
  }

  isaret(sid, p, c, d) {
    const o = this.oyuncular.get(sid);
    if (!o || this.faz !== 'oyun' || this.duraklatildi) return null;
    const b = akis.aktifBulmaca(this, o);
    if (!b) return null;
    if (d !== '') o.tabloKullandi = true;      // ölçme: tabloyu kullandı mı (araştırma alanı)
    if (this.mod === 'ikili') {
      const t = this.takim(o.id);
      if (!t || t.bitti) return null;
      if (!isaretGecerli(b, p, c, d)) return null;
      isaretUygula(t.isaretler, p, c, d);
      return { ortak: true, oda: `takim:${t.id}`, takimId: t.id, p, c, d };
    }
    if (!isaretGecerli(b, p, c, d)) return null;
    isaretUygula(this.isaretTablosu(o), p, c, d);
    return { ortak: this.mod === 'birlikte', p, c, d };
  }

  temizle(sid) {
    const o = this.oyuncular.get(sid);
    if (!o || this.faz !== 'oyun' || this.duraklatildi) return false;
    if (this.mod === 'birlikte') this.ortakIsaretler = {};
    else if (this.mod === 'ikili') { const t = this.takim(o.id); if (t) t.isaretler = {}; else o.isaretler = {}; }
    else o.isaretler = {};
    return true;
  }

  /* Tabloyu denetle: PUANSIZ yardım — hangi satırlar kesinleşti, onu söyler.
     Puan yalnız ASIL SORUYA verilen cevaptan gelir (bkz. cevap). */
  kontrol(sid) { return akis.denetle(this, sid); }

  /* Asıl göreve cevap (tam eşleştirme, tek gönderim). */
  cevap(sid, atamalar) { return akis.cevapVer(this, sid, atamalar); }

  /* Bireysel modda öğrencinin kendi isteğiyle sıradaki bulmacaya geçmesi. */
  ilerle(sid) { return akis.ilerle(this, sid); }

  /* Senkron + "öğretmen onaylı" geçişte sıradaki soruya elle geçilir. */
  sonraki() {
    if (this.ilerlemeMod !== 'senkron') return { hata: 'Sıradaki soru yalnız senkron modda geçerlidir.' };
    return this.basla(null);
  }

  rozetler() { return akis.rozetler(this); }

  /* ---------------- görünümler ---------------- */
  gecenMs() {
    if (!this.baslangic) return 0;
    const durakla = this.duraklatildi ? simdi() - this.duraklamaBaslangic : 0;
    return simdi() - this.baslangic - this.duraklananMs - durakla;
  }

  kalanSn() {
    if (!this.sureSn || this.faz !== 'oyun') return null;
    return Math.max(0, Math.ceil((this.sureSn * 1000 - this.gecenMs()) / 1000));
  }

  skorlar() { return gorunum.skorlar(this); }
  kamu() { return gorunum.kamu(this); }
  kisisel(sid) { return gorunum.kisisel(this, sid); }
  lobi() { return gorunum.lobi(this); }
  ogretmenEk() { return gorunum.ogretmenEk(this); }
}

module.exports = { Durum };
