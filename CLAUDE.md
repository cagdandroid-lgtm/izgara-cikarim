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
- Öğrenci girişi (SINIF OTURUMU MODELİ): Öğrenci / adresinde isim
  YAZMAZ ve grup SEÇMEZ. Oturumun grubu, öğretmenin panelde seçtiği
  set/pakete göre otomatik belirlenir. Öğretmen henüz seçim yapmadıysa
  öğrenci ekranında ortam animasyonlu bir bekleme ekranı görünür
  ("Öğretmenini bekle" tonunda, sayaçsız); set seçildiği an ekran
  kendiliğinden AKTİF grubun öğrenci kartlarına döner: yalnız o grubun
  aktif öğrencileri, baş harfli avatar balonlu büyük kartlar. Öğrenci
  kendi adına dokunarak girer; seçilen isim soluklaşır/kilitlenir
  ("🎮 oyunda" rozeti), öğretmen panelden serbest bırakabilir. Öğrenci
  ekranında hiçbir aşamada diğer grupların isimleri veya sayısı
  görünmez.
- Karma oturum (isteğe bağlı): Öğretmen panelden "karma oturum" açarsa
  girişe grup seçim adımı eklenir: grup kartlarında YALNIZ resmî grup
  adı + emoji + grup rengi bulunur (uydurma takma adlar üretilmez);
  grup seçilince o grubun isim kartları gelir.
- Tek grup oturumu: Bir oyun oturumu TEK gruba aittir. Sahne, lobi ve
  tüm sayaçlar ("X oyuncu sahnede") yalnız AKTİF grubun oyuncularını
  sayar ve gösterir; kilit açıkken farklı gruptan giren öğrenci sahneye
  ve sayaca dahil edilmez, panelde "farklı grup ⚠" işaretiyle ayrı
  listelenir (öğretmen isterse aktif gruba taşır veya çıkarır).
- Misafir öğrenci: Öğretmen panelinden anlık misafir eklenebilir (ad
  girilir); misafir, listeye o oturumluk katılır ve M-01, M-02... kodu
  alır. Misafir kayıtları CSV'de "misafir" işaretiyle tutulur ve
  araştırma setine dahil edilmez.
- Öğrenci Listesi yönetim ekranı: Panelde ogrenciler.json içeriği
  görüntülenir; öğretmen ekleme/düzenleme/pasifleştirme yapabilir.
  Liste, parametrelere göre filtrelenebilir (grup, aktif/pasif) ve
  isim arama kutusu bulunur.
  Değişiklik o oturumda anında geçerlidir; kalıcılık için "Listeyi
  İndir" düğmesi güncel ogrenciler.json'u indirir (öğretmen depoya
  koyup push'lar). Giriş ekranındaki isim kartları, paneldeki grup
  seçimine göre filtrelenir (yalnız o grubun aktif öğrencileri
  görünür). Dersler hibrittir: sınıftaki öğrenciler de
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
- Bekleme ekranı mini oyunu (bireysel modlarda ZORUNLU): Öğrenci soruyu
  bitirip diğerlerini beklerken ekranında küçük bir "sıkılma önleyici"
  oyun belirir. Kurallar:
  * Tamamen istemci tarafında çalışır (sunucuya yük bindirmez), sessizdir
    veya çok kısık seslidir, asıl oyunun puanına HİÇBİR etkisi yoktur
    (en fazla kozmetik bir "bekleme rekoru" gösterebilir).
  * Yeni tur başladığı AN mini oyun anında kaybolur ve asıl oyun ekranı
    döner; öğrenci hiçbir şeye basmak zorunda kalmaz.
  * Aşağıdaki katalogdan TAM 3 mini oyun uygulanır ve her bekleme anında
    rastgele biri gösterilir. Seçim kuralları: (1) asıl oyunun mekaniğine
    benzeyen seçilemez (ör. örüntü oyununa 4-Simon konmaz), (2) mümkünse
    oyunun temasına uyarlanır (uzay oyununda balon yerine meteor
    patlatılır), (3) seçilen üçlü README'ye yazılır. Prompt'ta "şu mini
    oyunları kullanma: ..." satırı varsa o maddeler katalogdan elenir.
  * Mini oyun kataloğu: 1-Balon patlatma (dokundukça patlar) ·
    2-Yıldız yakalama refleksi · 3-Sonsuz mini labirent · 4-Simon
    (diziyi tekrarla) · 5-Emoji hafıza eşleştirme · 6-Serbest karalama
    tuvali · 7-Mini yılan · 8-Top sektirme · 9-Piksel boyama ·
    10-Kelime avı (harf ızgarası) · 11-Hızlı işlem kartları ·
    12-Engelden atlama koşusu.
