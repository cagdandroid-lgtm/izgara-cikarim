/* Öğrenci istemcisi: yalnız görüntüler ve hamle yollar. Tüm doğrulama sunucuda. */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const socket = io({ reconnection: true, reconnectionDelay: 800, reconnectionDelayMax: 4000 });

  const durumum = {
    sid: localStorage.getItem('izgara_sid') || null,
    kod: localStorage.getItem('izgara_kod') || null,
    grubum: localStorage.getItem('izgara_grup') || null,   // yalnız "kendi grubunu bekle" için
    ad: '',
    katildi: false,
    bulmacaAnahtari: null,
    ses: localStorage.getItem('izgara_ses') !== 'kapali',
    sonKamu: null,
    sonLobi: null
  };

  /* ---------------- giriş: SINIF OTURUMU MODELİ ----------------
     Ekran çizimi public/giris.js'te; burada yalnız katılım akışı var. */
  Giris.kur((kod) => katil(kod), () => {          // "yine de göster": grup hafızasını unut
    durumum.grubum = null;
    localStorage.removeItem('izgara_grup');
    Giris.ciz(durumum.sonLobi);
  });
  SoruAlani.kur(socket);

  socket.on('lobi', (l) => {
    durumum.sonLobi = l;
    if (durumum.katildi) return;                 // oyundakini rahatsız etme
    // (3) başka grubun etkinliği yayındaysa öğrenci KENDİ grubu açılana kadar bekler
    if (l && l.secimYapildi && durumum.grubum && l.grup !== durumum.grubum) {
      $('#bekleme').hidden = false;
      $('#isimSecim').hidden = true;
      $('#oyun').hidden = true;
      Ambiyans.basla();
      Giris.not('Şu an başka bir grubun etkinliği var. Kendi grubunu bekle. ⏳', true);
      return;
    }
    if (l && l.secimYapildi) Giris.not('');      // kendi grubu yayında: eski uyarı kalkar
    Giris.ciz(l);
  });

  /* "C-04" → "c" · misafirlerde (M-01) grup bilinmez, hafıza kurulmaz */
  function grubuCikar(kod) {
    const h = String(kod || '').charAt(0).toLocaleLowerCase('tr');
    return 'peic'.includes(h) && h ? h : null;
  }

  function katil(kod) {
    socket.emit('katil', { kod, sid: durumum.sid }, (cevap) => {
      if (!cevap || cevap.hata) {
        // (3) eski grup koruması: yayınlanan grup başkasınınsa cihazdaki kimlik bırakılır,
        // öğrenci kendi grubu yayınlanana kadar bekleme ekranında kalır
        if (cevap && cevap.baskaGrup) {
          durumum.kod = null;
          durumum.sid = null;
          durumum.grubum = grubuCikar(kod);      // kendi grubu yayınlanana kadar beklesin
          localStorage.removeItem('izgara_kod');
          localStorage.removeItem('izgara_sid');
          if (durumum.grubum) localStorage.setItem('izgara_grup', durumum.grubum);
          Giris.not(cevap.hata, true);
          $('#bekleme').hidden = false;
          $('#isimSecim').hidden = true;
          return;
        }
        return Giris.hata((cevap && cevap.hata) || 'Bağlanılamadı.');
      }
      durumum.sid = cevap.sid;
      durumum.kod = cevap.kod;
      durumum.ad = cevap.ad;
      durumum.katildi = true;
      localStorage.setItem('izgara_sid', cevap.sid);
      localStorage.setItem('izgara_kod', cevap.kod);
      durumum.grubum = grubuCikar(cevap.kod);
      if (durumum.grubum) localStorage.setItem('izgara_grup', durumum.grubum);
      Giris.gizle();
      Giris.not('');
      $('#oyun').hidden = false;
      Giris.hata('');
    });
  }

  socket.on('connect', () => {
    if (durumum.sid && durumum.kod) katil(durumum.kod);   // kopan bağlantıda otomatik dönüş
  });
  socket.on('disconnect', (sebep) => {
    if (durumum.katildi) {
      Ortu.goster('📡', 'Bağlantı koptu', 'Yeniden bağlanmaya çalışıyorum… Puanın duruyor, merak etme.');
      return;
    }
    // oyunda değilken sunucu kaynaklı kopmada isim kartları canlı kalsın
    if (sebep === 'io server disconnect') setTimeout(() => { if (!socket.connected) socket.connect(); }, 400);
  });
  /* KİMLİK YAŞAM DÖNGÜSÜ — öğretmen çıkardığında ya da ismi serbest bıraktığında:
     cihazdaki kimlik silinir, oyun görünümü kapanır, isim seçme ekranı açılır.
     (Sayfa yenilemede normal dönüş sürer: kimlik dururken sid+kod ile kaldığı yerden devam eder.) */
  function kimligiSil(mesaj) {
    durumum.katildi = false;
    durumum.sid = null;
    durumum.kod = null;
    durumum.ad = '';
    durumum.bulmacaAnahtari = null;
    localStorage.removeItem('izgara_sid');
    localStorage.removeItem('izgara_kod');
    Ortu.gizle();
    $('#oyun').hidden = true;
    Giris.ciz(durumum.sonLobi);
    Giris.hata(mesaj);
  }

  socket.on('atildin', () => {
    kimligiSil('Öğretmenin seni oyundan çıkardı. Birkaç dakika sonra adına yeniden dokunabilirsin. 🚪');
    // sunucu bağlantıyı kapatır ("io server disconnect" kendiliğinden yeniden bağlanmaz);
    // isim kartları CANLI kalsın diye hemen yeniden bağlanıyoruz — çocuk ölü ekranda kalmasın
    setTimeout(() => { if (!socket.connected) socket.connect(); }, 400);
  });

  socket.on('serbest', () => {
    kimligiSil('Öğretmenin ismi serbest bıraktı. Kendi adına dokunabilirsin. 🔓');
  });

  /* Öğretmen etkinliği bitirdi: oyun görünümü kapanır, kimlik silinir, bekleme ekranına dönülür */
  socket.on('etkinlikBitti', () => {
    kimligiSil('');
    Giris.not('⏹ Etkinlik bitti. Öğretmenin yeni bir etkinlik açmasını bekliyoruz.');
  });

  /* ---------------- durum akışı ---------------- */
  socket.on('durum', (d) => {
    if (!d.ben) return;
    durumum.sonKamu = d;
    ciz(d);
  });

  socket.on('ortakIsaret', ({ p, c, d }) => {
    const mod = durumum.sonKamu && durumum.sonKamu.mod;
    if (mod === 'birlikte' || mod === 'ikili') Izgara.disaridanIsaret(p, c, d);
  });

  // İkili mod: cevap takım adına verilir, sonuç iki eşe birden düşer
  socket.on('takimSonuc', ({ dogru, puan, sira, kimden, dogruAtama }) => {
    const bana = kimden === durumum.ad;
    const kim = bana ? 'Gönderdin' : `Eşin ${kimden} gönderdi`;
    SoruAlani.kilitle(true);
    if (dogru) {
      SoruAlani.geri(`🎉 ${kim} — TAM İSABET! +${puan} puan (ikinize de)${sira ? ` · ${sira}. takım` : ''}`, 'dogru');
      Efekt.konfeti();
      Efekt.cal('dogru');
    } else {
      SoruAlani.sonuc({ dogru: false, dogruAtama });
      Efekt.cal('eksik');
    }
  });

  socket.on('saat', ({ kalanSn, duraklatildi }) => {
    if (duraklatildi) return;
    sayacYaz(kalanSn);
  });

  socket.on('kutlama', ({ ad, sira, mod }) => {
    if (ad === durumum.ad) return;                       // kendi kutlamamı ack'te yapıyorum
    const benimTakim = durumum.sonKamu && durumum.sonKamu.ben && durumum.sonKamu.ben.takim;
    if (mod === 'ikili' && benimTakim && benimTakim.ad === ad) return;   // kendi takımım 'takimSonuc' ile kutlanıyor
    const m = mod === 'birlikte'
      ? `🎉 Sınıf bulmacayı çözdü!`
      : mod === 'ikili'
        ? `🎉 ${ad} takımı bitirdi${sira ? ` (${sira}. sıra)` : ''}!`
        : `🎉 ${ad} bitirdi${sira ? ` (${sira}. sıra)` : ''}!`;
    duyuruGoster(m);
  });

  socket.on('duyuru', ({ mesaj }) => duyuruGoster('📣 ' + mesaj));

  /* ---------------- çizim ---------------- */
  function ciz(d) {
    Giris.gizle();
    // Öğretmen BAŞLAT demeden etkinliğe girilmez: hazır/bekleme ekranı durur
    const oyunda = d.faz === 'oyun' || (d.faz === 'sonuc' && d.ilerlemeMod === 'senkron');
    $('#hazir').hidden = oyunda;
    $('#oyun').hidden = !oyunda;
    if (!oyunda) { hazirEkrani(d); return; }

    $('#benimPuan').textContent = '⭐ ' + d.ben.puan;
    $('#modRozet').textContent = d.ilerlemeMod === 'bireysel' ? '🎯 Kendi hızında'
      : d.mod === 'birlikte' ? '🤝 Birlikte' : d.mod === 'ikili' ? '👥 İkili' : '🏁 Yarış';
    const b = d.ben.bulmaca || d.bulmaca;
    $('#bulmacaBaslik').textContent = b ? b.baslik : 'Izgara Çıkarım';
    const sr = $('#siraRozet');
    sr.hidden = !d.ben.siram;
    if (d.ben.siram) sr.textContent = `📊 Sıran: ${d.ben.siram}/${d.ben.oyuncuSayisi}`;
    // e grubu (1.–2. sınıf): daha büyük yazı, daha ferah ipucu satırları
    document.body.classList.toggle('e-grubu', !!(b && b.grup === 'e'));
    sayacYaz(d.kalanSn);

    skorlariCiz(d.skorlar);
    esBilgiCiz(d);
    SoruAlani.ciz(d);

    const anahtar = b ? b.id + '#' + d.turNo + '#' + d.ben.soruNo : null;
    if (anahtar !== durumum.bulmacaAnahtari) {
      durumum.bulmacaAnahtari = anahtar;
      ipuclariCiz(b);
      Izgara.ciz($('#izgaralar'), b, kopya(d.ben.isaretler), {
        onIsaret: isaretYolla, otomatik: d.otomatikDoldur
      });
      geriBildirim('', '');
      SoruAlani.geri('', '');
    } else {
      Izgara.otomatikAyarla(d.otomatikDoldur);
      // sunucu tabloyu boşalttıysa (temizle) ekran da boşalsın
      if (!Object.keys(d.ben.isaretler || {}).length) Izgara.isaretleriDegistir({});
      else if (d.mod === 'birlikte' || d.mod === 'ikili') Izgara.isaretleriDegistir(kopya(d.ben.isaretler));
    }

    const takimBitti = d.mod === 'ikili' && d.ben.takim && d.ben.takim.bitti;
    const oynanabilir = d.faz === 'oyun' && !d.duraklatildi && !d.ben.bitti && !takimBitti;
    Izgara.saltOkunurYap(!oynanabilir);
    $('#kontrolBtn').disabled = !oynanabilir;
    $('#temizleBtn').disabled = !oynanabilir;
    SoruAlani.kilitle(!oynanabilir);

    Ortu.durum(d);
  }

  /* Öğretmen başlatmadan önceki ekran + turlar arası kişisel özet */
  function hazirEkrani(d) {
    const bitti = d.faz === 'sonuc';
    $('#hazirBaslik').textContent = bitti ? '🏁 Tur bitti' : 'Hazırsın!';
    $('#hazirMetin').textContent = bitti
      ? 'Öğretmenin sıradaki soruyu açmasını bekliyoruz.'
      : 'Öğretmenin etkinliği başlatmasını bekliyoruz.';
    const p = $('#hazirPuan');
    if (d.ben && (d.ben.puan || d.ben.soruSayisi)) {
      p.hidden = false;
      p.innerHTML = `⭐ <b>${d.ben.puan}</b> puan · 📊 Sıran: <b>${d.ben.siram || '—'}/${d.ben.oyuncuSayisi}</b>` +
        (d.ben.soruSayisi ? ` · 🎯 ${d.ben.isabet}/${d.ben.soruSayisi} ilk denemede` : '');
    } else p.hidden = true;
    Ambiyans.basla();
  }

  /* İkili modda eşinin adı ve bağlantı durumu tablonun üstünde durur */
  function esBilgiCiz(d) {
    const e = $('#esBilgi');
    if (d.mod !== 'ikili' || !d.ben.takim) { e.hidden = true; return; }
    const esler = d.ben.takim.uyeler.filter((u) => !u.ben);
    e.hidden = false;
    if (!esler.length) {
      e.innerHTML = `<span class="es-etiket">👥 Takımın</span> <b>${kacir(d.ben.ad)}</b> ` +
        `<span class="es-uyari">— şu an eşin yok, tek başına çözmeye devam edebilirsin.</span>`;
      return;
    }
    const liste = esler.map((u) =>
      `<b>${kacir(u.ad)}</b> <span class="es-durum">${u.cevrimici ? '🟢 çevrimiçi' : '🔴 çevrimdışı'}</span>`
    ).join(', ');
    e.innerHTML = `<span class="es-etiket">👥 Eşin:</span> ${liste}` +
      (esler.every((u) => !u.cevrimici)
        ? ' <span class="es-uyari">— bağlantısı koptu, sen devam edebilirsin.</span>'
        : ' <span class="alt">— işaretleriniz ortak</span>');
  }

  function ipuclariCiz(b) {
    const ol = $('#ipuclari');
    ol.innerHTML = '';
    if (!b) return;
    b.ipuclari.forEach((ip, i) => {
      const li = document.createElement('li');
      // e grubunda olumsuz ipuçları 🚫 ile işaretlenir (renk değil, simge + etiket);
      // numara her hâlükârda kalır ki öğretmen "2. ipucu" diyebilsin
      const olumsuz = b.grup === 'e' && b.ipucuTurleri && b.ipucuTurleri[i] === 'olumsuz';
      const rozet = olumsuz
        ? `<span class="ipucu-olumsuz" title="olumsuz ipucu"><span aria-hidden="true">🚫</span><span class="gizli-metin">olumsuz ipucu:</span></span>`
        : '';
      li.innerHTML = `<button class="ipucu-btn${olumsuz ? ' olumsuz' : ''}" type="button" aria-pressed="false">` +
        `<span class="ipucu-no">${i + 1}</span>${rozet}<span>${kacir(ip)}</span></button>`;
      li.querySelector('button').addEventListener('click', (e) => {
        const b2 = e.currentTarget;
        const aktif = b2.getAttribute('aria-pressed') === 'true';
        b2.setAttribute('aria-pressed', String(!aktif));   // kullanılan ipucunun üstünü çiz
      });
      ol.appendChild(li);
    });
  }

  function skorlariCiz(skorlar) {
    const ol = $('#skorlar');
    ol.innerHTML = '';
    skorlar.forEach((s) => {
      const li = document.createElement('li');
      li.className = 'skor' + (s.id === durumum.sid ? ' benim' : '');
      li.innerHTML =
        `<span class="skor-sira">${s.sira}</span>` +
        `<span class="skor-ad">${kacir(s.ad)}${s.bitti ? ' <span title="bitirdi">🎉</span>' : ''}</span>` +
        `<span class="skor-durum">${s.cevrimici ? '<span title="çevrimiçi">🟢</span>' : '<span title="çevrimdışı">🔴</span>'}</span>` +
        `<span class="skor-puan">${s.puan}</span>`;
      ol.appendChild(li);
    });
  }

  function sayacYaz(kalanSn) {
    const e = $('#sayac');
    if (kalanSn === null || kalanSn === undefined) { e.hidden = true; return; }
    e.hidden = false;
    const dk = Math.floor(kalanSn / 60), sn = kalanSn % 60;
    e.querySelector('b').textContent = `${dk}:${String(sn).padStart(2, '0')}`;
    e.classList.toggle('az', kalanSn <= 30);
  }

  /* ---------------- hamleler ---------------- */
  function isaretYolla(p, c, d) { socket.emit('isaret', { p, c, d }); }

  /* Tabloyu denetle: PUAN VERMEZ ve ÇÖZÜME BAKMAZ — yalnız tablondaki çelişkileri söyler.
     (Eski sürüm "şu satır doğru" diyordu; sınırsız denenince cevabı sızdırıyordu.) */
  $('#kontrolBtn').addEventListener('click', () => {
    $('#kontrolBtn').disabled = true;
    socket.emit('kontrol', null, (cevap) => {
      $('#kontrolBtn').disabled = false;
      if (!cevap) return;
      if (cevap.hata) return geriBildirim(cevap.hata, 'bekle');
      if (!cevap.isaretli) return geriBildirim('Tablo henüz boş. Kesin olmayanları ✗ ile elemeye başla.', 'bekle');
      if (cevap.tutarli) geriBildirim('✅ Tablonda çelişki yok. (Doğruluğunu söylemem — kararı sen ver.)', 'dogru');
      else geriBildirim('⚠️ Tablonda çelişki var: ' + cevap.catismalar.join(' · '), 'eksik');
    });
  });

  $('#temizleBtn').addEventListener('click', () => {
    const mod = durumum.sonKamu && durumum.sonKamu.mod;
    const bireysel = durumum.sonKamu && durumum.sonKamu.ilerlemeMod === 'bireysel';
    const soru = !bireysel && mod === 'ikili'
      ? 'Takımınızın tüm işaretleri silinecek (eşinin ekranında da). Emin misin?'
      : !bireysel && mod === 'birlikte'
        ? 'Sınıfın ortak tablosundaki tüm işaretler silinecek. Emin misin?'
        : 'Tablodaki tüm işaretlerin silinecek. Emin misin?';
    if (!confirm(soru)) return;
    socket.emit('temizle', null, () => {});
    Izgara.temizle();              // YEREL tablo da boşalır (eski hata: yalnız sunucu temizleniyordu)
    geriBildirim('🧽 Tablo temizlendi.', '');
  });

  function geriBildirim(m, tur) {
    const e = $('#geriBildirim');
    e.textContent = m;
    e.className = 'geri-bildirim' + (tur ? ' ' + tur : '');
  }

  /* ---------------- duyuru ---------------- */
  let duyuruZaman = null;
  function duyuruGoster(m) {
    const e = $('#duyuru');
    e.textContent = m;
    e.hidden = false;
    clearTimeout(duyuruZaman);
    duyuruZaman = setTimeout(() => { e.hidden = true; }, 4000);
  }

  const sesDugme = $('#sesDugme');
  function sesTazele() {
    sesDugme.textContent = durumum.ses ? '🔊' : '🔇';
    sesDugme.setAttribute('aria-pressed', String(durumum.ses));
    sesDugme.title = durumum.ses ? 'Sesi kapat' : 'Sesi aç';
  }
  sesDugme.addEventListener('click', () => {
    durumum.ses = !durumum.ses;
    localStorage.setItem('izgara_ses', durumum.ses ? 'acik' : 'kapali');
    Efekt.ses(durumum.ses);
    sesTazele();
  });
  Efekt.ses(durumum.ses);
  sesTazele();

  /* ---------------- yardımcılar ---------------- */
  function kopya(o) { return JSON.parse(JSON.stringify(o || {})); }
  function kacir(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
})();
