# 🧩 Izgara Çıkarım — UYCEP Logic

“Kim – nerede – hangisi” türü (Einstein bulmacası) sınıf içi çok oyunculu çıkarım oyunu.
Öğrenciler ipuçlarını okuyup çıkarım tablosunu ✔ / ✖ ile doldurur; **cevap denetimi daima sunucuda** yapılır.

Dersler hibrittir: sınıftaki ve uzaktan (Zoom/Jitsi) katılan öğrenciler aynı bağlantıyı kullanır,
oyun ikisi arasında hiçbir ayrım yapmaz. Oda kodu yoktur, herkes tek sınıf odasına bağlanır.

---

## Kurulum

```bash
npm install
npm start                   # http://localhost:3000
```

- Öğrenci: `/`
- Öğretmen: `/teacher` (şifre ile)

### Öğretmen şifresi
Şifre koda gömülü değildir, `process.env.ADMIN_PASSWORD`’dan okunur. Tanımlı değilse davranış ortama göre ayrılır:

| Ortam | `ADMIN_PASSWORD` yoksa |
|---|---|
| **Yerel** (`RENDER` yok) | Varsayılan yerel şifre **`uycep`** ile çalışır — `.env` oluşturmak zorunlu değildir |
| **Render** (`RENDER` var) | Varsayılan **kullanılmaz**; loga büyük uyarı basılır ve `/teacher` girişi şifre tanımlanana kadar kapalı kalır (503) |

Kendi şifrenizi belirlemek isterseniz `cp .env.example .env` deyip değeri değiştirin; `.env` varsa varsayılan yerine o kullanılır.
Sunucu her başlarken aktif şifreyi konsola yazar:

```
🔑 Öğretmen paneli şifresi: ...
```

### Render’a kurulum
- Build command: `npm install` · Start command: `npm start`
- Environment → `ADMIN_PASSWORD` ekleyin (depoya yazılmaz, `.env` `.gitignore`’dadır).
- Port otomatik gelir (`process.env.PORT`).

---

## Oyun akışı

1. Öğrenci `/` adresinden **adını** yazıp katılır.
2. Öğretmen panelden **grup + seviye + mod** seçip **Başlat** der.
3. Öğrenci ekranında bulmacanın tabloları ve numaralı ipuçları görünür.
   - Hücreye dokunuş: **boş → ✔ → ✖ → boş**
   - ✔ konulduğunda aynı satır/sütundaki boş hücreler otomatik ✖ olur (eleme kolaylığı).
   - Aynı satır/sütunda iki ✔ varsa hücre kesikli kırmızı çerçeveyle uyarır.
4. **Kontrol Et** → sunucu çözümle karşılaştırır:
   - Tamamı doğruysa konfeti + puan.
   - Değilse **tamamen doğru belirlenmiş satırlar yeşille** vurgulanır. Hücre bazlı hiçbir bilgi sızdırılmaz.
   - Ard arda denemeyi engellemek için 4 sn bekleme ve her hatalı denemede −5 puan uygulanır.

### Modlar
| Mod | Ne olur | Puanlama |
|---|---|---|
| 🏁 **Yarış** | Herkes aynı bulmacayı kendi tablosunda çözer | Taban 60 · podyum +40/+25/+15 · hatalı deneme −5 (en az 20) |
| 🤝 **Birlikte** | Sınıf tek tabloyu ortak doldurur, her işaret herkeste canlı görünür | Çözülünce çevrimiçi herkese +30 |
| 👥 **İkili** | Eşler ortak tabloyu çözer; yarış **takımlar arasındadır** | Yarış ile aynı hesap; puan **iki üyeye de eşit** yazılır |

“Birlikte” modu tartışma yönetmek içindir: öğretmen duraklatıp ipuçlarını sınıfça okutabilir.

### 👥 İkili Mod
- **Oda kodu yoktur**; öğrenciler her zamanki gibi adlarıyla girer, eşleştirmeyi sunucu yapar.
- Öğretmen **Başlat** dediğinde bağlı öğrenciler rastgele ikişerli takımlara ayrılır;
  sayı tekse **son takım üç kişilik** olur. Sonraki turlarda eşleşmeler korunur.