- Çalışma yapılandırmaları: Mod, PROJE BAŞINA bir tasarım kararıdır —
  her oyun tüm modları desteklemek zorunda DEĞİLDİR; mekaniğine en uygun
  mod(lar) seçilir (tek modlu oyun tamamen geçerlidir) ve seçim README'de
  bir cümleyle gerekçelendirilir. Kullanılabilir yapılandırmalar (oda
  kodu kuralı değişmez — modlar panelden yönetilir, öğrenci kod girmez):
  * BİREYSEL: herkes kendi başına (varsayılan).
  * TAKIM: mevcut takım modu standardı (otomatik eşleştirme, takım
    adı/rengi).
  * BİRLİKTE (Boss Modu): tüm sınıf tek takımdır ve ortak bir "bölüm
    sonu canavarı"na karşı oynar — her öğrencinin doğru cevabı canavarın
    canından düşürür, canavar ekranda büyükçe görünür ve tepki animasyonu
    verir; can bitince sınıfça zafer kutlaması. Yanlış cevap canavara
    can KAZANDIRMAZ (ceza yok, yalnız katkı var). Kayıtlar yine öğrenci
    bazlıdır (kim kaç hasar vurdu panelde görünür, öğrencilere toplam
    gösterilir).
  Akış geçişleri desteklenir: öğretmen "Düşün-Eşleş-Paylaş" akışını
  başlatabilir (önce herkes aynı görevi bireysel çözer, süre bitince
  aynı görev takım moduna döner, takım ortak cevabını verir) ve tersi
  "Önce Birlikte, Sonra Tek Başına" akışı (ortak çözümden sonra herkese
  benzer yeni görev bireysel gelir).
  ÖLÇME KORUNUR: Takım ve Birlikte modlarında da olay kayıtları ÖĞRENCİ
  bazlı tutulur (hangi hamleyi/işareti kimin yaptığı, ogrenci_kod ile);
  kayda ek bir "mod" alanı yazılır (bireysel/takim/birlikte/dep-bireysel
  /dep-takim) ki analizde bireysel performans ile grup içi performans
  ayrıştırılabilsin. README'de oyunun hangi modları desteklediği ve
  gerekçesi yazılır.
- Takım modu değerlendirmesi: Her yeni oyunda, mekaniğin ikili/takımlı
  çalışmaya uygun olup olmadığı geliştirme sırasında DEĞERLENDİRİLİR.
  Uygunsa "Takım Modu" eklenir, uygun değilse README'ye tek cümlelik
  gerekçe yazılır. Takım modu standardı:
  * Öğrenciye görünen oda kodu YOKTUR. Öğretmen panelinden takım modu
    başlatılır; sunucu öğrencileri otomatik ikişerli (veya öğretmenin
    seçtiği boyutta) takımlara ayırır, öğretmen eşleşmeleri elle
    değiştirebilir ve "Karıştır" diyebilir. Takımlar sunucu tarafında
    Socket.io odaları olarak kurulur.
  * Takım kurulunca öğrenciler kısa bir "takım hazırlığı" ekranı görür:
    hazır eğlenceli isim önerilerinden seçerek veya yazarak takım adı,
    renk paletinden takım rengi belirlerler (eşler birlikte karar verir,
    ilk onaylanan geçerli olur; uygunsuz isimleri öğretmen panelden
    değiştirebilir). Takım rengi skor tablosuna ve öğrenci ekranına
    yansır.
  * Takım içi durum paylaşımı canlıdır (birinin hamlesi eşinde anında
    görünür); puan takım adına yazılır ve tüm üyelere eşit yansır; kopan
    üye geri gelince aynı takıma döner; soru iptali ve manuel puan
    düzeltme takım bazında çalışır.

