'use strict';
/* Izgara Çıkarım — içerik sözlüğü: Türkçe ek/fiil çekimleri, kategori fabrikaları ve temalar.
   Yalnız data/uretec.js kullanır; sunucu bu dosyayı yüklemez. */

/* ---------- Türkçe ekler ---------- */
function dirEki(w) {
  const s = w.toLocaleLowerCase('tr');
  const vowels = 'aeıioöuü';
  let last = '';
  for (const ch of s) if (vowels.includes(ch)) last = ch;
  let e = 'dir';
  if ('aı'.includes(last)) e = 'dır';
  else if ('ei'.includes(last)) e = 'dir';
  else if ('ou'.includes(last)) e = 'dur';
  else if ('öü'.includes(last)) e = 'dür';
  const lastCh = s[s.length - 1];
  if ('fçhkpsşt'.includes(lastCh)) e = 't' + e.slice(1);
  return "'" + e;
}

/* ---------- fiil çekimleri ---------- */
const V = {
  besle:  { p: 'besler', n: 'beslemez', pc: 'besliyorsa', nc: 'beslemiyorsa', s: 'besleyen' },
  sev:    { p: 'sever', n: 'sevmez', pc: 'seviyorsa', nc: 'sevmiyorsa', s: 'seven' },
  tasi:   { p: 'taşır', n: 'taşımaz', pc: 'taşıyorsa', nc: 'taşımıyorsa', s: 'taşıyan' },
  ic:     { p: 'içer', n: 'içmez', pc: 'içiyorsa', nc: 'içmiyorsa', s: 'içen' },
  cal:    { p: 'çalar', n: 'çalmaz', pc: 'çalıyorsa', nc: 'çalmıyorsa', s: 'çalan' },
  giy:    { p: 'giyer', n: 'giymez', pc: 'giyiyorsa', nc: 'giymiyorsa', s: 'giyen' },
  ye:     { p: 'yer', n: 'yemez', pc: 'yiyorsa', nc: 'yemiyorsa', s: 'yiyen' },
  sec:    { p: 'seçer', n: 'seçmez', pc: 'seçiyorsa', nc: 'seçmiyorsa', s: 'seçen' },
  incele: { p: 'inceler', n: 'incelemez', pc: 'inceliyorsa', nc: 'incelemiyorsa', s: 'inceleyen' },
  oyna:   { p: 'oynar', n: 'oynamaz', pc: 'oynuyorsa', nc: 'oynamıyorsa', s: 'oynayan' },
  sula:   { p: 'sular', n: 'sulamaz', pc: 'suluyorsa', nc: 'sulamıyorsa', s: 'sulayan' },
  oku:    { p: 'okur', n: 'okumaz', pc: 'okuyorsa', nc: 'okumuyorsa', s: 'okuyan' },
  nobet:  { p: 'nöbet tutar', n: 'nöbet tutmaz', pc: 'nöbet tutuyorsa', nc: 'nöbet tutmuyorsa', s: 'nöbet tutan' },
  kur:    { p: 'kurar', n: 'kurmaz', pc: 'kuruyorsa', nc: 'kurmuyorsa', s: 'kuran' }
};

/* kategori fabrikaları -------------------------------------------------- */
// nesne + fiil kategorisi:  "kedi besleyen çocuk", "kedi besler", "kedi beslemiyorsa"
function nesne(ad, ogeler, verb, noun, obj) {
  const o = obj || ((v) => v);
  const f = V[verb];
  return {
    ad, ogeler,
    s: (v) => `${o(v)} ${f.s} ${noun}`,
    p: (v) => `${o(v)} ${f.p}`,
    n: (v) => `${o(v)} ${f.n}`,
    pc: (v) => `${o(v)} ${f.pc}`,
    nc: (v) => `${o(v)} ${f.nc}`
  };
}
// özel isim kategorisi: "Ayla", "Ayla'dır", "Ayla değildir"
function isim(ad, ogeler) {
  return {
    ad, ogeler, kisi: true,
    s: (v) => v,
    p: (v) => `${v}${dirEki(v)}`,
    n: (v) => `${v} değildir`,
    pc: (v) => `${v} ise`,
    nc: (v) => `${v} değilse`
  };
}
// sıra kategorisi (yalnız c-2)
function sira(n) {
  const ogeler = [];
  for (let i = 1; i <= n; i++) ogeler.push(`${i}.`);
  return {
    ad: 'Sıra', ogeler, sirali: true,
    s: (v) => `${v} sıradaki`,
    p: (v) => `${v} sıradadır`,
    n: (v) => `${v} sırada değildir`,
    pc: (v) => `${v} sıradaysa`,
    nc: (v) => `${v} sırada değilse`
  };
}

