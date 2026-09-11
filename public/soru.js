/* ASIL SORU alanı: soru metni, seçenek kartları ve cevap akışı.
   Tablo (ızgara) yalnız bir ARAÇTIR; puan buradan verilen cevaba göre hesaplanır. */
window.SoruAlani = (function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const kacir = (s) => String(s === undefined || s === null ? '' : s)
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let socket = null;

  function kur(s) { socket = s; }

  function ciz(d) {
    const soru = d.ben.soru;
    const kap = $('#secenekler');
    $('#soruMetin').textContent = soru ? soru.metin : '—';
    const sayac = $('#soruSayac');
    if (d.ilerlemeMod === 'bireysel') {
      sayac.hidden = false;
      sayac.textContent = `Soru ${d.ben.soruNo}${d.ben.toplamSoru ? '/' + d.ben.toplamSoru : ''}`;
    } else sayac.hidden = true;

    const imza = soru ? soru.metin + '|' + soru.secenekler.join('|') : '';
    if (kap.dataset.imza === imza) return;
    kap.dataset.imza = imza;
    kap.innerHTML = '';
    if (!soru) return;
    soru.secenekler.forEach((sec, i) => {
      const dg = document.createElement('button');
      dg.type = 'button';
      dg.className = 'secenek';
      dg.dataset.i = String(i);
      dg.innerHTML = `<span class="secenek-harf">${String.fromCharCode(65 + i)}</span><span>${kacir(sec)}</span>`;
      dg.addEventListener('click', () => cevapYolla(i, dg));
      kap.appendChild(dg);
    });
  }

  function kilitle(kilit) {
    $('#secenekler').querySelectorAll('.secenek').forEach((b) => { b.disabled = !!kilit; });
  }

  function cevapYolla(secim, dugme) {
    kilitle(true);
    socket.emit('cevap', { secim }, (c) => {
      if (!c) return kilitle(false);
      if (c.hata) { geri(c.hata, 'bekle'); return kilitle(false); }
      if (c.dogru) {
        if (dugme) dugme.classList.add('dogru');
        geri(`🎉 Doğru! +${c.puan} puan` + (c.siradaki ? ` · sıradaki soru: ${c.siradaki}` : ''), 'dogru');
        Efekt.konfeti();
        Efekt.cal('dogru');
      } else {
        if (dugme) { dugme.classList.add('yanlis'); dugme.disabled = true; }
        geri('Bu değil 🌱 İpuçlarını yeniden oku, tabloyu kullanabilirsin — tekrar deneyebilirsin.', 'eksik');
        Efekt.cal('eksik');
        kilitle(false);
        $('#secenekler').querySelectorAll('.secenek.yanlis').forEach((b) => { b.disabled = true; });
      }
    });
  }

  function geri(m, tur) {
    const e = $('#cevapGeri');
    e.textContent = m;
    e.className = 'geri-bildirim' + (tur ? ' ' + tur : '');
  }

  return { kur, ciz, kilitle, geri };
})();