## Yarış modu skor deneyimi (yarış formatlı tüm oyunlarda ZORUNLU)
- Puanlama: temel puan + hız bonusu (erken doğru cevap daha çok kazanır)
  + seri çarpanı (üst üste doğrularda artan bonus, ekranda büyüyen 🔥
  simgesi; yanlışta seri sıfırlanır). Hesap daima sunucuda yapılır.
- Soru arası sıralama ekranı (Kahoot ritmi): her sorudan sonra 3-5
  saniyelik sonuç sahnesi:
  * Önce kişisel sonuç: doğru/yanlış animasyonu, kazanılan puan sayaç
    animasyonuyla artar, sıra değişimi okla gösterilir ("▲ 2 sıra
    yükseldin!").
  * Ardından İLK 3/5 podyumu herkese gösterilir (isim + puan, gerilim
    için alttan üste sırayla belirir). İlk 5 dışındaki öğrenci kendi
    sırasını YALNIZ kendi ekranında görür ("Sıran: 9/14"); tam liste
    hiçbir öğrenci ekranında yayınlanmaz.
  * Her öğrenci bir üstündekiyle puan farkını görür ("Öndeki oyuncuya
    35 puan!") — kovalamaca hissi verir, kimseyi aşağıya bakmaya zorlamaz.
- Geri bildirim sözleri: Cevap sonrası kişisel sonuç ekranında duruma
  özel, SICAK ve çeşitli Türkçe cümleler gösterilir; her durum için en
  az 8 cümlelik havuzdan rastgele seçilir (üst üste aynı cümle gelmez).
  Durumlar: doğru ("Harikasın! 🎉", "Tam isabet! 🎯"), hızlı doğru
  ("Şimşek gibisin! ⚡"), seri devam ("🔥 3'te 3! Bu seri yanıyor!"),
  seri bozuldu ("Seri bitti ama sen bitmedin! 💪"), yanlış ("Olsun,
  sıradakini yakalarsın! 🌱", "İyi denemeydi, devam! 🚀"), sıra yükseldi
  ("2 sıra birden! 📈"). Yanlış cevap cümleleri asla alaycı veya
  utandırıcı olamaz; kısa, cesaretlendirici ve çocuk dostudur.
- Final podyumu: oyun sonunda ilk 3 için sahneli kapanış (3-2-1 sırayla,
  konfeti + ses). Diğerleri kendi ekranında kişisel özetini görür: sırası,
  toplam puanı, en uzun serisi ve kazandığı rozetler.
- Rozetler (puandan bağımsız onur ödülleri, kapanışta dağıtılır):
  🚀 En Hızlı Parmak (en hızlı doğru) · 🔥 Seri Ustası (en uzun seri) ·
  📈 Yükseliş Yıldızı (en çok sıra kazanan) · 🎯 Keskin Nişancı (en
  yüksek doğruluk). Amaç: podyuma giremeyenlerin de sahnelenebilmesi.
- Sıralama gösterim akışı (öğretmen kontrollü, üç aşamalı):
  1) HAZIRLIK: Öğretmen panelden "Sıralamayı Göster" sürecini başlatır
     ve bir çekilme süresi seçer (5 / 10 / 20 / 30 sn). Tüm öğrenci
     ekranlarında sıralama bekleme ekranı açılır: "📊 Sıralamalar
     birazdan ekranına gelecek" + geri sayım + büyük bir "Sıralamamı
     görmek istemiyorum 🙈" düğmesi.
  2) ONAY: Süre bitince öğretmen panelinde kaç öğrencinin çekildiği
     görünür ve "Gönder" onay düğmesi belirir; sıralamalar ancak
     öğretmen onaylayınca yayınlanır (otomatik gönderilmez).
  3) GÖSTERİM: Çekilmeyen her öğrenci KENDİ ayrıntısını görür: sırası,
     puanı, bir üstüyle farkı, serisi. Çekilen öğrenci nötr bir ekran
     görür ("Skorun hazır, istediğinde bakabilirsin") ve dilerse
     "Göster" diyerek fikrini değiştirebilir; kimin çekildiği diğer
     öğrencilere hiçbir şekilde belli edilmez.
