'use strict';
/* Kalıcı öğrenci listesi (data/ogrenciler.json) — isim ↔ KOD eşlemesi.
   Kodlar dönem boyunca sabittir; ölçme kayıtlarında daima bu kod kullanılır.
   Oturum içi değişiklikler (ekle/düzenle/pasifleştir/misafir) YALNIZ BELLEKTE tutulur;
   kalıcılık için öğretmen "Listeyi İndir" ile güncel ogrenciler.json'u indirir. */
const fs = require('fs');
const path = require('path');

const gruplar = require('./gruplar');

const DOSYA = path.join(__dirname, '..', 'data', 'ogrenciler.json');
const DONUSUM = path.join(__dirname, '..', 'data', 'kod-donusumu.json');

/* Grup birleşmesi (İ+C → U) eski kodları: "C-04" → "U-24". Dosya yoksa boş tablo. */
function donusumYukle() {
  try { return JSON.parse(fs.readFileSync(DONUSUM, 'utf8')).donusum || {}; } catch (e) { return {}; }
}
const KOD_DONUSUMU = donusumYukle();
const GRUPLAR = gruplar.GECERLI;        // p, e, u (data/gruplar.json)

const SABLON = {
  _aciklama: 'UYCEP Logic ortak öğrenci listesi. TÜM oyun depolarında data/ogrenciler.json olarak AYNI dosya bulunur. ' +
    'Kodlar dönem boyunca sabittir ve asla değiştirilmez (araştırma verisinin sürekliliği buna bağlıdır). ' +
    'Ayrılan öğrenci silinmez, aktif:false yapılır. Doğum tarihi, iletişim vb. kişisel bilgiler bu dosyaya ASLA yazılmaz.',
  guncelleme: new Date().toISOString().slice(0, 10),
  ogrenciler: []
};

const iki = (n) => String(n).padStart(2, '0');
const kucuk = (s) => String(s || '').toLocaleLowerCase('tr');

class Liste {
  constructor() {
    this.yukle();
    this.misafirSayac = 0;
  }

  yukle() {
    if (!fs.existsSync(DOSYA)) {
      fs.writeFileSync(DOSYA, JSON.stringify(SABLON, null, 2), 'utf8');
      console.warn(`⚠️  data/ogrenciler.json bulunamadı; boş şablon oluşturuldu → ${DOSYA}`);
    }
    const ham = JSON.parse(fs.readFileSync(DOSYA, 'utf8'));
    this.aciklama = ham._aciklama || SABLON._aciklama;
    this.kayitlar = (ham.ogrenciler || []).map((o) => ({
      kod: String(o.kod || '').toUpperCase(),
      isim: String(o.isim || '').trim(),
      // eski "i"/"c" kayıtları "u" sayılır (geriye dönük uyumluluk)
      grup: gruplar.normal(o.grup) || String(o.grup || ''),
      aktif: o.aktif !== false,
      misafir: false
    })).filter((o) => o.kod && o.isim);
    console.log(`🧾 öğrenci listesi: ${this.kayitlar.length} kayıt (${GRUPLAR
      .map((g) => `${g}:${this.kayitlar.filter((o) => o.grup === g && o.aktif).length}`).join(' ')})`);
  }

  /* ---------- okuma ---------- */
  hepsi() { return this.kayitlar.map((o) => ({ ...o })); }
  /* Eski kodla gelen (cihaz hafızası, eski CSV) öğrenci yeni koduyla bulunur: C-04 → U-24 */
  bul(kod) {
    const k = String(kod || '').toUpperCase();
    return this.kayitlar.find((o) => o.kod === k) ||
      this.kayitlar.find((o) => o.kod === KOD_DONUSUMU[k]) || null;
  }
  grupSayilari() {
    const s = {};
    for (const g of GRUPLAR) s[g] = this.kayitlar.filter((o) => o.grup === g && o.aktif).length;
    return s;
  }

