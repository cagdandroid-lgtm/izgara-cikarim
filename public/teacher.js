/* Öğretmen paneli. Yetki çerezi sunucuda doğrulanır; buradaki düğmeler yalnız olay yollar. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const socket = io();

  let son = null;              // son gelen durum
  let listelerDolu = false;

  socket.on('durum', (d) => {
    if (!d.ogretmen) return;
    son = d;
    ciz(d);
  });

  socket.on('duyuru', ({ mesaj }) => duyuruGoster('📣 ' + mesaj));
  socket.on('saat', ({ kalanSn }) => sayacYaz(kalanSn));

  /* ---------------- tur bitti uyarısı ---------------- */
  const asilBaslik = document.title;
  let basliktZaman = null;

  socket.on('turBitti', (v) => {
    const ikili = v.mod === 'ikili';
    const tekil = ikili ? 'takım' : 'öğrenci';
    const cogul = ikili ? 'takımlar' : 'öğrenciler';
    $('#bitisBaslik').textContent = v.sebep === 'sure'
      ? '⏱ Süre doldu — tur bitti'
      : `✅ Tüm ${cogul} tamamladı — tur bitti`;
    const ilk = v.podyum && v.podyum.length ? ` · 1. ${v.podyum[0].ad}` : '';
    $('#bitisAlt').textContent =
      `${v.bulmacaId || '—'} · ${v.bitiren}/${v.toplam} ${tekil} bitirdi${ilk}`;
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

  /* takımın doluluk çubuğu, tam yayın beklemeden canlı güncellenir */
  socket.on('takimIlerleme', (t) => {
    if (!t) return;
    const el = document.querySelector(`.takim[data-id="${t.id}"]`);
    if (!el) return;
    const cubuk = el.querySelector('.cubuk i'), yuzde = el.querySelector('.yuzde');
    if (cubuk) cubuk.style.width = t.ilerleme + '%';
    if (yuzde) yuzde.textContent = '%' + t.ilerleme;
    if (son) { const eski = son.ogretmen.takimlar.find((x) => x.id === t.id); if (eski) Object.assign(eski, t); }
  });

  /* ---------------- çizim ---------------- */
  function ciz(d) {
    const fazAdi = { lobi: '⏳ Lobi', oyun: d.duraklatildi ? '⏸ Duraklatıldı' : '🟢 Oyunda', sonuc: '🏁 Tur bitti' };
    $('#fazRozet').textContent = fazAdi[d.faz] || d.faz;
    $('#modRozet').textContent =
      d.mod === 'birlikte' ? '🤝 Birlikte' : d.mod === 'ikili' ? '👥 İkili Mod' : '🏁 Yarış';
    $('#turRozet').textContent = 'Tur ' + d.turNo + (d.bulmaca ? ' · ' + d.bulmaca.id : '');
    $('#oyuncuSayi').textContent = '👥 ' + d.ogretmen.oyuncular.length +
      ' (' + d.ogretmen.oyuncular.filter((o) => o.cevrimici).length + ' çevrimiçi)';
    sayacYaz(d.kalanSn);

    if (!listelerDolu) doldurListeler(d);
    $('#grup').value = d.grup;
    seviyeListesiTazele(d);
    $('#seviye').value = d.seviye;
    $('#mod').value = d.mod;
    if (document.activeElement !== $('#sure')) $('#sure').value = Math.round(d.sureSn / 60);
    bulmacaListesiTazele(d);

    $('#duraklatBtn').textContent = d.duraklatildi ? '▶️ Devam Ettir' : '⏸ Duraklat';
    $('#duraklatBtn').disabled = d.faz !== 'oyun';
    $('#bitirBtn').disabled = d.faz !== 'oyun';
    $('#girisKilitBtn').textContent = d.girisKilitli ? '🔒 Girişler Kilitli' : '🔓 Girişler Açık';
    $('#girisKilitBtn').classList.toggle('etkin', d.girisKilitli);
    $('#isimKilitBtn').textContent = d.isimKilitli ? '🔒 İsimler Kilitli' : '🔓 İsimler Açık';
    $('#isimKilitBtn').classList.toggle('etkin', d.isimKilitli);

    ogrencileriCiz(d.ogretmen.oyuncular);
    takimlariCiz(d);
    podyumCiz(d.podyum);
    cozumCiz(d);
  }

  /* ---------------- ikili mod: takımlar ---------------- */
  let secilenler = [];

  function takimlariCiz(d) {
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
    if (son) takimlariCiz(son);
  }

  function secimTazele() {
    const adlar = secilenler.map((id) => {
      const o = (son && son.ogretmen.oyuncular.find((x) => x.id === id)) || null;
      return o ? o.ad : '?';
    });
    $('#esleBtn').disabled = secilenler.length !== 2;
    $('#secimDurum').textContent = secilenler.length === 2
      ? `Eşlenecek: ${adlar.join(' & ')}`
      : secilenler.length === 1
        ? `${adlar[0]} seçildi — bir öğrenci daha seçin.`
        : 'Elle eşlemek için aşağıdan iki öğrenci seçin.';
  }

  const gAd = { e: 'E grubu (1.–2. sınıf)', i: 'İ grubu', c: 'C grubu', p: 'P grubu' };

  function doldurListeler(d) {
    $('#grup').innerHTML = d.ogretmen.gruplar.map((g) => `<option value="${g}">${gAd[g] || g}</option>`).join('');
    listelerDolu = true;
  }

  /* seviye listesi seçili grubun seviyeleriyle sınırlıdır (uyumsuz eşleşme olmasın) */
  function seviyeListesiTazele(d) {
    const sec = $('#seviye');
    const secili = sec.value;
    const liste = [...new Set(d.ogretmen.bulmacaListesi
      .filter((b) => b.grup === $('#grup').value).map((b) => b.seviye))].sort();
    sec.innerHTML = liste.map((s) => `<option value="${s}">${s}</option>`).join('');
    sec.value = liste.includes(secili) ? secili : (liste.includes(d.seviye) ? d.seviye : liste[0] || '');
  }

  function bulmacaListesiTazele(d) {
    const sec = $('#bulmaca');
    const secili = sec.value;
    const liste = d.ogretmen.bulmacaListesi.filter((b) => b.grup === $('#grup').value && b.seviye === $('#seviye').value);
    sec.innerHTML = '<option value="">🎲 Rastgele (oynanmamışlardan)</option>' +
      liste.map((b) => `<option value="${b.id}">${b.id} · ${b.baslik}</option>`).join('');
    if (liste.some((b) => b.id === secili)) sec.value = secili;
  }

  function ogrencileriCiz(oyuncular) {
    const tb = $('#ogrenciler');
    tb.innerHTML = '';
    $('#bosMesaj').hidden = oyuncular.length > 0;
    const ort = oyuncular.length
      ? Math.round(oyuncular.reduce((t, o) => t + o.ilerleme, 0) / oyuncular.length) : 0;
    $('#ilerlemeOzet').textContent = oyuncular.length ? `· ortalama ilerleme %${ort}` : '';

    oyuncular.forEach((o, i) => {
      const tr = document.createElement('tr');
      tr.className = o.cevrimici ? '' : 'cevrimdisi';
      tr.innerHTML =
        `<td>${i + 1}</td>` +
        `<td class="ad">${kacir(o.ad)}${o.bitti ? ' 🎉' : ''}</td>` +
        `<td>${o.cevrimici ? '🟢 çevrimiçi' : '🔴 çevrimdışı'}` +
        `${o.takimAd ? `<br><span class="alt">👥 ${kacir(o.takimAd)}</span>` : ''}</td>` +
        `<td><span class="cubuk"><i style="width:${o.ilerleme}%"></i></span> %${o.ilerleme}</td>` +
        `<td>${o.kesin}</td><td>${o.denemeler}</td>` +
        `<td class="puan-h"><b>${o.puan}</b></td>` +
        `<td>${o.turPuani ? '+' + o.turPuani : '–'}</td>` +
        `<td class="islem"></td>`;
      const islem = tr.querySelector('.islem');
      islem.append(
        dugme('+5', 'btn-mini', () => socket.emit('t:puan', { id: o.id, delta: 5 })),
        dugme('−5', 'btn-mini', () => socket.emit('t:puan', { id: o.id, delta: -5 })),
        dugme('✏️', 'btn-mini', () => {
          const ad = prompt('Yeni ad:', o.ad);
          if (ad) socket.emit('t:isim', { id: o.id, ad });
        }, 'İsmi değiştir'),
        dugme('🚫', 'btn-mini', () => {
          if (confirm(`${o.ad} oyundan çıkarılsın mı? (2 dakika aynı isimle giremez)`)) socket.emit('t:at', { id: o.id });
        }, 'Oyundan çıkar')
      );
      tb.appendChild(tr);
    });
  }

  function podyumCiz(podyum) {
    const ol = $('#podyum');
    ol.innerHTML = '';
    $('#podyumBos').hidden = podyum.length > 0;
    const madalya = ['🥇', '🥈', '🥉'];
    podyum.slice(0, 3).forEach((p, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span class="madalya">${madalya[i]}</span> <b>${kacir(p.ad)}</b> <span class="sure">${(p.sure / 1000).toFixed(0)} sn · +${p.puan} puan</span>`;
      ol.appendChild(li);
    });
  }

  function cozumCiz(d) {
    const ip = $('#ipucuListe'), t = $('#cozumTablo'), not = $('#cozumNot');
    if (!d.bulmaca || !d.ogretmen.cozum) {
      ip.innerHTML = '<p class="alt">Tur başlayınca burada bulmacanın ipuçları ve çözümü görünür.</p>';
      t.innerHTML = '';
      not.hidden = true;
      return;
    }
    not.hidden = false;
    not.innerHTML = `👉 Şu anki bulmacanın anlatımlı çözümü: <code>data/cozumler.md</code> dosyasında ` +
      `<code>### ${kacir(d.bulmaca.id)}</code> başlığı altında.`;
    ip.innerHTML = `<h3>${kacir(d.bulmaca.baslik)} · ${d.bulmaca.id}</h3><ol>` +
      d.bulmaca.ipuclari.map((x) => `<li>${kacir(x)}</li>`).join('') + '</ol>';
    const kat = d.bulmaca.kategoriler;
    t.innerHTML = '<thead><tr>' + kat.map((k) => `<th>${kacir(k.ad)}</th>`).join('') + '</tr></thead><tbody>' +
      d.ogretmen.cozum.map((satir) => '<tr>' + kat.map((k) => `<td>${kacir(satir[k.ad])}</td>`).join('') + '</tr>').join('') +
      '</tbody>';
  }

  function sayacYaz(kalanSn) {
    const e = $('#sayac');
    if (kalanSn === null || kalanSn === undefined) { e.hidden = true; return; }
    e.hidden = false;
    const dk = Math.floor(kalanSn / 60), sn = kalanSn % 60;
    e.querySelector('b').textContent = `${dk}:${String(sn).padStart(2, '0')}`;
  }

  /* ---------------- olaylar ---------------- */
  function ayarYolla() {
    socket.emit('t:ayar', {
      grup: $('#grup').value,
      seviye: $('#seviye').value,
      mod: $('#mod').value,
      sureSn: Math.max(0, Math.min(60, Number($('#sure').value) || 0)) * 60
    });
  }
  ['#grup', '#seviye', '#mod', '#sure'].forEach((s) => $(s).addEventListener('change', () => {
    if (s === '#grup' && son) seviyeListesiTazele(son);   // grup değişince seviye listesi de daralır
    ayarYolla();
    if (s === '#grup' || s === '#seviye') { if (son) bulmacaListesiTazele(son); }
  }));

  $('#baslatBtn').addEventListener('click', () => {
    ayarYolla();
    socket.emit('t:basla', { bulmacaId: $('#bulmaca').value || null }, (r) => {
      if (r && r.hata) duyuruGoster('⚠️ ' + r.hata);
    });
  });
  $('#duraklatBtn').addEventListener('click', () => {
    socket.emit('t:duraklat', { deger: !(son && son.duraklatildi) });
  });
  $('#bitirBtn').addEventListener('click', () => {
    if (confirm('Tur bitirilsin mi? Öğrenciler sonuç ekranını görecek.')) socket.emit('t:bitir', {});
  });
  $('#iptalBtn').addEventListener('click', () => {
    if (confirm('Bu bulmacadan dağıtılan TÜM puanlar herkesten geri alınacak. Onaylıyor musun?')) socket.emit('t:iptal', {});
  });
  $('#sifirlaBtn').addEventListener('click', () => {
    if (confirm('Tüm puanlar sıfırlanacak ve oyun lobiye dönecek. Emin misin?')) socket.emit('t:sifirla', {});
  });
  $('#girisKilitBtn').addEventListener('click', () => {
    socket.emit('t:kilit', { tip: 'giris', deger: !(son && son.girisKilitli) });
  });
  $('#isimKilitBtn').addEventListener('click', () => {
    socket.emit('t:kilit', { tip: 'isim', deger: !(son && son.isimKilitli) });
  });
  $('#karistirBtn').addEventListener('click', () => {
    if (!confirm('Takımlar yeniden dağıtılsın mı? Mevcut eşleşmeler bozulur.')) return;
    secilenler = [];
    socket.emit('t:karistir', {}, (r) => {
      if (r && r.hata) duyuruGoster('⚠️ ' + r.hata);
      else if (r && r.ok) duyuruGoster(`🔀 ${r.takim} takım oluşturuldu`);
    });
  });

  $('#esleBtn').addEventListener('click', () => {
    if (secilenler.length !== 2) return;
    socket.emit('t:esle', { id1: secilenler[0], id2: secilenler[1] }, (r) => {
      if (r && r.hata) return duyuruGoster('⚠️ ' + r.hata);
      duyuruGoster(`🔗 Eşlendi: ${r.ad}`);
      secilenler = [];
      if (son) takimlariCiz(son);
    });
  });

  $('#duyuruBtn').addEventListener('click', () => {
    const m = $('#duyuruMetin').value.trim();
    if (!m) return;
    socket.emit('t:duyuru', { mesaj: m });
    $('#duyuruMetin').value = '';
  });

  /* klavye kısayolları */
  document.addEventListener('keydown', (e) => {
    if (/input|select|textarea/i.test(e.target.tagName)) return;
    if (e.key === ' ') { e.preventDefault(); $('#duraklatBtn').click(); }
    if (e.key.toLowerCase() === 'b') $('#baslatBtn').click();
    if (e.key.toLowerCase() === 'n') { $('#bulmaca').value = ''; $('#baslatBtn').click(); }
  });

  /* ---------------- yardımcılar ---------------- */
  function dugme(metin, sinif, fn, baslik) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + sinif;
    b.textContent = metin;
    if (baslik) b.title = baslik;
    b.addEventListener('click', fn);
    return b;
  }
  let dz = null;
  function duyuruGoster(m) {
    const e = $('#duyuru');
    e.textContent = m; e.hidden = false;
    clearTimeout(dz); dz = setTimeout(() => { e.hidden = true; }, 4000);
  }
  function kacir(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }
})();