- Tam liste modu (aynı akışın içinde, öğretmen seçimiyle): Öğretmen
  "Gönder" onayından önce liste kapsamını ve isim modunu seçer:
  * Kapsam: "Yalnız kendi ayrıntısı" (varsayılan) veya "Tam liste".
  * İsim modu (tam listede): "İsimler Açık" (herkes isimli tam listeyi
    görür) veya "İsimler Gizli" (liste anonim gelir: yalnız sıra
    numaraları ve puanlar; her öğrencinin kendi satırı yalnız kendi
    ekranında isimli ve vurguludur).
  * Çekilme tercihi tam listede de geçerlidir: çekilen öğrencinin adı
    isimli listede "🎭" olarak maskelenir, sıra yeri korunur.
- "Sıralamayı Gizle" düğmesi ayrıca durur: o tur podyum sahnesi dahil
  hiçbir sıralama gösterilmez (p/e veya hassas günler için).
- Sıralama hiçbir görünümde zorluk katmanını ele vermez (Zorluk
  gizliliği bölümü geçerlidir).

## CHC hizalaması (yeni projelerde ZORUNLU)
- Her oyun, CHC (Cattell-Horn-Carroll) kuramının geniş yetenek
  alanlarından BİR birincil ve en fazla İKİ ikincil alanı hedefler ve
  bunu README'de gerekçesiyle beyan eder. Kullanılan kısaltmalar:
  Gf (akıcı akıl yürütme) · Gv (görsel-uzamsal işleme) · Gq (nicel
  bilgi/akıl yürütme) · Gsm (kısa süreli/çalışma belleği) · Gs (işlem
  hızı) · Gc (kristalize/sözel bilgi) · Glr (uzun süreli bellekten
  geri getirme).
- data dosyalarındaki her görev/seviye "chc" alanıyla etiketlenir
  (ör. "chc": ["Gf","Gs"]). CHC bilgisi panelde AÇIKTA DURMAZ; yalnız
  "Etkinlik Bilgisi" modalinin CHC sekmesinde yer alır (aşağıdaki
  Etkinlik bilgi modali bölümüne bak).
- CHC etiketleri ÖĞRENCİ ekranında hiçbir yerde gösterilmez (zorluk
  gizliliğiyle aynı ilke: pedagojik iskelet öğretmene görünür,
  öğrenciye oyun görünür).
- Tasarım dengesi: hız turları Gs'yi, not/hafıza öğeleri Gsm'yi,
  açıklama isteyen yıldızlı görevler Gf derinliğini bilinçli hedefler;
  oyunun eğlence öğeleri hedef alanların önüne geçmez.

## Üstün yetenekli farklılaştırması (M3'ten itibaren ZORUNLU)
- Kişi bazlı seviye atama: Varsayılan, öğretmenin seçtiği grup
  seviyesidir; ancak öğretmen panelinde her öğrencinin satırından o
  öğrenciye FARKLI bir zorluk katmanı atanabilir (ör. grup c-1'de
  oynarken bir öğrenciye c-2 verilebilir). Atama tur ortasında değil,
  bir sonraki soru/bulmacadan itibaren geçerli olur.
- Tavansız yol: Erken bitiren öğrenci asla boş beklemez; otomatik olarak
  bir üst zorlukta yeni içerik alır ("sonsuz mod" tüm oyunlarda geçerli
  ilkedir). Bekleme mini oyunu, ancak üst içerik de bittiğinde devreye
  girer.
- Yıldızlı derinlik görevleri: Uygun oyunlarda, hız değil AÇIKLAMA
  isteyen bonus görevler bulunur ("Bu bulmacanın neden tek çözümü var?",
  "Stratejini bir cümleyle yaz"). Cevaplar öğretmen panelinde listelenir;
  puan yerine rozet kazandırır.

