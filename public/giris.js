/* Giriş ekranı (SINIF OTURUMU MODELİ): bekleme ekranı + isim kartları.
   Öğrenci isim YAZMAZ, grup SEÇMEZ; yalnız öğretmenin açtığı grubun aktif
   öğrencileri kart olarak gelir. Başka grupların isimleri buraya hiç ulaşmaz. */
window.Giris = (function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const kacir = (s) => String(s === undefined || s === null ? '' : s)
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let sec = () => {};

  function kur(onSec, onGrubuUnut) {
    sec = onSec;
    $('#beklemeGoster').addEventListener('click', () => {
      not('');
      if (onGrubuUnut) onGrubuUnut();
    });
    Ambiyans.kur('ambiyans');
  }

  /** @param {object|null} l sunucudan gelen lobi paketi */
  function ciz(l) {
    const bekliyor = !l || !l.secimYapildi;
    $('#bekleme').hidden = !bekliyor;
    $('#isimSecim').hidden = bekliyor;
    $('#oyun').hidden = true;
    Ambiyans.basla();                       // ortam animasyonu yalnız giriş/bekleme ekranlarında
    if (bekliyor) return;

    const kap = $('#isimKartlari');
    kap.innerHTML = '';
    $('#secimBos').hidden = l.ogrenciler.length > 0;
    l.ogrenciler.forEach((o) => {
      const kilitli = o.oyunda && o.cevrimici;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'isim-kart' + (o.oyunda ? ' dolu' : '') + (kilitli ? ' kilitli' : '');
      b.disabled = kilitli || l.girisKilitli;
      b.setAttribute('aria-label', o.isim + (kilitli ? ' — şu an oyunda' : ''));
      b.innerHTML =
        `<span class="avatar" aria-hidden="true" style="--ton:${ton(o.kod)}">${kacir(basHarf(o.isim))}</span>` +
        `<span class="isim">${kacir(o.isim)}</span>` +
        (kilitli ? '<span class="kart-rozet">🎮 oyunda</span>'
          : o.oyunda ? '<span class="kart-rozet geri">🔄 geri dön</span>' : '');
      b.addEventListener('click', () => sec(o.kod));
      kap.appendChild(b);
    });
  }

  function gizle() {
    $('#bekleme').hidden = true;
    $('#isimSecim').hidden = true;
    Ambiyans.dur();                         // OYUN ekranında arka plan animasyonu YOKTUR
  }

  function hata(m) {
    const e = $('#girisHata');
    e.textContent = m || '';
    e.hidden = !m;
  }

  /* Bekleme ekranındaki bilgi satırı ("etkinlik bitti", "bu grup senin değil" gibi).
     gosterDugmesi: ortak tablet durumunda öğrencinin kartlara yine de bakabilmesi için. */
  function not(m, gosterDugmesi) {
    const e = $('#beklemeNot');
    e.textContent = m || '';
    e.hidden = !m;
    $('#beklemeGoster').hidden = !gosterDugmesi;
  }

  const basHarf = (isim) => String(isim || '?').trim().charAt(0).toLocaleUpperCase('tr');
  function ton(kod) {                       // koda göre sabit, yumuşak bir renk tonu
    let t = 0;
    for (const h of String(kod)) t = (t * 31 + h.charCodeAt(0)) % 360;
    return t;
  }

  return { kur, ciz, gizle, hata, not: not };
})();