/* ---------- temalar ---------- */
const THEMES = [
  {
    tema: 'sihirbazlar', baslik: 'Sihir Okulu', emoji: '🧙',
    kisi: ['Ayla', 'Bora', 'Ceren', 'Deniz', 'Efe', 'Gökçe'],
    kisiAd: 'Sihirbaz', kisiNoun: 'sihirbaz',
    kats: [
      () => nesne('Asa', ['yıldızlı', 'gümüş', 'ahşap', 'kristal', 'altın', 'bakır'], 'tasi', 'sihirbaz', v => `${v} asayı`),
      () => nesne('Yaratık', ['ejderha', 'baykuş', 'kedi', 'kurbağa', 'tilki', 'kirpi'], 'besle', 'sihirbaz'),
      () => nesne('Pelerin', ['mavi', 'mor', 'yeşil', 'kırmızı', 'sarı', 'turuncu'], 'giy', 'sihirbaz', v => `${v} pelerini`)
    ]
  },
  {
    tema: 'gezegenler', baslik: 'Gezegen Kâşifleri', emoji: '🪐',
    kisi: ['Arda', 'Berk', 'Cansu', 'Dilara', 'Ege', 'Feride'],
    kisiAd: 'Kâşif', kisiNoun: 'kâşif',
    kats: [
      () => nesne('Gezegen', ['Kızılca', 'Buzul', 'Halkalı', 'Toz', 'Işıl', 'Gölge'], 'incele', 'kâşif', v => `${v} gezegenini`),
      () => nesne('Roket', ['mavi', 'gümüş', 'turuncu', 'yeşil', 'beyaz', 'mor'], 'sec', 'kâşif', v => `${v} roketi`),
      () => nesne('Uydu', ['Ay', 'Işık', 'Damla', 'Kum', 'Bulut', 'Kaya'], 'sev', 'kâşif', v => `${v} adlı uyduyu`)
    ]
  },
  {
    tema: 'tatlılar', baslik: 'Tatlı Şöleni', emoji: '🍰',
    kisi: ['Ela', 'Kaan', 'Lena', 'Mert', 'Nil', 'Onur'],
    kisiAd: 'Çocuk', kisiNoun: 'çocuk',
    kats: [
      () => nesne('Tatlı', ['dondurma', 'kurabiye', 'muhallebi', 'baklava', 'kek', 'lokma'], 'ye', 'çocuk'),
      () => nesne('İçecek', ['limonata', 'süt', 'ayran', 'vişne suyu', 'ıhlamur', 'portakal suyu'], 'ic', 'çocuk'),
      () => nesne('Tabak', ['mavi', 'sarı', 'pembe', 'yeşil', 'beyaz', 'mor'], 'sec', 'çocuk', v => `${v} tabağı`)
    ]
  },
  {
    tema: 'barinak', baslik: 'Hayvan Barınağı', emoji: '🐾',
    kisi: ['Aslı', 'Burak', 'Cem', 'Duru', 'Eren', 'Funda'],
    kisiAd: 'Bakıcı', kisiNoun: 'bakıcı',
    kats: [
      () => nesne('Hayvan', ['kedi', 'köpek', 'papağan', 'tavşan', 'kaplumbağa', 'hamster'], 'besle', 'bakıcı'),
      () => nesne('Tasma', ['kırmızı', 'mavi', 'yeşil', 'sarı', 'mor', 'turuncu'], 'sec', 'bakıcı', v => `${v} tasmayı`),
      () => nesne('Gün', ['pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi'], 'nobet', 'bakıcı', v => `${v} günü`)
    ]
  },
  {
    tema: 'muzik', baslik: 'Müzik Atölyesi', emoji: '🎵',
    kisi: ['Alp', 'Beste', 'Ceyda', 'Doruk', 'Ezgi', 'Ferhat'],
    kisiAd: 'Öğrenci', kisiNoun: 'öğrenci',
    kats: [
      () => nesne('Enstrüman', ['keman', 'gitar', 'flüt', 'piyano', 'davul', 'bağlama'], 'cal', 'öğrenci'),
      () => nesne('Çanta', ['siyah', 'kırmızı', 'yeşil', 'mavi', 'sarı', 'gri'], 'tasi', 'öğrenci', v => `${v} çantayı`),
      () => nesne('Şarkı', ['Bahar', 'Deniz', 'Rüzgâr', 'Yıldız', 'Kar', 'Güneş'], 'sev', 'öğrenci', v => `${v} şarkısını`)
    ]
  },
  {
    tema: 'bahce', baslik: 'Okul Bahçesi', emoji: '🌷',
    kisi: ['Ada', 'Bulut', 'Çınar', 'Defne', 'Emir', 'Gizem'],
    kisiAd: 'Bahçıvan', kisiNoun: 'bahçıvan',
    kats: [
      () => nesne('Çiçek', ['lale', 'papatya', 'gül', 'menekşe', 'karanfil', 'zambak'], 'sula', 'bahçıvan'),
      () => nesne('Kova', ['yeşil', 'mavi', 'kırmızı', 'sarı', 'beyaz', 'mor'], 'sec', 'bahçıvan', v => `${v} kovayı`),
      () => nesne('Gün', ['pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'pazar'], 'nobet', 'bahçıvan', v => `${v} günü`)
    ]
  },
  {
    tema: 'kitap', baslik: 'Kitap Kulübü', emoji: '📚',
    kisi: ['Aylin', 'Barış', 'Ceylan', 'Derin', 'Emre', 'Fikret'],
    kisiAd: 'Okur', kisiNoun: 'okur',
    kats: [
      () => nesne('Kitap', ['Küçük Prens', 'Pinokyo', 'Heidi', 'Momo', 'Tom Sawyer', 'Robinson'], 'oku', 'okur', v => `${v} kitabını`),
      () => nesne('Koltuk', ['yeşil', 'kahverengi', 'mavi', 'gri', 'kırmızı', 'bej'], 'sec', 'okur', v => `${v} koltuğu`),
      () => nesne('Ayraç', ['kalp', 'yıldız', 'kelebek', 'yaprak', 'balık', 'bulut'], 'sev', 'okur', v => `${v} ayracı`)
    ]
  },
  {
    tema: 'spor', baslik: 'Spor Günü', emoji: '⚽',
    kisi: ['Ahmet', 'Bade', 'Can', 'Damla', 'Enes', 'Feyza'],
    kisiAd: 'Sporcu', kisiNoun: 'sporcu',
    kats: [
      () => nesne('Spor', ['basketbol', 'voleybol', 'tenis', 'yüzme', 'satranç', 'futbol'], 'oyna', 'sporcu'),
      () => nesne('Forma', ['kırmızı', 'mavi', 'yeşil', 'beyaz', 'sarı', 'siyah'], 'giy', 'sporcu', v => `${v} forma`),
      () => nesne('Kulüp', ['Kartal', 'Yıldız', 'Şimşek', 'Fırtına', 'Zirve', 'Umut'], 'sec', 'sporcu', v => `${v} kulübünü`)
    ]
  }
];

/* ---------- e grubu temaları (1.–2. sınıf) ----------
   Okuma yükü düşük: kısa adlar, her öğede emoji, tek ek kategori,
   cümlenin öznesi daima ilk kategori ("🐻 Ayı 🍯 bal sever."). */
const E_THEMES = [
  {
    tema: 'orman-sofrasi', baslik: 'Orman Sofrası', emoji: '🐻',
    kisi: ['🐻 Ayı', '🐱 Kedi', '🐰 Tavşan', '🐶 Köpek', '🐵 Maymun'],
    kisiAd: 'Hayvan',
    kats: [() => nesne('Yiyecek', ['🍯 bal', '🥛 süt', '🥕 havuç', '🦴 kemik', '🍌 muz'], 'sev', 'hayvan')]
  },
  {
    tema: 'oyuncak-sepeti', baslik: 'Oyuncak Sepeti', emoji: '🧸',
    kisi: ['Ali', 'Ece', 'Can', 'Su', 'Mert'],
    kisiAd: 'Çocuk',
    kats: [() => nesne('Oyuncak', ['🚗 araba', '🧸 ayıcık', '⚽ top', '🪁 uçurtma', '🎈 balon'], 'sev', 'çocuk')]
  },
  {
    tema: 'renkli-kalemler', baslik: 'Renkli Kalemler', emoji: '🎨',
    kisi: ['Ada', 'Efe', 'Nil', 'Kaan', 'Duru'],
    kisiAd: 'Çocuk',
    kats: [() => nesne('Kalem', ['🔴 kırmızı', '🔵 mavi', '🟢 yeşil', '🟡 sarı', '🟣 mor'], 'sec', 'çocuk', (v) => `${v} kalemi`)]
  },
  {
    tema: 'meyve-tabagi', baslik: 'Meyve Tabağı', emoji: '🍎',
    kisi: ['Elif', 'Ömer', 'Zeynep', 'Poyraz', 'Asya'],
    kisiAd: 'Çocuk',
    kats: [() => nesne('Meyve', ['🍎 elma', '🍌 muz', '🍓 çilek', '🍇 üzüm', '🍊 portakal'], 'ye', 'çocuk')]
  },
  {
    tema: 'tasitlar', baslik: 'Taşıtlar', emoji: '🚗',
    kisi: ['Aras', 'Bade', 'Cem', 'Doğa', 'Ege'],
    kisiAd: 'Çocuk',
    kats: [() => nesne('Taşıt', ['🚗 araba', '🚌 otobüs', '🚲 bisiklet', '🚂 tren', '✈️ uçak'], 'sev', 'çocuk')]
  },
  {
    tema: 'dondurma', baslik: 'Dondurma Dükkânı', emoji: '🍦',
    kisi: ['Ayşe', 'Berk', 'Ceren', 'Deniz', 'Emir'],
    kisiAd: 'Çocuk',
    kats: [() => nesne('Dondurma', ['🍫 çikolata', '🍓 çilek', '🍋 limon', '🥭 mango', '🍦 vanilya'], 'sev', 'çocuk')]
  },
  {
    tema: 'okul-cantasi', baslik: 'Okul Çantası', emoji: '🎒',
    kisi: ['Arda', 'Bilge', 'Cihan', 'Defne', 'Eda'],
    kisiAd: 'Çocuk',
    kats: [() => nesne('Eşya', ['📕 kitap', '✏️ kalem', '📏 cetvel', '🎨 boya', '✂️ makas'], 'tasi', 'çocuk')]
  },
  {
    tema: 'muzik-kosesi', baslik: 'Müzik Köşesi', emoji: '🎵',
    kisi: ['Alp', 'Buse', 'Cansu', 'Derin', 'Eren'],
    kisiAd: 'Çocuk',
    kats: [() => nesne('Çalgı', ['🥁 davul', '🎸 gitar', '🎺 trompet', '🎹 piyano', '🪘 tef'], 'cal', 'çocuk')]
  }
];

module.exports = { dirEki, V, nesne, isim, sira, THEMES, E_THEMES };