## Ölçme ve veri standardı (TÜM OYUNLARDA ZORUNLU)
- Olay kaydı: Her cevap/görev için sunucu, TÜM OYUNLARDA BİREBİR AYNI
  şemayla kayıt tutar:
  zaman (ISO), oyun, set_veya_paket, grup, ogrenci_kod, gorev_id,
  kategori, chc, zorluk, sonuc (dogru/yanlis/atlandi), sure_sn,
  deneme, ipucu_kullanildi. Sütun adları asla değiştirilemez —
  oyunlar arası birleştirilebilirlik (ve akademik analiz) buna bağlıdır.
- Takma ad (pseudonym): Kayıtlarda öğrencinin ADI değil KODU yazılır
  (ör. E-07). Kodlar KALICI ana listeden gelir: her depoda data/
  ogrenciler.json (isim ↔ kod; TÜM oyunlarda aynı dosya, dönem başında
  bir kez oluşturulur) — oyun, girilen ismi bu listeyle eşleştirir ve
  aynı öğrenci her hafta her oyunda AYNI kodu alır. Listede olmayan
  isim girilirse panelde uyarı çıkar ve öğretmen eşleme yapar. Depolar
  PRIVATE tutulur. Demografik bilgi (doğum tarihi vb.) sisteme asla
  girilmez; öğretmenin çevrimdışı dosyasında kodla eşlenir. CSV dışa
  aktarımında öğretmen "isimli" (veli raporu için) veya "kodlu"
  (araştırma için) seçer.
- CSV dışa aktarım: Oturum sonunda tek tık; Render diski kalıcı
  olmadığından veri bellekte tutulur ve ders bitiminde "raporu indir"
  hatırlatması gösterilir. Dosya adı standardı:
  <oyun>_<grup>_<tarih>.csv
- Öğrenci Raporu görünümü: Panelde öğrenciye tıklanınca tek ekran:
  genel doğruluk yüzdesi, KATEGORİ bazlı doğruluk dökümü, ortalama
  süre, ulaşılan kademe/seri. "Yazdırılabilir rapor" düğmesi: A4, sade,
  veli diline uygun başlıklarla tek sayfalık öğrenci karnesi üretir
  (yazdır/PDF). Önceki oturum CSV'si içe aktarılırsa aynı ekranda
  "geçen oturuma göre değişim" satırı görünür.
- Toplu indirme: CSV her zaman oturumdaki TÜM öğrencileri tek dosyada
  içerir. Ayrıca panelde "Tüm Karneleri İndir" düğmesi bulunur: sınıftaki
  her öğrencinin karnesini, öğrenci başına bir A4 sayfa olacak biçimde
  TEK yazdırılabilir belgede üretir (veli toplantısı öncesi tek tıkla
  tüm evrak hazır olur).
- Bu verilerin hiçbiri öğrenci ekranında görünmez; zorluk gizliliği
  ve sıralama kuralları aynen sürer.
- Süreç verisi (Katman-2, YALNIZ "araştırma oyunu" işaretli projelerde):
  Cevap düzeyi kayıt (12 sütun) her oyunda zorunludur ve Rasch madde
  kalibrasyonu için yeterlidir. Buna ek olarak araştırma oyunu seçilen
  projelerde olay bazlı süreç akışı tutulur: her etkileşim
  [zaman(ms), ogrenci_kod, mod, eylem, detay] satırı olarak kaydedilir
  (tıklama, işaret koyma/silme, bekleme başlangıcı, arkadaş hamlesi
  sonrası düzeltme, çakışma). Ayrı bir "olaylar.csv" olarak dışa
  aktarılır. Amaç: işbirlikli göstergelerin (senkronizasyon, bekleme,
  rol paylaşımı) sonradan puanlanabilmesi. Hangi projelerin araştırma
  oyunu olduğu bilinçli seçilir; her oyuna yayılmaz.