  /** Giriş ekranına giden paket: YALNIZ verilen grubun aktif öğrencileri.
      Başka grupların isimleri ya da sayısı bu pakete asla girmez. */
  lobi(grup, oyuncular) {
    return this.kayitlar
      .filter((o) => o.grup === grup && o.aktif)
      .map((o) => {
        const oyuncu = [...oyuncular.values()].find((p) => p.kod === o.kod) || null;
        return {
          kod: o.kod, isim: o.isim, misafir: o.misafir,
          oyunda: !!oyuncu, cevrimici: !!(oyuncu && oyuncu.cevrimici)
        };
      })
      .sort((a, b) => a.isim.localeCompare(b.isim, 'tr'));
  }

  /* ---------- oturum içi düzenleme ---------- */
  sonrakiKod(grup) {
    const on = grup.toUpperCase() + '-';
    let en = 0;
    for (const o of this.kayitlar) {
      if (!o.kod.startsWith(on)) continue;
      const n = parseInt(o.kod.slice(on.length), 10);
      if (Number.isFinite(n) && n > en) en = n;
    }
    return on + iki(en + 1);
  }

  ekle({ kod, isim, grup }) {
    isim = String(isim || '').trim().slice(0, 40);
    if (isim.length < 2) return { hata: 'İsim en az 2 harf olmalı.' };
    grup = gruplar.normal(grup);
    if (!grup) return { hata: 'Geçersiz grup.' };
    kod = String(kod || '').trim().toUpperCase() || this.sonrakiKod(grup);
    if (this.bul(kod)) return { hata: `${kod} kodu zaten kullanılıyor.` };
    const kayit = { kod, isim, grup, aktif: true, misafir: false };
    this.kayitlar.push(kayit);
    return { kayit };
  }

  guncelle(kod, { isim, grup, aktif }) {
    const o = this.bul(kod);
    if (!o) return { hata: 'Kayıt bulunamadı.' };
    if (isim !== undefined) {
      const y = String(isim).trim().slice(0, 40);
      if (y.length < 2) return { hata: 'İsim en az 2 harf olmalı.' };
      o.isim = y;
    }
    if (grup !== undefined && gruplar.normal(grup)) o.grup = gruplar.normal(grup);
    if (aktif !== undefined) o.aktif = !!aktif;
    return { kayit: o };
  }

  /** Misafir: yalnız bu oturuma katılır, M-01… kodunu alır, indirilen listeye YAZILMAZ. */
  misafirEkle(isim, grup) {
    isim = String(isim || '').trim().slice(0, 40);
    if (isim.length < 2) return { hata: 'Misafir adı en az 2 harf olmalı.' };
    grup = gruplar.normal(grup);
    if (!grup) return { hata: 'Önce bir grup seçin.' };
    const kayit = { kod: 'M-' + iki(++this.misafirSayac), isim, grup, aktif: true, misafir: true };
    this.kayitlar.push(kayit);
    return { kayit };
  }

  ara({ grup, durum, arama } = {}) {
    const a = kucuk(arama);
    return this.hepsi().filter((o) =>
      (!grup || grup === 'hepsi' || o.grup === grup) &&
      (!durum || durum === 'hepsi' || (durum === 'aktif' ? o.aktif : !o.aktif)) &&
      (!a || kucuk(o.isim).includes(a) || kucuk(o.kod).includes(a)));
  }

  /* ---------- dışa aktarım (misafirler hariç) ---------- */
  json() {
    return JSON.stringify({
      _aciklama: this.aciklama,
      guncelleme: new Date().toISOString().slice(0, 10),
      ogrenciler: this.kayitlar
        .filter((o) => !o.misafir)
        .map(({ kod, isim, grup, aktif }) => ({ kod, isim, grup, aktif }))
    }, null, 2) + '\n';
  }
}

module.exports = { Liste, GRUPLAR, KOD_DONUSUMU };
