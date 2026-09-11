/* İkili Mod: takım kartları, canlı doluluk ve elle eşleme (yalnız öğretmen paneli). */
window.TakimUI = (function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const kacir = (s) => String(s === undefined || s === null ? '' : s)
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let socket = null, bilgi = () => {}, durumAl = () => null;
  let secilenler = [];
  const son = () => durumAl();

  function kur(s, bilgiFn, durumFn) {
    socket = s;
    bilgi = bilgiFn || (() => {});
    durumAl = durumFn || (() => null);
    $('#karistirBtn').addEventListener('click', () => {
      if (!confirm('Takımlar yeniden dağıtılsın mı? Mevcut eşleşmeler bozulur.')) return;
      secilenler = [];
      socket.emit('t:karistir', {}, (r) => {
        if (r && r.hata) bilgi('⚠️ ' + r.hata);
        else if (r && r.ok) bilgi(`🔀 ${r.takim} takım oluşturuldu`);
      });
    });

    $('#esleBtn').addEventListener('click', () => {
      if (secilenler.length !== 2) return;
      socket.emit('t:esle', { id1: secilenler[0], id2: secilenler[1] }, (r) => {
        if (r && r.hata) return bilgi('⚠️ ' + r.hata);
        bilgi(`🔗 Eşlendi: ${r.ad}`);
        secilenler = [];
        if (son()) ciz(son());
      });
    });
  }

  function ciz(d) {
    const kart = $('#takimKart');
    if (d.mod !== 'ikili') { kart.hidden = true; return; }
    kart.hidden = false;

    const takimlar = d.ogretmen.takimlar || [];
    $('#takimBos').hidden = takimlar.length > 0;
    $('#takimOzet').textContent = takimlar.length
      ? `· ${takimlar.length} takım · ${takimlar.filter((t) => t.bitti).length} tanesi bitirdi` : '';

    const kap = $('#takimlar');
    kap.innerHTML = '';
    takimlar.forEach((t) => {
      const el = document.createElement('div');
      el.className = 'takim' + (t.bitti ? ' bitti' : '');
      el.dataset.id = t.id;
      const uyeler = t.uyeler.map((u) =>
        `<span class="uye">${u.cevrimici ? '🟢' : '🔴'} ${kacir(u.ad)}</span>`).join('<span class="ve">&</span>');
      el.innerHTML =
        `<div class="takim-ust"><b>${uyeler || '<i>boş</i>'}</b>` +
        `${t.uyeler.length === 1 ? ' <span class="rozet tek">tek kişilik</span>' : ''}` +
        `${t.bitti ? ' <span class="rozet bitti-rozet">🎉 bitirdi</span>' : ''}</div>` +
        `<div class="takim-alt">` +
        `<span class="cubuk"><i style="width:${t.ilerleme}%"></i></span> ` +
        `<span class="yuzde">%${t.ilerleme}</span> · kesin ${t.kesin} · deneme ${t.denemeler}` +
        `</div>`;
      kap.appendChild(el);
    });

    // elle eşleme için öğrenci çipleri
    const cip = $('#secimCipleri');
    cip.innerHTML = '';
    d.ogretmen.oyuncular.forEach((o) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cip' + (secilenler.includes(o.id) ? ' secili' : '');
      b.textContent = `${o.cevrimici ? '🟢' : '🔴'} ${o.ad}`;
      b.title = o.takimAd ? `Şu anki takım: ${o.takimAd}` : 'Takımsız';
      b.setAttribute('aria-pressed', String(secilenler.includes(o.id)));
      b.addEventListener('click', () => secimDegistir(o.id));
      cip.appendChild(b);
    });
    secimTazele();
  }

  function secimDegistir(id) {
    const i = secilenler.indexOf(id);
    if (i >= 0) secilenler.splice(i, 1);
    else { secilenler.push(id); if (secilenler.length > 2) secilenler.shift(); }
    if (son()) ciz(son());
  }

  function secimTazele() {
    const adlar = secilenler.map((id) => {
      const o = (son() && son().ogretmen.oyuncular.find((x) => x.id === id)) || null;
      return o ? o.ad : '?';
    });
    $('#esleBtn').disabled = secilenler.length !== 2;
    $('#secimDurum').textContent = secilenler.length === 2
      ? `Eşlenecek: ${adlar.join(' & ')}`
      : secilenler.length === 1
        ? `${adlar[0]} seçildi — bir öğrenci daha seçin.`
        : 'Elle eşlemek için aşağıdan iki öğrenci seçin.';
  }

  return { kur, ciz };
})();