## Etkinlik bilgi modali ve veli özeti (TÜM OYUNLARDA ZORUNLU)
- Öğretmen panelinin sağ üst köşesinde göze batmayan bir "ℹ️ Etkinlik
  Bilgisi" düğmesi bulunur; tıklanınca ÜÇ SEKMELİ bir modal açılır.
  Günlük akışta hiçbir sekme kendiliğinden görünmez; bilgi yalnız
  istenince gelir. Sekmeler:
  * KAZANIMLAR: Bu etkinliğin hedeflediği 3-4 maddelik sade kazanım /
    geliştirilen beceri listesi ("Örüntü kuralını keşfeder", "Eleme
    yaparak çıkarımda bulunur" gibi). Kaynak: proje kökündeki
    ETKINLIK_BILGI.json dosyasının "kazanimlar" alanı.
  * CHC: Birincil ve ikincil CHC alanları, birer cümlelik gerekçeyle.
    Kaynak: aynı dosyanın "chc" alanı.
  * VELİ ÖZETİ: Veli toplantısında okunabilecek, eğitim jargonu
    içermeyen 2-3 cümlelik sıcak bir anlatım: "Bu hafta çocuklarımızla
    ... çalıştık; bu etkinlik ... becerisini geliştirir; evde ...
    diye sorabilirsiniz." Yanında tek tıkla "Kopyala" düğmesi (WhatsApp
    veli grubuna yapıştırmak için). Kaynak: aynı dosyanın "veli_ozeti"
    alanı.
