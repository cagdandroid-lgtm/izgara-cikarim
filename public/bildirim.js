/* Öğretmen paneli: "tur bitti" uyarısı — bildirim çubuğu, kısa zil ve sekme başlığında
   yanıp sönme (öğretmen başka sekmedeyken de haberi olsun). */
window.Bildirim = (function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const asilBaslik = document.title;
  let basliktZaman = null;

  function kur(socket, durumAl) {
      
    socket.on('turBitti', (v) => {
      const ikili = v.mod === 'ikili';
      const tekil = ikili ? 'takım' : 'öğrenci';
      const cogul = ikili ? 'takımlar' : 'öğrenciler';
      $('#bitisBaslik').textContent = v.sebep === 'sure'
        ? '⏱ Süre doldu — tur bitti'
        : `✅ Tüm ${cogul} tamamladı — tur bitti`;
      const ilk = v.podyum && v.podyum.length ? ` · 1. ${v.podyum[0].ad}` : '';
      const son = durumAl();
      const aktarilmamis = son && son.ogretmen.olcum ? son.ogretmen.olcum.aktarilmamis : 0;
      $('#bitisAlt').textContent =
        `${v.bulmacaId || '—'} · ${v.bitiren}/${v.toplam} ${tekil} bitirdi${ilk}` +
        (aktarilmamis ? ` · 📥 ${aktarilmamis} kayıt indirilmedi — ders sonunda CSV'yi indirin` : '');
      $('#bitisUyari').hidden = false;
      zilCal();
      basligiYanipSondur();
    });

    $('#bitisKapat').addEventListener('click', () => {
      $('#bitisUyari').hidden = true;
      durdurBaslik();
    });

    function basligiYanipSondur() {
      durdurBaslik();
      let acik = false;
      basliktZaman = setInterval(() => {
        acik = !acik;
        document.title = acik ? '🔔 TUR BİTTİ' : asilBaslik;
      }, 900);
      // öğretmen sekmeye dönünce yanıp sönme dursun
      window.addEventListener('focus', durdurBaslik, { once: true });
      setTimeout(durdurBaslik, 30000);
    }
    function durdurBaslik() {
      if (basliktZaman) clearInterval(basliktZaman);
      basliktZaman = null;
      document.title = asilBaslik;
    }

    let sesBaglam = null;
    function zilCal() {
      try {
        sesBaglam = sesBaglam || new (window.AudioContext || window.webkitAudioContext)();
        [880, 660, 990].forEach((hz, i) => {
          const o = sesBaglam.createOscillator(), g = sesBaglam.createGain();
          o.type = 'sine'; o.frequency.value = hz; g.gain.value = 0.05;
          o.connect(g); g.connect(sesBaglam.destination);
          const t = sesBaglam.currentTime + i * 0.16;
          o.start(t); o.stop(t + 0.16);
        });
      } catch (e) { /* ses engelliyse sessiz geç */ }
    }
  }

  return { kur };
})();
