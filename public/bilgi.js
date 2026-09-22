/* ℹ️ Etkinlik Bilgisi modali (yalnız öğretmen paneli). Üç sekme: Kazanımlar · CHC · Veli Özeti.
   Kaynak: kök dizindeki ETKINLIK_BILGI.json (sunucudan yalnız öğretmen soketiyle gelir).
   Günlük akışta hiçbir sekme kendiliğinden açılmaz; bilgi yalnız istenince gelir. */
window.EtkinlikBilgisi = (function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const kacir = (s) => String(s === undefined || s === null ? '' : s)
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let socket = null, bilgi = null, sekme = 'kazanim', uyar = () => {};

  function kur(s, bilgiFn) {
    socket = s;
    uyar = bilgiFn || (() => {});
    $('#bilgiBtn').addEventListener('click', ac);
    $('#bilgiKapat').addEventListener('click', kapat);
    $('#bilgiKatman').addEventListener('click', (e) => { if (e.target.id === 'bilgiKatman') kapat(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') kapat(); });
    document.querySelectorAll('#bilgiKatman .sekme').forEach((b) =>
      b.addEventListener('click', () => { sekme = b.dataset.sekme; ciz(); }));
  }

  function ac() {
    $('#bilgiKatman').hidden = false;
    if (bilgi) return ciz();
    $('#bilgiIcerik').innerHTML = '<p class="alt">Yükleniyor…</p>';
    socket.emit('t:etkinlikBilgisi', {}, (r) => {
      if (!r || r.hata) { $('#bilgiIcerik').innerHTML = `<p class="uyari">⚠️ ${kacir((r && r.hata) || 'Bilgi alınamadı.')}</p>`; return; }
      bilgi = r.bilgi;
      ciz();
    });
  }
  function kapat() { $('#bilgiKatman').hidden = true; }

  function ciz() {
    document.querySelectorAll('#bilgiKatman .sekme').forEach((b) =>
      b.setAttribute('aria-selected', String(b.dataset.sekme === sekme)));
    const k = $('#bilgiIcerik');
    if (sekme === 'kazanim') {
      k.innerHTML = (bilgi.amac ? `<p class="not-kutu ince"><b>Amaç:</b> ${kacir(bilgi.amac)}</p>` : '') +
        '<ol class="bilgi-liste">' + (bilgi.kazanimlar || []).map((x) => `<li>${kacir(x)}</li>`).join('') + '</ol>';
    } else if (sekme === 'chc') {
      const c = bilgi.chc || {};
      const satir = (x, tur) => x ? `<tr><th>${tur}</th><td><b>${kacir(x.alan)}</b> — ${kacir(x.ad)}</td>` +
        `<td><b>${kacir((x.dar || []).join(', '))}</b> ${kacir(x.dar_ad || '')}</td><td>${kacir(x.gerekce || '')}</td></tr>` : '';
      k.innerHTML = '<div class="tablo-kaydir"><table class="ogr-tablo"><thead><tr><th></th><th>Geniş alan</th>' +
        '<th>Hedef dar yetenek</th><th>Gerekçe</th></tr></thead><tbody>' +
        satir(c.birincil, 'Birincil') + (c.ikincil || []).map((x) => satir(x, 'İkincil')).join('') +
        '</tbody></table></div>' + (c.gerekce ? `<p class="alt">${kacir(c.gerekce)}</p>` : '');
    } else {
      k.innerHTML = `<p class="veli-metin">${kacir(bilgi.veli_ozeti || '')}</p>` +
        '<button id="veliKopyala" class="btn btn-ana" type="button">📋 Kopyala</button>';
      $('#veliKopyala').addEventListener('click', kopyala);
    }
  }

  function kopyala() {
    const metin = bilgi.veli_ozeti || '';
    const tamam = () => uyar('📋 Veli özeti kopyalandı — WhatsApp grubuna yapıştırabilirsiniz.');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(metin).then(tamam, () => elleKopyala(metin, tamam));
    } else elleKopyala(metin, tamam);
  }
  function elleKopyala(metin, tamam) {
    const t = document.createElement('textarea');
    t.value = metin; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); tamam(); } catch (e) { uyar('⚠️ Kopyalanamadı; metni seçip kopyalayın.'); }
    t.remove();
  }

  return { kur };
})();
