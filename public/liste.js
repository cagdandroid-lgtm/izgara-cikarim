/* Öğrenci Listesi yönetim ekranı (panelin EN SON, varsayılan KAPALI bölümü).
   data/ogrenciler.json içeriğini gösterir; ekleme/düzenleme/pasifleştirme oturum içinde
   anında geçerlidir, kalıcılık için "Listeyi İndir" ile dosya indirilir. */
window.ListeUI = (function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const kacir = (s) => String(s === undefined || s === null ? '' : s)
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const GRUP_ADI = { p: 'P grubu', e: 'E grubu', i: 'İ grubu', c: 'C grubu' };
  const kucuk = (s) => String(s || '').toLocaleLowerCase('tr');

  let socket = null, liste = [], bilgi = () => {};

  function kur(s, bilgiFn) {
    socket = s;
    bilgi = bilgiFn || (() => {});
    ['#listeGrup', '#listeDurum'].forEach((x) => $(x).addEventListener('change', ciz));
    $('#listeArama').addEventListener('input', ciz);
    $('#listeEkleBtn').addEventListener('click', ekle);
    $('#listeIndirBtn').addEventListener('click', indir);
    $('#misafirBtn').addEventListener('click', misafirEkle);
    $('#misafirAd').addEventListener('keydown', (e) => { if (e.key === 'Enter') misafirEkle(); });
  }

  function tazele(yeniListe) {
    liste = yeniListe || [];
    ciz();
  }

  function suzulmus() {
    const g = $('#listeGrup').value || 'hepsi';
    const d = $('#listeDurum').value || 'hepsi';
    const a = kucuk(($('#listeArama').value || '').trim());
    return liste.filter((o) =>
      (g === 'hepsi' || o.grup === g) &&
      (d === 'hepsi' || (d === 'aktif' ? o.aktif : !o.aktif)) &&
      (!a || kucuk(o.isim).includes(a) || kucuk(o.kod).includes(a)));
  }

  function ciz() {
    const kayitlar = suzulmus();
    const aktif = liste.filter((o) => o.aktif && !o.misafir).length;
    const misafir = liste.filter((o) => o.misafir).length;
    $('#listeOzet').textContent =
      `· ${liste.length - misafir} kayıt · ${aktif} aktif` + (misafir ? ` · ${misafir} misafir` : '') +
      ` · görünen ${kayitlar.length}`;
    $('#listeBos').hidden = kayitlar.length > 0;

    const tb = $('#listeGovde');
    tb.innerHTML = '';
    kayitlar.forEach((o) => {
      const tr = document.createElement('tr');
      tr.className = o.aktif ? '' : 'cevrimdisi';
      tr.innerHTML =
        `<td class="kod-h">${kacir(o.kod)}</td>` +
        `<td class="ad">${kacir(o.isim)}${o.misafir ? ' <span class="rozet tek">misafir</span>' : ''}</td>` +
        `<td>${kacir(GRUP_ADI[o.grup] || o.grup)}</td>` +
        `<td>${o.aktif ? '✅ aktif' : '⛔ pasif'}</td>` +
        `<td class="islem"></td>`;
      const islem = tr.querySelector('.islem');
      islem.append(
        dugme('✏️', 'btn-mini', () => {
          const isim = prompt(`${o.kod} — yeni isim:`, o.isim);
          if (isim) yolla('t:listeGuncelle', { kod: o.kod, isim });
        }, 'İsmi düzelt'),
        dugme('↔️', 'btn-mini', () => {
          const grup = prompt(`${o.kod} — grup (p / e / i / c):`, o.grup);
          if (grup) yolla('t:listeGuncelle', { kod: o.kod, grup: kucuk(grup).trim() });
        }, 'Grubunu değiştir'),
        dugme(o.aktif ? '⛔' : '✅', 'btn-mini', () => {
          if (o.aktif && !confirm(`${o.isim} pasif yapılsın mı? (Kayıt silinmez, giriş ekranında görünmez.)`)) return;
          yolla('t:listeGuncelle', { kod: o.kod, aktif: !o.aktif });
        }, o.aktif ? 'Pasifleştir' : 'Yeniden aktif et')
      );
      tb.appendChild(tr);
    });
  }

  function ekle() {
    const isim = $('#yeniIsim').value.trim();
    if (isim.length < 2) return bilgi('⚠️ İsim en az 2 harf olmalı.');
    yolla('t:listeEkle', { isim, grup: $('#yeniGrup').value, kod: $('#yeniKod').value.trim() }, (r) => {
      $('#yeniIsim').value = ''; $('#yeniKod').value = '';
      bilgi(`🧾 ${r.kod} eklendi: ${isim}`);
    });
  }

  function misafirEkle() {
    const ad = $('#misafirAd').value.trim();
    if (ad.length < 2) return bilgi('⚠️ Misafir adı en az 2 harf olmalı.');
    yolla('t:misafir', { ad }, (r) => {
      $('#misafirAd').value = '';
      bilgi(`🙋 Misafir eklendi: ${r.kod} · ${r.isim} — giriş ekranında kartı göründü.`);
    });
  }

  function indir() {
    socket.emit('t:listeIndir', {}, (r) => {
      if (!r || !r.icerik) return bilgi('⚠️ Liste alınamadı.');
      const bag = new Blob([r.icerik], { type: 'application/json;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(bag);
      a.download = r.ad;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      bilgi('📥 ogrenciler.json indirildi — depodaki dosyanın yerine koyup push edin.');
    });
  }

  function yolla(olay, veri, ok) {
    socket.emit(olay, veri, (r) => {
      if (r && r.hata) return bilgi('⚠️ ' + r.hata);
      if (ok) ok(r || {});
    });
  }

  function dugme(metin, sinif, fn, baslik) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn ' + sinif;
    b.textContent = metin;
    if (baslik) b.title = baslik;
    b.addEventListener('click', fn);
    return b;
  }

  return { kur, tazele };
})();
