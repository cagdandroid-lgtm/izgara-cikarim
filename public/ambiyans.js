/* Giriş / bekleme ekranlarının ortam animasyonu: yavaş süzülen çıkarım simgeleri.
   Düşük yoğunluk, CPU dostu; OYUN ekranında ÇALIŞMAZ (dikkat dağıtmasın),
   prefers-reduced-motion açıksa hiç başlamaz. */
window.Ambiyans = (function () {
  'use strict';
  const SIMGELER = ['✔', '✖', '🔍', '🧩', '❓', '💡'];
  let tuval = null, ctx = null, parcalar = [], kare = null, calisiyor = false;

  const azHareket = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function boyutla() {
    if (!tuval) return;
    const o = window.devicePixelRatio || 1;
    tuval.width = tuval.clientWidth * o;
    tuval.height = tuval.clientHeight * o;
    ctx.setTransform(o, 0, 0, o, 0, 0);
  }

  function kur(id) {
    tuval = document.getElementById(id);
    if (!tuval || !tuval.getContext) return;
    ctx = tuval.getContext('2d');
    boyutla();
    window.addEventListener('resize', boyutla);
    const adet = Math.max(10, Math.min(22, Math.round(tuval.clientWidth / 60)));
    parcalar = Array.from({ length: adet }, () => yeniParca(true));
  }

  function yeniParca(ilk) {
    const g = tuval.clientWidth, y = tuval.clientHeight;
    return {
      x: Math.random() * g,
      y: ilk ? Math.random() * y : y + 30,
      hiz: 0.15 + Math.random() * 0.35,           // yavaş süzülme
      salinim: 0.4 + Math.random() * 0.8,
      faz: Math.random() * Math.PI * 2,
      boy: 16 + Math.random() * 20,
      saydam: 0.10 + Math.random() * 0.16,
      simge: SIMGELER[Math.floor(Math.random() * SIMGELER.length)]
    };
  }

  function cizim() {
    if (!calisiyor) return;
    const g = tuval.clientWidth, y = tuval.clientHeight;
    ctx.clearRect(0, 0, g, y);
    for (const p of parcalar) {
      p.y -= p.hiz;
      p.faz += 0.006;
      const x = p.x + Math.sin(p.faz) * 14 * p.salinim;
      ctx.globalAlpha = p.saydam;
      ctx.font = `${p.boy}px 'Poppins', system-ui, sans-serif`;
      ctx.fillText(p.simge, x, p.y);
      if (p.y < -30) Object.assign(p, yeniParca(false));
    }
    ctx.globalAlpha = 1;
    kare = requestAnimationFrame(cizim);
  }

  function basla() {
    if (!tuval || calisiyor || azHareket()) return;
    calisiyor = true;
    boyutla();
    cizim();
  }
  function dur() {
    calisiyor = false;
    if (kare) cancelAnimationFrame(kare);
    kare = null;
    if (ctx && tuval) ctx.clearRect(0, 0, tuval.clientWidth, tuval.clientHeight);
  }

  return { kur, basla, dur };
})();