- Her takım kendi **Socket.io odasındadır** (`takim:<id>`): bir eşin koyduğu ✔/✖ yalnız
  takım arkadaşının ekranında anında belirir, başka takımlar görmez.
- Öğrenci ekranının üstünde **eşinin adı ve bağlantı durumu** (🟢/🔴) yazar.
- **Kontrol Et** takım adına çalışır; sonuç iki eşe birden düşer ve kimin kontrol ettiği yazar.
  Bekleme süresi de takım bazlıdır (aynı anda ikisi birden deneyemez).
- Kopan öğrenci geri geldiğinde **aynı takımına döner** (isim/oturum eşleşmesiyle);
  eşi yalnız kalırsa tabloyu tek başına doldurmayı sürdürebilir.
- Öğretmen paneli takımları, üyelerini, **canlı doluluk yüzdesini** ve deneme sayısını gösterir;
  **🔀 Karıştır** ile yeniden dağıtır, iki öğrenci seçip **🔗 Seçilenleri Eşle** ile elle eşler.
  Elle eşleme sonrası tek kalanlar “tek kişilik” rozetiyle görünür (Karıştır ile toparlanır).
- **Soruyu İptal Et** puanları her iki üyeden geri alır; **manuel puan düzeltme takım bazlıdır**
  (bir üyeye verilen ±puan tüm takıma uygulanır).

---

## Öğretmen paneli

- Bağlı öğrenci listesi: çevrimiçi 🟢 / çevrimdışı 🔴, ilerleme %, kesinleşen satır, deneme, puan
- **Başlat / Duraklat / Turu Bitir / Oyunu Sıfırla**
- Grup (e/i/c), seviye (e-1, e-2, i-1, i-2, c-1, c-2), mod, süre (dk; 0 = süresiz), belirli bulmaca ya da 🎲 rastgele
  — seviye listesi seçili gruba göre daralır, uyumsuz eşleşme seçilemez
- **♻️ Soruyu İptal Et** — o turda dağıtılan tüm puanlar herkesten geri alınır, sıralama yeniden hesaplanır
  (elle yapılan +/− düzeltmeler korunur)
- Öğrenci başına **+5 / −5** puan (İkili Modda tüm takıma), ✏️ isim değiştirme, 🚫 oyundan çıkarma (2 dk aynı isimle giremez)
- İkili Modda ayrıca: **👥 Takımlar** kartı — canlı doluluk, 🔀 Karıştır, 🔗 Seçilenleri Eşle
- **🔔 Tur bitti uyarısı** — son öğrenci/takım da tamamladığında (ya da süre dolduğunda) panelin üstünde
  yeşil bir bildirim çıkar, kısa bir zil çalar ve sekme başlığı yanıp söner. Böylece öğretmen
  başka bir sekmedeyken de haberi olur. Turu öğretmen kendisi bitirir/iptal ederse uyarı çıkmaz.
