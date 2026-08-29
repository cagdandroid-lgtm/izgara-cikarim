/* Öğrenci istemcisi: yalnız görüntüler ve hamle yollar. Tüm doğrulama sunucuda. */
(function () {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const socket = io({ reconnection: true, reconnectionDelay: 800, reconnectionDelayMax: 4000 });

  const durumum = {
    sid: localStorage.getItem('izgara_sid') || null,
    kod: localStorage.getItem('izgara_kod') || null,
    ad: '',
    katildi: false,
    bulmacaAnahtari: null,
    ses: localStorage.getItem('izgara_ses') !== 'kapali',
    sonKamu: null,
    sonLobi: null
  };

  /* ---------------- giriş: SINIF OTURUMU MODELİ ----------------
     Ekran çizimi public/giris.js'te; burada yalnız katılım akışı var. */
  Giris.kur((kod) => katil(kod));

  socket.on('lobi', (l) => {
    durumum.sonLobi = l;
    if (!durumum.katildi) Giris.ciz(l);          // oyundakini rahatsız etme
  });

  function katil(kod) {
    socket.emit('katil', { kod, sid: durumum.sid }, (cevap) => {
      if (!cevap || cevap.hata) return Giris.hata((cevap && cevap.hata) || 'Bağlanılamadı.');
      durumum.sid = cevap.sid;
      durumum.kod = cevap.kod;
      durumum.ad = cevap.ad;
      durumum.katildi = true;
      localStorage.setItem('izgara_sid', cevap.sid);
      localStorage.setItem('izgara_kod', cevap.kod);
      Giris.gizle();
      $('#oyun').hidden = false;
      Giris.hata('');
    });
  }

  socket.on('connect', () => {
    if (durumum.sid && durumum.kod) katil(durumum.kod);   // kopan bağlantıda otomatik dönüş
  });
  socket.on('disconnect', () => {
    if (durumum.katildi) ortuGoster('📡', 'Bağlantı koptu', 'Yeniden bağlanmaya çalışıyorum… Puanın duruyor, merak etme.');
  });
  socket.on('atildin', () => {
    durumum.katildi = false;
    localStorage.removeItem('izgara_sid');
    ortuGoster('🚪', 'Oyundan çıkarıldın', 'Öğretmenin seni oyundan çıkardı. Birkaç dakika sonra tekrar katılabilirsin.');
  });

  /* Öğretmen ismi serbest bıraktı: isim kartlarına dön (yanlış isme dokunulmuşsa) */
  socket.on('serbest', () => {
    durumum.katildi = false;
    durumum.sid = null;
    durumum.kod = null;
    localStorage.removeItem('izgara_sid');
    localStorage.removeItem('izgara_kod');
    ortuGizle();
    Giris.ciz(durumum.sonLobi);
    Giris.hata('Öğretmenin ismi serbest bıraktı. Kendi adına dokunabilirsin.');
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

  // İkili mod: "Kontrol Et" takım adına çalışır, sonuç iki eşe birden düşer
  socket.on('takimSonuc', ({ dogru, kesinlesen, puan, sira, kimden }) => {
    Izgara.kesinVurgu(kesinlesen);
    const bana = kimden === durumum.ad;
    const kim = bana ? 'Kontrol ettin' : `Eşin ${kimden} kontrol etti`;
    if (dogru) {
      geriBildirim(`🎉 ${kim} — DOĞRU! ${puan ? '+' + puan + ' puan (ikinize de)' : ''}${sira ? ` · ${sira}. takım` : ''}`, 'dogru');
      konfeti();
      cal('dogru');
    } else {
      const k = kesinlesen ? kesinlesen.length : 0;
      geriBildirim(k
        ? `${kim}: henüz tamam değil. ${k} satır kesinleşti ✔ — yeşil satırlar doğru.`
        : `${kim}: henüz tamam değil. İpuçlarını eşinle birlikte yeniden okuyun. 💪`, 'eksik');
      cal('eksik');
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
    $('#oyun').hidden = false;

    $('#benimPuan').textContent = '⭐ ' + d.ben.puan;
    $('#seviyeRozet').textContent = d.bulmaca ? 'Seviye ' + d.bulmaca.seviye : '—';
    $('#modRozet').textContent =
      d.mod === 'birlikte' ? '🤝 Birlikte' : d.mod === 'ikili' ? '👥 İkili' : '🏁 Yarış';
    $('#bulmacaBaslik').textContent = d.bulmaca ? d.bulmaca.baslik : 'Izgara Çıkarım';
    // e grubu (1.–2. sınıf): daha büyük yazı, daha ferah ipucu satırları
    document.body.classList.toggle('e-grubu', !!(d.bulmaca && d.bulmaca.grup === 'e'));
    sayacYaz(d.kalanSn);

    skorlariCiz(d.skorlar);

    esBilgiCiz(d);

    const anahtar = d.bulmaca ? d.bulmaca.id + '#' + d.turNo : null;
    if (anahtar !== durumum.bulmacaAnahtari) {
      durumum.bulmacaAnahtari = anahtar;
      ipuclariCiz(d.bulmaca);
      Izgara.ciz($('#izgaralar'), d.bulmaca, kopya(d.ben.isaretler), { onIsaret: isaretYolla });
      geriBildirim('', '');
    } else if (d.mod === 'birlikte' || d.mod === 'ikili') {
      Izgara.isaretleriDegistir(kopya(d.ben.isaretler));
    }

    const takimBitti = d.mod === 'ikili' && d.ben.takim && d.ben.takim.bitti;
    const oynanabilir = d.faz === 'oyun' && !d.duraklatildi &&
      !(d.mod === 'yaris' && d.ben.bitti) && !takimBitti;
    Izgara.saltOkunurYap(!oynanabilir);
    $('#kontrolBtn').disabled = !oynanabilir;
    $('#temizleBtn').disabled = !oynanabilir;

    if (d.ben.sonSonuc) Izgara.kesinVurgu(d.ben.sonSonuc.kesinlesen);

    ortuDurumu(d);
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

  function ortuDurumu(d) {
    if (d.faz === 'lobi') {
      return ortuGoster('⏳', 'Öğretmeni bekliyoruz', 'Bulmaca birazdan başlayacak. Hazır ol! 🧠');
    }
    if (d.duraklatildi) {
      return ortuGoster('⏸', 'Öğretmeninizi dinleyin', 'Oyun duraklatıldı, süre donduruldu.');
    }
    if (d.faz === 'sonuc') {
      return sonucGoster(d);
    }
    // erken bitirenler beklerken sıkılmasın: mini oyun yalnız burada açılır
    if (d.mod === 'yaris' && d.ben.bitti) {
      return ortuGoster('🎉', 'Bulmacayı çözdün!', 'Arkadaşlarını bekliyoruz…', d.podyum, true);
    }
    if (d.mod === 'ikili' && d.ben.takim && d.ben.takim.bitti) {
      return ortuGoster('🎉', 'Takımınız çözdü!', 'Diğer takımları bekliyoruz…', d.podyum, true);
    }
    if (d.mod === 'ikili' && !d.ben.takim) {
      return ortuGoster('👥', 'Takımın hazırlanıyor', 'Öğretmenin seni bir eşle eşleştirecek.');
    }
    ortuGizle();
  }

  function sonucGoster(d) {
    const kazanan = d.podyum && d.podyum.length ? d.podyum[0].ad : null;
    if (d.mod === 'ikili') {
      return ortuGoster('🏁', 'Tur bitti', kazanan ? `Birinci takım: ${kazanan}` : 'Bu turda bitiren takım olmadı.', d.podyum);
    }
    if (d.mod === 'birlikte') {
      ortuGoster('🤝', 'Tur bitti', d.ben.sonSonuc && d.ben.sonSonuc.dogru
        ? 'Sınıfça çözdünüz! Harikasınız 🎉' : 'Öğretmen turu bitirdi. Şimdi birlikte konuşalım.');
    } else {
      ortuGoster('🏁', 'Tur bitti', kazanan ? `Birinci: ${kazanan}` : 'Bu turda bitiren olmadı.', d.podyum);
    }
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

  $('#kontrolBtn').addEventListener('click', () => {
    $('#kontrolBtn').disabled = true;
    socket.emit('kontrol', null, (cevap) => {
      $('#kontrolBtn').disabled = false;
      if (!cevap) return;
      if (cevap.hata) return geriBildirim(cevap.hata, 'bekle');
      if (cevap.ikili) return;          // sonuç 'takimSonuc' ile iki eşe birden gelir
      Izgara.kesinVurgu(cevap.kesinlesen);
      if (cevap.dogru) {
        geriBildirim(`🎉 Doğru! ${cevap.puan ? '+' + cevap.puan + ' puan' : ''}${cevap.sira ? ` · ${cevap.sira}. sırada bitirdin` : ''}`, 'dogru');
        konfeti();
        cal('dogru');
      } else {
        const k = cevap.kesinlesen ? cevap.kesinlesen.length : 0;
        geriBildirim(k
          ? `Henüz tamam değil. ${k} satır kesinleşti ✔ — yeşil satırlar doğru, gerisini gözden geçir.`
          : 'Henüz tamam değil. İpuçlarını yeniden oku, elemeyi ✖ ile sürdür. 💪', 'eksik');
        cal('eksik');
      }
    });
  });

  $('#temizleBtn').addEventListener('click', () => {
    const mod = durumum.sonKamu && durumum.sonKamu.mod;
    const soru = mod === 'ikili'
      ? 'Takımınızın tüm işaretleri silinecek (eşinin ekranında da). Emin misin?'
      : mod === 'birlikte'
        ? 'Sınıfın ortak tablosundaki tüm işaretler silinecek. Emin misin?'
        : 'Tablodaki tüm işaretlerin silinecek. Emin misin?';
    if (!confirm(soru)) return;
    socket.emit('temizle');
    Izgara.kesinVurgu([]);
    geriBildirim('', '');
  });

  function geriBildirim(m, tur) {
    const e = $('#geriBildirim');
    e.textContent = m;
    e.className = 'geri-bildirim' + (tur ? ' ' + tur : '');
  }

  /* ---------------- örtü / duyuru ---------------- */
  function ortuGoster(ikon, baslik, metin, podyum, miniOyun) {
    BeklemeOyunu.goster(!!miniOyun);
    $('#ortuIkon').textContent = ikon;
    $('#ortuBaslik').textContent = baslik;
    $('#ortuMetin').textContent = metin || '';
    const ol = $('#ortuPodyum');
    ol.innerHTML = '';
    if (podyum && podyum.length) {
      ol.hidden = false;
      const madalya = ['🥇', '🥈', '🥉'];
      podyum.slice(0, 3).forEach((p, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="madalya">${madalya[i]}</span> <b>${kacir(p.ad)}</b> <span class="sure">${(p.sure / 1000).toFixed(0)} sn · +${p.puan}</span>`;
        ol.appendChild(li);
      });
    } else ol.hidden = true;
    $('#ortu').hidden = false;
  }
  function ortuGizle() {
    $('#ortu').hidden = true;
    BeklemeOyunu.goster(false);
  }

  /* Bekleme mini oyunu (public/bekleme.js): yalnız bekleme ekranında açılır,
     sunucuya hiçbir şey göndermez, sınıf puanına etki etmez. */
  BeklemeOyunu.bagla('beklemeAlani', 'beklemeOyun', 'beklemeAcBtn');

  let duyuruZaman = null;
  function duyuruGoster(m) {
    const e = $('#duyuru');
    e.textContent = m;
    e.hidden = false;
    clearTimeout(duyuruZaman);
    duyuruZaman = setTimeout(() => { e.hidden = true; }, 4000);
  }

  /* ---------------- kutlama + ses ---------------- */
  function konfeti() {
    const kap = $('#konfeti');
    const renkler = ['#e8b04b', '#7aa874', '#8c6fb0', '#d97b6c', '#4f93b8'];
    for (let i = 0; i < 60; i++) {
      const p = document.createElement('i');
      p.style.left = Math.random() * 100 + 'vw';
      p.style.background = renkler[i % renkler.length];
      p.style.animationDelay = (Math.random() * 0.4) + 's';
      p.style.transform = `rotate(${Math.random() * 360}deg)`;
      kap.appendChild(p);
      setTimeout(() => p.remove(), 2600);
    }
  }

  let sesBaglam = null;
  function cal(tur) {
    if (!durumum.ses) return;
    try {
      sesBaglam = sesBaglam || new (window.AudioContext || window.webkitAudioContext)();
      const notalar = tur === 'dogru' ? [523, 659, 784] : [330, 262];
      notalar.forEach((hz, i) => {
        const o = sesBaglam.createOscillator(), g = sesBaglam.createGain();
        o.type = 'sine'; o.frequency.value = hz;
        g.gain.value = 0.06;
        o.connect(g); g.connect(sesBaglam.destination);
        const t = sesBaglam.currentTime + i * 0.12;
        o.start(t); o.stop(t + 0.12);
      });
    } catch (e) { /* ses yoksa sessiz geç */ }
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
    sesTazele();
  });
  sesTazele();

  /* ---------------- yardımcılar ---------------- */
  function kopya(o) { return JSON.parse(JSON.stringify(o || {})); }
  function kacir(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
})();