- Her proje kökünde ETKINLIK_BILGI.json bulunur: { kazanimlar: [...],
  chc: { birincil, ikincil, gerekce }, veli_ozeti: "..." }. Aynı içerik,
  uygulama ÇALIŞTIRILMADAN okunabilsin diye ETKINLIK_BILGI.md adlı düz
  bir dosyada da depoda durur (kazanımlar + CHC + veli özeti bir arada;
  diskten veya GitHub'dan doğrudan açılıp okunur/yazdırılır).
- Set tabanlı oyunlarda (KHLike gibi) bu bilgiler SET BAŞINA tutulur:
  her set JSON'ına kazanimlar ve veli_ozeti alanları eklenir; modal,
  seçili sete göre içerik gösterir.
- Öğrenci ekranında bu modal ve içerikleri hiçbir biçimde görünmez.

## Zorluk gizliliği (TÜM OYUNLARDA ZORUNLU)
- Zorluk seviyeleri öğrenci ekranında ASLA gösterilmez: "kolay/zor",
  "seviye 2", "e-1 / c-2" gibi etiketler, kademe adları veya zorluk
  simgeleri öğrenci arayüzünün hiçbir yerinde (soru ekranı, bekleme
  ekranı, skor tablosu, sonuç ekranı) yer almaz.
- Katman kodları (e-1, c-2 vb.) yalnız data dosyalarında ve öğretmen
  panelinde yaşar. Öğrenciler birbirlerinin hangi zorlukta oynadığını
  hiçbir ekrandan çıkaramaz; skor tablosu zorluk farkını ele vermez.
- Sunucudan öğrenci istemcisine giden veri paketlerinde zorluk alanı
  bulunmaz (yalnız bulmacanın kendisi gider) — teknik meraklı bir
  öğrencinin tarayıcı konsolundan seviyesini görmesi de mümkün olmaz.

## İçerik ayrımı
- Sorular, seviyeler, bulmaca tanımları ASLA koda gömülmez; /data altında
  JSON olarak tutulur. JSON şemasını dosya başında yorumla belgele
  (JSON yorum desteklemediği için şemayı README.md'ye yaz).
- Her içerik dosyasında "grup" alanı bulunur: "e", "i", "c" (gerekirse "p").
  Öğretmen panelinden grup seçilince yalnız o grubun içeriği yüklenir.

## Arayüz
- Dil: Türkçe. Ton: sıcak, oyunlaştırılmış, emoji kullanımı serbest.
- Renk paleti SERBEST ama YAŞ GRUBUNA UYGUN ve CANLI olmalıdır; soluk,
  kasvetli, "kurumsal" paletler (kahverengi-beyaz, gri-bej vb.) çocuk
  oyunlarında YASAKTIR. Yaş katmanları:
  * p/e: parlak, neşeli, sıcak renkler; büyük yuvarlak öğeler, sevimli
    emoji/maskot kullanımı.
  * i: enerjik ve doygun ama çocuksu olmayan tonlar.
  * c: modern, oyunsu-havalı bir dil (koyu zemin + canlı vurgu renkleri
    olabilir); asla sıkıcı ofis görünümü değil.
- Animasyon ve ses (öğrenci ekranlarında ZORUNLU temel özellik):
  * Giriş ekranı dahil önemli anlarda küçük, kısa animasyonlar: karşılama
    animasyonu, doğru cevapta kutlama (konfeti/yıldız), tur geçişlerinde
    yumuşak geçiş efekti, sıralama değişiminde hareket.
  * Giriş/lobi ekranında arka planda hafif bir ORTAM ANİMASYONU zorunludur:
    canvas ile süzülen partiküller, yüzen tema öğeleri (yıldız, balon,
    sembol vb.) — düşük yoğunluk, yavaş hareket, CPU dostu, temaya uygun.
    Aynı ambiyans bekleme ve skor ekranlarında da kullanılabilir.
  * SORU/OYUN ekranında ise arka plan animasyonu YOKTUR; oyun sırasında
    animasyonlar yalnız GERİ BİLDİRİM ve GEÇİŞ anlarında oynar (dikkat
    dağıtmasın). prefers-reduced-motion ayarına saygı gösterilir.
  * Kısa ve yumuşak ses efektleri: katılım "pop" sesi, doğru/yanlış
    tonları, tur başlama sesi. Web Audio API ile kod içinde üretilebilir
    veya küçük dosyalar kullanılabilir; ses varsayılan olarak AÇIK ama
    düşük seviyede başlar ve her öğrenci ekranında tek dokunuşla
    kapatılabilir (🔇 düğmesi, tercih hatırlanır).
- Öğretmen paneli düzeni (tüm oyunlarda ZORUNLU): Panel, AÇILIR-KAPANIR
  bölümlerden oluşur (akordeon). Varsayılan AÇIK gelenler yalnız oyunu
  oynatmak için gerekenlerdir: oyun akış kontrolleri (set/paket seçimi,
  başlat/duraklat, soru-tur ilerletme) ve canlı oyun durumu. Diğer her
  şey varsayılan KAPALI başlar: sıralama sahnesi kontrolleri (oyun
  başlayınca açılabilir), raporlar/CSV, ayarlar ve EN SONDA Öğrenci
  Listesi yönetimi. Bölüm başlıkları tek tıkla açılır; panelin üstü
  hep sade kalır.
- Öğretmen paneli düğme renk kodu (tüm oyunlarda TUTARLI ve ZORUNLU):
  * Başlat / Devam: yeşil · Duraklat: sarı · Turu/Soruyu bitir ve
    geçersiz kıl: kırmızı · Sıfırla ve yıkıcı işlemler: kırmızı, üstelik
    onay sorusuyla · Bilgi/gezinme düğmeleri: mavi/gri.
  * Düğmelerde renkle birlikte ikon ve metin de bulunur (yalnız renkle
    ayrım yapılmaz); yıkıcı düğmeler diğerlerinden uzağa yerleştirilir.
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
- Set/paket teması (platform oyunlarında ZORUNLU): Set tabanlı oyunlarda
  (KHLike, P Atölyesi) her set/paket kendi görsel kimliğiyle gelir — set
  JSON'ında "tema" alanı: etkinlik adı (öğrenciye oyunun adı olarak bu
  gösterilir, platform adı değil), renk paleti, arka plan dünyası, lobi
  ambiyansı ve uygunsa ikon/maskot varyantı. Amaç: aynı motorun her hafta
  YENİ BİR OYUN olarak algılanması ("yine aynı şey" yorgunluğunu önler).
  Tema yalnız görünümü değiştirir; mekanik, ölçme ve panel aynı kalır.
- Doğru cevapta konfeti/kutlama animasyonu, yanlışta nazik geri bildirim.
  Sesler opsiyonel ve kapatılabilir.

## Kalite
- Tek dosyada 400 satırı geçen JS'i mantıklı modüllere böl.
- Sunucu, istemciden gelen her veriyi doğrular (cevap kontrolü daima
  sunucuda yapılır; istemcide cevap sızdırılmaz).
- console.log ile temel olay günlüğü tut (katılım, cevap, tur değişimi).
- README.md: kurulum, oyun akışı, JSON şeması, öğretmen kısayolları.