# UYCEP Logic Oyun Standartları

Bu proje, UYCEP Logic dersi için çok oyunculu bir sınıf içi web oyunudur.
Aşağıdaki standartlara İSTİSNASIZ uy:

## Teknoloji
- Node.js + Express + Socket.io (başka framework yok, build adımı yok, vanilla JS)
- Dosya yapısı: server.js, package.json, /public (index.html, app.js, style.css,
  teacher.html, teacher.js), /data (questions.json vb. tüm içerik dosyaları)
- package.json: "start": "node server.js"; bağımlılıklar yalnızca express ve socket.io
- Port: process.env.PORT || 3000 (Render uyumu için zorunlu)

## Roller ve akış
- Öğrenci: / adresinden isim girerek katılır. Oda kodu YOK; herkes tek
  sınıf odasına bağlanır. Dersler hibrittir: sınıftaki öğrenciler de
  uzaktan (Zoom/Jitsi üzerinden derse katılan) öğrenciler de aynı
  bağlantıyı kullanır; oyun bu iki durum arasında hiçbir ayrım yapmaz.
- Öğretmen: /teacher rotası. teacher.html'e doğrudan erişim engellenir;
  cookie tabanlı basit şifre girişi (admin_auth=true). Şifre ASLA koda
  sabit metin olarak gömülmez; process.env.ADMIN_PASSWORD ortam
  değişkeninden okunur (yerelde .env dosyasından, Render'da panelden
  girilen değerden gelir — böylece iki ortamda farklı şifre kullanılabilir
  ve şifre GitHub deposuna hiç yazılmaz). .env dosyası .gitignore'a eklenir.
  ADMIN_PASSWORD tanımlı değilse davranış ortama göre ayrılır:
  * YEREL geliştirmede (process.env.RENDER yoksa): sunucu otomatik olarak
    varsayılan yerel şifre "uycep-local" ile çalışır — .env dosyası
    oluşturmak ZORUNLU DEĞİLDİR, npm start tek başına yeterlidir.
  * RENDER'da (process.env.RENDER varsa): varsayılan şifre KULLANILMAZ;
    sunucu konsola büyük bir uyarı basar ve /teacher girişini
    "ADMIN_PASSWORD tanımlanana kadar kapalı" tutar. Şifre Render
    panelinden Environment sekmesinde tanımlanır.
  Sunucu her başladığında konsola "🔑 Öğretmen paneli şifresi: <değer>"
  satırını basar (Render'da bu yalnız hesap sahibinin gördüğü loglara
  yazılır). İsteyen yerelde de .env dosyasıyla kendi şifresini
  belirleyebilir; .env varsa varsayılan yerine o kullanılır.
- Öğretmen paneli her oyunda şunları yapabilmeli: bağlı öğrenci listesi,
  oyunu başlat/duraklat/sıfırla, zorluk/seviye seçimi, canlı skor tablosu,
  gerekiyorsa soru/tur ilerletme.
- Öğrenci bağlantısı koptuğunda skoru korunur; aynı isimle dönünce kaldığı
  yerden devam eder.
- Oyuncu sayısına ASLA yapay bir üst sınır koyma (MAX_PLAYERS gibi sabitler
  yasak). Sınıf mevcudu değişkendir; oyun 1 öğrenciyle de 30 öğrenciyle de
  çalışmalıdır. Testler en az 10 eşzamanlı bağlantıyla yapılır ama bu bir
  tavan değil, alt kalite çıtasıdır.

## Sınıf yönetimi ve dayanıklılık (HER OYUNDA ZORUNLU)
- Puan geri alma: Öğretmen "Soruyu İptal Et" dediğinde o sorudan dağıtılan
  tüm puanlar herkesten otomatik geri alınır ve sıralama yeniden hesaplanır
  (hatalı/tartışmalı soru durumu için). Ayrıca öğretmen herhangi bir
  öğrencinin puanını manuel düzeltebilir (+/- puan girişi).
- Bağlantı dayanıklılığı: Tüm oyun durumu sunucuda tutulur; istemci yalnız
  görüntüler. Öğrenciye tarayıcıda saklanan bir oturum kimliği verilir;
  kopan bağlantıda otomatik yeniden bağlanma denenir. Kopan öğrenci
  "çevrimdışı 🔴" işaretlenir ama listeden ve sıralamadan SİLİNMEZ; geri
  dönünce puanı, turu ve sırası aynen kaldığı yerden devam eder.
- Katılımcı yönetimi: Öğretmen bir oyuncuyu atabilir (atılan, kısa süre
  aynı isimle geri giremez), ismini değiştirebilir ve isimleri
  kilitleyebilir. "Girişleri Kilitle" düğmesi: oyun başladıktan sonra
  yeni katılım kapatılabilir.
- Duraklat: Öğretmen oyunu her an duraklatabilir; tüm öğrenci ekranları
  "⏸ Öğretmeninizi dinleyin" durumuna geçer, süreler donar.

## İçerik ayrımı
- Sorular, seviyeler, bulmaca tanımları ASLA koda gömülmez; /data altında
  JSON olarak tutulur. JSON şemasını dosya başında yorumla belgele
  (JSON yorum desteklemediği için şemayı README.md'ye yaz).
- Her içerik dosyasında "grup" alanı bulunur: "e", "i", "c" (gerekirse "p").
  Öğretmen panelinden grup seçilince yalnız o grubun içeriği yüklenir.

## Arayüz
- Dil: Türkçe. Ton: sıcak, oyunlaştırılmış, emoji kullanımı serbest.
- Renk paleti SERBEST: her oyun, temasına uygun kendi paletini seçebilir
  (uzay oyunu koyu tonlar, kripto oyunu parşömen tonları vb.). Zorunlu
  kurumsal renk yoktur.
- Göz konforu kuralları (paletten bağımsız, zorunlu):
  * Yüksek kontrast: metin/zemin kontrastı en az WCAG AA düzeyinde;
    açık zeminde koyu metin tercih edilir.
  * Neon, aşırı doygun veya titreşen renk kombinasyonlarından kaçın;
    yumuşak, pastel veya dengeli tonlar kullan.
  * Bilgi asla yalnız renkle verilmez (renk + ikon/desen/etiket birlikte);
    renk körü öğrenciler gözetilir.
  * Sade yerleşim: ekranda aynı anda tek odak; gereksiz süsleme,
    kalabalık panel ve sürekli hareket eden dekor yok.
- Kullanım kolaylığı: Mobil ve tablet uyumlu, büyük dokunma hedefleri
  (en az 44px), okunaklı yazı boyutları (gövde metin 16px+), net ve
  kısa yönergeler. Font: Poppins veya benzeri okunaklı bir sans-serif.
- Doğru cevapta konfeti/kutlama animasyonu, yanlışta nazik geri bildirim.
  Sesler opsiyonel ve kapatılabilir.

## Kalite
- Tek dosyada 400 satırı geçen JS'i mantıklı modüllere böl.
- Sunucu, istemciden gelen her veriyi doğrular (cevap kontrolü daima
  sunucuda yapılır; istemcide cevap sızdırılmaz).
- console.log ile temel olay günlüğü tut (katılım, cevap, tur değişimi).
- README.md: kurulum, oyun akışı, JSON şeması, öğretmen kısayolları.