/* Kutlama ve ses efektleri (yalnız öğrenci ekranı).
   Doğru cevapta konfeti + kısa neşeli ton, eksikte yumuşak uyarı tonu.
   Ses varsayılan AÇIK ama kısıktır; öğrenci 🔇 düğmesiyle kapatabilir (tercih hatırlanır). */
window.Efekt = (function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  let sesAcik = true;

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
    if (!sesAcik) return;
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

  return { konfeti, cal, ses: (deger) => { sesAcik = !!deger; } };
})();