- **🔒 Girişleri Kilitle** (oyun başladıktan sonra yeni katılım kapanır) · **🔒 İsimleri Kilitle**
- **📣 Sınıfa duyuru** · **🔑 Bulmaca ve çözüm** (yalnız öğretmen görür)
- **📊 Ölçme ve Raporlar** kartı — CSV dışa aktarım, isim↔kod eşlemesi, öğrenci raporu, veli karnesi
  (ayrıntı: [Ölçme ve raporlar](#-ölçme-ve-raporlar))

### Kısayollar (panelde, bir alana yazarken devre dışı)
| Tuş | İşlev |
|---|---|
| `Boşluk` | Duraklat / Devam |
| `B` | Seçili bulmacayla başlat |
| `N` | Rastgele yeni bulmaca başlat |

---

## 📊 Ölçme ve raporlar

Tüm ölçüm işleri öğretmen panelindeki **📊 Ölçme ve Raporlar** kartında toplanır.
Bu verilerin hiçbiri öğrenci ekranında görünmez; zorluk gizliliği aynen sürer.
Kayıtlar **yalnız bellekte** tutulur (Render diski kalıcı değildir) — bu yüzden panel,
dışa aktarılmamış kayıt varsa hem kartın üstünde hem de tur bitti bildiriminde
“raporu indirin” hatırlatması gösterir.

### Olay kaydı — standart şema (13 sütun)

Her cevap/görev için sunucu, **tüm UYCEP Logic oyunlarıyla birebir aynı** şemayla kayıt tutar.
Sütun adları asla değişmez; oyunlar arası birleştirilebilirlik buna bağlıdır.

| Sütun | Bu oyunda ne yazar |
|---|---|
| `zaman` | olayın ISO zaman damgası |
| `oyun` | `izgara-cikarim` |
| `set_veya_paket` | bulmacanın teması (`sihirbazlar`, `boy-sirasi` …) |
| `grup` | `e` / `i` / `c` |
| `ogrenci_kod` | takma ad (`E-01`) — **isim yazılmaz** |
| `gorev_id` | bulmaca id’si (`c-1-03`) |
| `kategori` | bulmacanın düşünme türü (aşağıdaki tablo) |
| `chc` | hedeflenen CHC alanları, `|` ile ayrık (`Gf\|Gsm`) |
| `zorluk` | katman kodu (`e-1` … `c-2`) — yalnız kayıtta ve panelde |
| `sonuc` | `dogru` · `yanlis` · `atlandi` |
| `sure_sn` | tur başlangıcından o ana kadar geçen süre (0,1 sn duyarlıkta) |
| `deneme` | kaçıncı “Kontrol Et” denemesi |
| `ipucu_kullanildi` | bu oyunda ayrı bir ipucu dağıtımı olmadığından daima `0` |

Ne zaman kayıt oluşur:
- **Yanlış “Kontrol Et”** → `yanlis` · **doğru çözüm** → `dogru`
- **Tur kapanınca** (öğretmen bitirdi / süre doldu / herkes bitirdi) o turda hiç cevabı olmayan
  her öğrenci için → `atlandi`
- **Birlikte modunda** doğru çözüm çevrimiçi tüm sınıfa, **İkili Modda** takımın cevabı
  **iki üyeye de** yazılır (puan nasıl dağıtılıyorsa ölçüm de öyle).
- **♻️ Soruyu İptal Et** yalnız puanları geri almaz; o turun **ölçüm kayıtlarını da siler**
  (hatalı/tartışmalı soru veriye karışmasın).

Kategori ve CHC eşlemesi (`lib/olcum.js`; bir bulmacanın kendi `kategori` / `chc` alanı varsa o kullanılır):

| Seviye | `kategori` | `chc` |
|---|---|---|
| `e-1` | `dogrudan` | Gf, Gsm |
| `e-2`, `i-1` | `olumsuz` | Gf, Gsm |
| `i-2` | `coklu-kategori` | Gf, Gsm |
| `c-1` | `kosullu` | Gf, Gsm |
| `c-2` (Einstein) | `konum` | Gf, Gsm, Gv |
| `c-2` (sıralama) | `siralama` | Gf, Gsm, Gv |

### Takma ad (kod) ve isim↔kod eşlemesi
- Öğrenci ilk girişinde otomatik olarak bir koda bağlanır: **E-01, E-02, …**
- Eşleme **yalnız öğretmen panelinde** yaşar: öğrenci tablosunda ayrı bir **Kod** sütunu vardır,
  **🔐 İsim ↔ Kod Eşlemesi** düğmesi tam listeyi açar.
- Kopan/geri dönen öğrenci aynı kodda kalır; oyundan çıkarılıp aynı adla dönen öğrenci de
  eski kodunu geri alır (verisi bölünmesin).

### CSV dışa aktarım
- **İsim modu** seçilir, sonra **📥 CSV İndir**:
  * 🔒 **Kodlu** (araştırma): tam olarak yukarıdaki 13 sütun.
  * 👪 **İsimli** (veli raporu): aynı 13 sütun + sona eklenen tek `ogrenci_ad` sütunu —
    standart sütunlar değişmediği için dosyalar yine birleştirilebilir.
- Dosya her zaman oturumdaki **tüm öğrencileri tek dosyada** içerir.
- Dosya adı: `izgara-cikarim_<grup>_<YYYY-AA-GG>.csv` · UTF-8 BOM’lu (Excel Türkçe karakterleri doğru açar).
- **🧹 Ölçüm Verisini Sıfırla** (kırmızı, onaylı): yeni bir sınıfa geçerken kullanılır;
  kayıtları siler, isim↔kod eşlemesini korur.

### Öğrenci Raporu ekranı
Öğrenci tablosunda **ada** ya da **📄** düğmesine tıklayınca tek ekranda açılır:
genel doğruluk yüzdesi, **kategori bazlı doğruluk dökümü**, ortalama süre, ortalama deneme,
en uzun seri ve ulaşılan kademe. Ekran canlıdır (yeni cevaplar geldikçe tazelenir).

**📂 Geçen oturum CSV’si** yüklenirse aynı ekranda bir karşılaştırma satırı belirir:
`Geçen oturuma göre: %50 → %75 (▲ +25 puan)`. Eşleştirme önce **koda**, kod tutmazsa
**isme** göre yapılır; böylece hem kodlu hem isimli dosyalar kullanılabilir.

### Veli karnesi (A4)
- **🖨 Yazdırılabilir Rapor (A4)** — açık rapordaki öğrencinin tek sayfalık karnesi.
- **🖨 Tüm Karneleri İndir** — sınıftaki her öğrenci için **bir A4 sayfa**, hepsi
  **tek yazdırılabilir belgede** (veli toplantısı öncesi tek tıkla tüm evrak).
- Karne veli dilindedir: kategoriler “Koşullu (eğer–ise) akıl yürütme”, “Sıralama çıkarımı” gibi
  sade başlıklara çevrilir; sonunda kısa bir öğretmen notu ve imza satırı bulunur.
- Açılan pencerede **Yazdır** ya da **PDF olarak kaydet** seçilebilir.

---

## 🎮 Beklerken oynanan mini oyun

Bulmacayı erken bitiren öğrenci “Arkadaşlarını bekliyoruz…” ekranında kalır. Sıkılmasın diye
bu ekranda **🎮 Beklerken oyna** düğmesi vardır: 6 çiftlik bir **hafıza kartı** oyunu (4×3).

- Tamamen istemci tarafındadır ([public/bekleme.js](public/bekleme.js)); **sunucuya hiçbir şey göndermez**
  ve **sınıf puanını etkilemez** — ekranda da böyle yazar.
- Hamle/süre sayacı vardır, kişisel rekor `localStorage`’da tutulur.
- Yalnız bekleme ekranında açılır; tur bitince ya da yeni bulmaca başlayınca kendiliğinden durur.
- Varsayılan olarak **kapalıdır** (tek dokunuşla açılır) — CLAUDE.md’nin “ekranda aynı anda tek odak”
  kuralı gereği bekleyen öğrencinin ekranını kendiliğinden doldurmaz.

---

## Dayanıklılık

- Tüm oyun durumu sunucudadır; istemci yalnızca görüntüler.
- Öğrenciye tarayıcıda saklanan bir oturum kimliği verilir (`localStorage`), kopan bağlantı otomatik yeniden denenir.
- Kopan öğrenci **çevrimdışı 🔴** işaretlenir, listeden ve sıralamadan **silinmez**; geri dönünce puanı,
  işaretleri ve bitirme durumu aynen devam eder. Yeni bir cihazdan aynı isimle girse de aynı kayda bağlanır.
- İkili Modda geri dönen öğrenci **eski takımına ve takımının odasına** otomatik yerleşir; ortak tablo kaybolmaz.
- Oyuncu sayısında üst sınır yoktur (1 de 30 da olur). 12 eşzamanlı bağlantıyla test edilmiştir.

---

## Dosya yapısı

```
server.js              Express + Socket.io, öğretmen girişi (çerez), statik dosyalar
lib/env.js             bağımlılıksız .env yükleyici
lib/puan.js            puanlama sabitleri
lib/takimlar.js        İkili Mod: takım kurulumu, eşleştirme, takım adına denetim
lib/bulmacalar.js      puzzles.json okuma/doğrulama/indeksleme, çözümün ayıklanması
lib/kontrol.js         işaret doğrulama + cevap denetimi (yalnız sunucu)
lib/olcum.js           ölçme standardı: 13 sütunluk olay kaydı, takma ad, CSV, öğrenci özeti
lib/durum.js           oyun durumu: oyuncular, puanlar, tur, kilitler
lib/oyun.js            socket olayları
public/index.html·app.js·izgara.js·style.css    öğrenci
public/bekleme.js      beklerken oynanan hafıza oyunu (yalnız istemci, puana etkisiz)
public/teacher.html·teacher.js                  öğretmen
public/rapor.js        ölçme/rapor arayüzü: CSV, kod eşlemesi, öğrenci raporu, A4 karne
                       (teacher.html/js gibi yalnız girişi yapmış öğretmene servis edilir)
data/puzzles.json      54 bulmaca (e/i/c grupları)
data/cozumler.md       anlatımlı çözümler — ÖĞRETMEN İÇİN, web'e servis edilmez
data/uretec.js         bulmaca üreteci (içerik üretimi için; sunucu bunu kullanmaz)
data/siralama.js       sıralama-çıkarım bulmacaları üreteci (uretec.js'ten SONRA çalıştırılır)
data/temalar.js        içerik sözlüğü: fiil çekimleri, kategori fabrikaları, temalar
data/anlatim.js        adım adım çözüm anlatıcısı (uretec.js ve siralama.js kullanır)
```

---

## Bulmaca havuzu

54 bulmaca: her katmanda 8’er tane, `c-2` katmanında ayrıca 6 sıralama-çıkarım bulmacası:

| Seviye | Grup | Yapı | Tablo | İpucu | İçerik |
|---|---|---|---|---|---|
| `e-1` | e | 2 kategori × 3 öğe | 1 | 3 | **tamamen doğrudan** (“🐻 Ayı 🍯 bal sever.”) — olumsuz/koşullu yok |
| `e-2` | e | 2 kategori × 3 öğe | 1 | 2 | 1 doğrudan + **1 olumsuz** (“🐱 Kedi 🥛 süt sevmez.”) |
| `i-1` | i | 2 kategori × 3 öğe | 1 | 4 | doğrudan + olumsuz |
| `i-2` | i | 3 kategori × 3 öğe | 3 | 5 | + kategoriler arası bağ |
| `c-1` | c | 3 kategori × 4 öğe | 3 | 7–8 | + koşullu (“Ali kedi beslemiyorsa cuma nöbet tutar”) |
| `c-2` | c | 4 kategori × 5 öğe | 6 | 10–12 | Einstein klasiği: sıra, “hemen ardından”, “yan yana” |
| `c-2` (sıralama) | c | 4 kategori × 5 öğe | 6 | 11–12 | **sıralama-çıkarım**: yalnız karşılaştırma ve olumsuzlama (“X, Y’den önce bitirdi”, “Z en uzun değildir”) |

- **e grubu (1.–2. sınıf)** temaları emoji ağırlıklı ve okuma yükü düşüktür: orman sofrası, oyuncak sepeti,
  renkli kalemler, meyve tabağı, taşıtlar, dondurma dükkânı, okul çantası, müzik köşesi.
  Cümlenin öznesi daima ilk kategoridir, her öğede emoji vardır.
- **i / c grubu** temaları: sihirbazlar, gezegenler, tatlılar, hayvan barınağı, müzik atölyesi,
  okul bahçesi, kitap kulübü, spor günü.
- **Sıralama-çıkarım bulmacaları** (`c-2-09` … `c-2-14`): koşu, boy sırası, yaş sırası, yüzme,
  bisiklet turu, fide boyları. İlk kategori sıralıdır (varış / boy / yaş) ve çözüm **tam bir
  sıralamadır**. İpuçlarında mutlak konum verilmez; yalnız şu türler kullanılır:
  * karşılaştırma — “Selin, mavi formalı koşucudan önce bitirdi.”, “Ceyda, basketbol yapan öğrenciden daha kısadır.”
  * bitişiklik — “Kısadan uzuna dizilince önce satranç yapan öğrenci, hemen ardından Baran gelir.”
  * uzaklık — “Yaş sırasında Doruk ile çilek seven kuzen arasında tam 3 kuzen vardır.”
  * olumsuzlama — “Baran en uzun değildir.”, “Onur turu birinci bitirmedi.” (her bulmacada en az iki tane)

`e-2`’de olumsuz ipucu **süs değildir**: üreteç, olumsuz ipucu çıkarıldığında çözümün tekliğinin
bozulduğunu doğrular; yani çocuk gerçekten bir eleme adımı yapar. (3×3’te iki doğrudan ipucu tabloyu
tek başına çözdüğü için `e-2` bilinçli olarak 2 ipucuyla kurulur.)

### e grubu seçiliyken öğrenci arayüzü
Sunucu bulmacanın `grup` alanını gönderir; istemci `e` görünce `<body>`’ye `e-grubu` sınıfını ekler:
- daha büyük yazı (ipuçları ~1.3rem, hücreler 60px) ve **geniş satır aralığı** (`line-height: 2`)
- olumsuz ipuçlarında numaranın yanında **🚫** simgesi + kırmızımsı çerçeve
  (bilgi yalnız renkle verilmez; ekran okuyucular için “olumsuz ipucu” metni de vardır)

Her bulmacanın **tek çözümlü** olduğu, üretim sırasında tüm permütasyonlar taranarak doğrulanmıştır
(`data/uretec.js`, sıralama bulmacaları için `data/siralama.js`); ayrıca gereksiz ipuçları budanmıştır.

### `data/puzzles.json` şeması

JSON yorum desteklemediğinden şema burada belgelenmiştir. Dosya bir **bulmaca dizisidir**:

```jsonc
{
  "id": "c-1-03",              // benzersiz kimlik: <seviye>-<sıra>
  "grup": "c",                 // "e" | "i" | "c" | "p" — öğretmen panelinden seçilir
  "seviye": "c-1",             // i-1 | i-2 | c-1 | c-2
  "tema": "barinak",           // içerik teması (bilgi amaçlı)
  "baslik": "🐾 Hayvan Barınağı",

  "kategoriler": [             // en az 2; HEPSİ aynı sayıda öğe içerir (n)
    { "ad": "Bakıcı", "ogeler": ["Burak", "Duru", "Funda", "Cem"], "sirali": false },
    { "ad": "Hayvan", "ogeler": ["papağan", "kedi", "köpek", "hamster"], "sirali": false }
  ],
  // "sirali": true yalnız c-2'deki "Sıra" kategorisindedir; konum ipuçlarını
  // ("hemen ardından", "yan yana") anlamlı kılar. İlk kategori tablo satırlarını verir.

  "ipuclari": [                // öğrenciye numaralandırılmış olarak gösterilir
    "Cem cumartesi günü nöbet tutar.",
    "Funda kedi beslemiyorsa cumartesi günü nöbet tutar."
  ],

  // İSTEĞE BAĞLI — yalnız e grubunda bulunur, ipuclari ile aynı uzunlukta olmalıdır.
  // "olumsuz" olan ipuçları arayüzde 🚫 ile işaretlenir. Yoksa (i/c grubu) alan null gelir.
  "ipucuTurleri": ["dogrudan", "olumsuz"],

  "cozum": [                   // n satır; her satırda her kategoriden BİR öğe, her öğe tam bir kez
    { "Bakıcı": "Burak", "Hayvan": "papağan" },
    { "Bakıcı": "Duru",  "Hayvan": "hamster" }
  ]
}
```

`cozum` alanı **asla istemciye gönderilmez**; `lib/bulmacalar.js` istemciye giden sürümden onu ayıklar.

### 📖 Anlatımlı çözümler — `data/cozumler.md`

Her bulmacanın **adım adım çıkarımı** ayrı bir dosyadadır. Tahtada göstermek ya da takılan bir öğrenciye
ipucu vermek için birebir uygundur; 54 bulmacanın tamamı yalnızca çıkarım adımlarıyla sonuna kadar çözülür.

Dosya seviyelere göre bölümlenir, her bulmaca kendi `id`’siyle başlıklandırılır:

```
### c-1-03 · 🍰 Tatlı Şöleni
**İpuçları** … **Adım adım çözüm** … **Sonuç** (tablo)
```

Adım türleri:

| Adım | Örnek |
|---|---|
| İpucu uygulama | **İpucu 4** → **Cansu = Kaya** ✔ |
| Tek seçenek kalması | **Dilara** için geriye tek seçenek kaldı: **Işık** ✔ |
| Köprü kategori | **Dilara = Işık** ve **Işık ≠ Buzul** olduğundan **Dilara ≠ Buzul** ✖ |
| Koşullu ipucu | **Berk ≠ Kaya** olduğundan koşul devreye girer: **Berk = Halkalı** ✔ |
| Konum ipucu | **altın** şu sıralarda olamaz: 5. ✖ |
| Sıralama ipucu | **İpucu 4** (aralarında 3 sıra) → **Tuna** şu sıralarda olamaz: 2., 3., 4. ✖ |
| Varsayım (yalnız 5 adet c-2’de) | _Deneyelim:_ **1. = Ceren** olsaydı ipuçları çelişirdi → **1. ≠ Ceren** ✖ |

Öğretmen panelindeki **🔑 Bulmaca ve Çözüm** bölümü bu dosyanın yerini ve o anki bulmacanın başlığını not düşer.
Dosya bilinçli olarak **web üzerinden servis edilmez** (çözüm sızmasın diye); depodan ya da sunucu diskinden okunur.
`node data/uretec.js` çalıştırıldığında `puzzles.json` ile birlikte yeniden üretilir. Sıralama
bulmacaları ayrı bir üreteçten gelir ve dosyanın **sonuna eklenir**; sıralamayı bozmamak için
ikisini şu sırayla çalıştırın:

```bash
node data/uretec.js      # 48 bulmaca — puzzles.json ve cozumler.md'yi SIFIRDAN yazar
node data/siralama.js    # 6 sıralama bulmacası — ikisine de EKLER (aynı id varsa günceller)
```

`data/siralama.js` tekrar tekrar çalıştırılabilir: aynı çıktıyı üretir, dosyaları çoğaltmaz.

### Yeni bulmaca eklemek
1. `data/puzzles.json` içine yukarıdaki şemaya uygun bir nesne ekleyin (elle, `node data/uretec.js`
   ya da sıralama bulmacaları için `node data/siralama.js` ile).
2. Sunucuyu yeniden başlatın; dosya açılışta doğrulanır, hatalı bir kayıt varsa sunucu net bir hata mesajıyla durur.
3. Yeni bir **grup** eklerseniz (`"e"` gibi) öğretmen panelindeki grup listesi kendiliğinden güncellenir.

---

## Erişilebilirlik ve göz konforu

- Açık parşömen zemin + koyu metin (WCAG AA üzeri kontrast), neon ve titreşen renk yok.
- Bilgi asla yalnız renkle verilmez: ✔/✖ simgeleri, 🟢/🔴 rozetleri, metin etiketleri birlikte kullanılır.
- Dokunma hedefleri en az 44px, gövde metni 16px, Poppins.
- Mobil/tablet uyumlu: tablolar kendi içinde yatay kayar, ipucu paneli tabloların altına iner ve katlanabilir.
- `prefers-reduced-motion` desteklenir; sesler tek düğmeyle kapatılabilir (tercih kalıcıdır).
