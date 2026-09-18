/* Öğretmen paneli. Yetki çerezi sunucuda doğrulanır; buradaki düğmeler yalnız olay yollar. */
(function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const socket = io();

  let son = null;              // son gelen durum
  let listelerDolu = false;

  TakimUI.kur(socket, duyuruGoster, () => son);
  Rapor.kur(socket);                     // ölçme/rapor bölümü (public/rapor.js)
  ListeUI.kur(socket, duyuruGoster);     // öğrenci listesi bölümü (public/liste.js)

  socket.on('durum', (d) => {
    if (!d.ogretmen) return;
    son = d;
    ciz(d);
  });

  socket.on('duyuru', ({ mesaj }) => duyuruGoster('📣 ' + mesaj));
  socket.on('saat', ({ kalanSn }) => sayacYaz(kalanSn));

  Bildirim.kur(socket, () => son);   // tur bitti uyarısı (public/bildirim.js)

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
    const oturumAdi = {
      bosta: '⚪ Boşta', lobi: '⏳ Lobi',
      oyun: d.duraklatildi ? '⏸ Duraklatıldı' : '🟢 Oyunda', sonuc: '🏁 Tur bitti'
    };
    $('#fazRozet').textContent = oturumAdi[d.oturum] || d.oturum;
    $('#modRozet').textContent =
      d.mod === 'birlikte' ? '🤝 Birlikte' : d.mod === 'ikili' ? '👥 İkili Mod' : '🏁 Yarış';
    $('#turRozet').textContent = 'Tur ' + d.turNo + (d.bulmaca ? ' · ' + d.bulmaca.id : '');
    const sahnedekiler = d.ogretmen.oyuncular.filter((o) => !o.farkliGrup);
    $('#oyuncuSayi').textContent = '👥 ' + sahnedekiler.length +
      ' (' + sahnedekiler.filter((o) => o.cevrimici).length + ' çevrimiçi)';
    oturumOzetCiz(d);
    sayacYaz(d.kalanSn);

    if (!listelerDolu) doldurListeler(d);
    $('#grup').value = d.grup;
    seviyeListesiTazele(d);
    $('#seviye').value = d.ogretmen.seviye;
    $('#mod').value = d.mod;
    if (document.activeElement !== $('#sure')) $('#sure').value = Math.round(d.sureSn / 60);
    if (document.activeElement !== $('#dersEtiketi')) $('#dersEtiketi').value = d.ogretmen.dersEtiketi || '';
    bulmacaListesiTazele(d);

    if (document.activeElement !== $('#ilerlemeMod')) $('#ilerlemeMod').value = d.ilerlemeMod;
    $('#ilerlemeMod').title = d.faz === 'oyun'
      ? 'Tur sürerken yapılan değişiklik SONRAKİ turda geçerli olur.' : '';
    $('#gecis').value = d.gecis;
    $('#gecis').disabled = d.ilerlemeMod === 'bireysel';
    if (document.activeElement !== $('#otomatikDoldur')) $('#otomatikDoldur').checked = !!d.otomatikDoldur;
    $('#mod').disabled = d.ilerlemeMod === 'bireysel';
    // "Sıradaki" yalnız senkron + öğretmen onaylı modda, tur bittiğinde anlamlıdır
    // (2) grup/etkinlik yalnız BOŞTA ve LOBİ'de seçilebilir
    const secilebilir = d.ogretmen.secilebilir;
    ['#grup', '#seviye', '#yayinlaBtn'].forEach((x) => { $(x).disabled = !secilebilir; });
    $('#kilitNot').hidden = secilebilir;
    $('#sonrakiBtn').hidden = !(d.ilerlemeMod === 'senkron' && d.gecis === 'onayli');
    $('#sonrakiBtn').disabled = d.faz !== 'sonuc';
    $('#duraklatBtn').textContent = d.duraklatildi ? '▶️ Devam Ettir' : '⏸ Duraklat';
    $('#duraklatBtn').disabled = d.faz !== 'oyun';
    $('#bitirBtn').disabled = d.faz !== 'oyun';
    $('#girisKilitBtn').textContent = d.girisKilitli ? '🔒 Girişler Kilitli' : '🔓 Girişler Açık';
    $('#girisKilitBtn').classList.toggle('etkin', d.girisKilitli);

    Rapor.ciz(d);                          // ölçme özeti, kod eşlemesi, açık rapor ekranı
    ListeUI.tazele(d.ogretmen.liste, d.ogretmen.gruplarBilgi);   // öğrenci listesi bölümü
    ogrencileriCiz(d.ogretmen.oyuncular);
    TakimUI.ciz(d);
    podyumCiz(d.podyum);
    cozumCiz(d);
  }

  /* Öğrencilerin ne gördüğünü tek satırda özetler (bekleme ekranı mı, isim kartları mı) */
  function oturumOzetCiz(d) {
    const l = d.ogretmen.lobi;
    const gAdi = gAd[d.grup] || d.grup;
    const etiket = d.ogretmen.dersEtiketi ? `🏷 ${d.ogretmen.dersEtiketi} · ` : '';
    $('#oturumOzet').textContent = l.secimYapildi
      ? `· ${etiket}${gAdi} yayında · ${l.ogrenciler.length} isim kartı · ${l.ogrenciler.filter((o) => o.oyunda).length} tanesi girdi`
      : `· ${etiket}öğrenciler bekleme ekranında — grup seçin ya da “Grubu Yayınla” deyin`;
    $('#yayinNot').hidden = l.secimYapildi;
    $('#yayinlaBtn').disabled = l.secimYapildi;
    $('#aktifGrupAd').textContent = gAdi;
  }

  /* Grup adları tek kaynaktan (data/gruplar.json → sunucu): "🧭 U Grubu".
     Eski "i"/"c" kodları geriye dönük olarak U Grubu'na çözülür. */
  let grupHaritasi = {};
  const gAd = new Proxy({}, {
    get: (_, kod) => {
      const k = String(kod || '').toLowerCase();
      const g = grupHaritasi[k] || Object.values(grupHaritasi).find((x) => (x.eskiKodlar || []).includes(k));
      return g ? `${g.emoji} ${g.ad}` : undefined;
    }
  });

  function doldurListeler(d) {
    grupHaritasi = {};
    (d.ogretmen.gruplarBilgi || []).forEach((g) => { grupHaritasi[g.kod] = g; });
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
    const sv = d.ogretmen.seviye;
    sec.value = liste.includes(secili) ? secili : (liste.includes(sv) ? sv : liste[0] || '');
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
    const sahnede = oyuncular.filter((o) => !o.farkliGrup);
    const disarida = oyuncular.filter((o) => o.farkliGrup);

    const tb = $('#ogrenciler');
    tb.innerHTML = '';
    $('#bosMesaj').hidden = sahnede.length > 0;
    const ort = sahnede.length
      ? Math.round(sahnede.reduce((t, o) => t + o.ilerleme, 0) / sahnede.length) : 0;
    const bireysel = son && son.ilerlemeMod === 'bireysel';
    $('#ilerlemeOzet').textContent = !sahnede.length ? ''
      : bireysel
        ? `· 🎯 bireysel · ortalama soru: ${(sahnede.reduce((t, o) => t + o.soruNo, 0) / sahnede.length).toFixed(1)}`
        : `· 👥 senkron · ${sahnede.filter((o) => o.bitti).length}/${sahnede.length} cevapladı · ortalama tablo %${ort}`;

    sahnede.forEach((o, i) => tb.appendChild(ogrenciSatiri(o, i + 1)));

    // farklı gruptan girenler ayrı listelenir; sahneye ve sayaca dahil DEĞİLdir
    $('#farkliGrupKutu').hidden = disarida.length === 0;
    const fb = $('#farkliGrupListe');
    fb.innerHTML = '';
    disarida.forEach((o) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td class="kod-h">${kacir(o.kod)}</td><td class="ad">${kacir(o.ad)}</td>` +
        `<td>⚠ ${kacir((gAd[o.grup] || o.grup))}</td><td class="islem"></td>`;
      tr.querySelector('.islem').append(
        dugme('↪️ Aktif gruba al', 'btn-mini', () => socket.emit('t:grubaTasi', { id: o.id }), 'Bu oturumun grubuna taşı'),
        dugme('🚫 Çıkar', 'btn-mini', () => {
          if (confirm(`${o.ad} oyundan çıkarılsın mı?`)) socket.emit('t:at', { id: o.id });
        }, 'Oyundan çıkar')
      );
      fb.appendChild(tr);
    });
  }

  function ogrenciSatiri(o, sira) {
    const tr = document.createElement('tr');
    tr.className = o.cevrimici ? '' : 'cevrimdisi';
    tr.innerHTML =
      `<td>${sira}</td>` +
      `<td class="kod-h">${kacir(o.kod)}${o.misafir ? ' <span class="rozet tek">misafir</span>' : ''}</td>` +
      `<td class="ad"><button type="button" class="ad-btn" title="Öğrenci raporunu aç">` +
      `${kacir(o.ad)}${o.bitti ? ' 🎉' : ''}</button></td>` +
      `<td>${o.cevrimici ? '🟢 çevrimiçi' : '🔴 çevrimdışı'}` +
      `${o.takimAd ? `<br><span class="alt">👥 ${kacir(o.takimAd)}</span>` : ''}</td>` +
      `<td>${o.tamamlandi ? '🏅 bitti' : o.soruNo}${o.bitti && !o.tamamlandi ? ' ✔' : ''}</td>` +
      `<td title="ilk denemede doğru / cevaplanan">${o.isabet}/${o.soruSayisi}</td>` +
      `<td title="ızgarayı kullandı mı">${o.tabloKullandi ? '🧮 %' + o.ilerleme : '—'}</td>` +
      `<td class="puan-h"><b>${o.puan}</b></td>` +
      `<td>${o.turPuani ? '+' + o.turPuani : '–'}</td>` +
      `<td class="islem"></td>`;
    tr.querySelector('.ad-btn').addEventListener('click', () => Rapor.raporAc(o.id));
    tr.querySelector('.islem').append(
      dugme('📄', 'btn-mini', () => Rapor.raporAc(o.id), 'Öğrenci raporu'),
      dugme('+5', 'btn-mini', () => socket.emit('t:puan', { id: o.id, delta: 5 })),
      dugme('−5', 'btn-mini', () => socket.emit('t:puan', { id: o.id, delta: -5 })),
      dugme('🔓', 'btn-mini', () => {
        if (confirm(`${o.ad} ismi serbest bırakılsın mı? Kart yeniden seçilebilir olur, oturumdaki puanı silinir.`)) {
          socket.emit('t:serbest', { id: o.id });
        }
      }, 'İsmi serbest bırak (yanlış isme dokunulduysa)'),
      dugme('🚫', 'btn-mini', () => {
        if (confirm(`${o.ad} oyundan çıkarılsın mı? (2 dakika aynı kodla giremez)`)) socket.emit('t:at', { id: o.id });
      }, 'Oyundan çıkar')
    );
    return tr;
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
    const sn = $('#soruNot');
    const soru = d.ogretmen.soru;
    sn.hidden = !soru;
    if (soru) {
      sn.innerHTML = `🔎 <b>Sınıfa sorulan görev:</b> ${kacir(soru.metin)} ` +
        `<span class="alt">(${soru.olasilik} olasılık — tam eşleştirme, tek gönderim)</span><br>` +
        `<b>Doğru eşleştirme:</b> ${kacir((soru.dogruAtama || []).map((x) => `${x.ozne} → ${x.dogru}`).join(' · '))}`;
    }
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
      dersEtiketi: $('#dersEtiketi').value,
      ilerlemeMod: $('#ilerlemeMod').value,
      gecis: $('#gecis').value,
      otomatikDoldur: $('#otomatikDoldur').checked,
      grup: $('#grup').value,
      seviye: $('#seviye').value,
      mod: $('#mod').value,
      sureSn: Math.max(0, Math.min(60, Number($('#sure').value) || 0)) * 60
    });
  }
  ['#grup', '#seviye', '#mod', '#sure', '#ilerlemeMod', '#gecis', '#otomatikDoldur'].forEach((s) => $(s).addEventListener('change', () => {
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
  $('#sonrakiBtn').addEventListener('click', () => {
    socket.emit('t:sonraki', {}, (r) => {
      if (r && r.hata) duyuruGoster('⚠️ ' + r.hata);
      else if (r && r.bulmacaId) duyuruGoster('⏭ Sıradaki soru: ' + r.bulmacaId);
    });
  });
  $('#etkinlikBitirBtn').addEventListener('click', () => {
    if (!confirm('Etkinlik kapanacak, öğrenciler isim ekranına dönecek. Emin misiniz?')) return;
    socket.emit('t:etkinlikBitir', {}, (r) => {
      if (r && r.hata) return duyuruGoster('⚠️ ' + r.hata);
      duyuruGoster(`⏹ Etkinlik bitti · ${(r && r.dusen) || 0} öğrenci isim ekranına döndü. ` +
        'Yeni grup seçip yayınlayabilirsiniz.');
    });
  });

  $('#bitirBtn').addEventListener('click', () => {
    if (confirm('Bu TUR bitirilsin mi? Oturum ve grup devam eder, öğrenciler sonuç ekranını görür.')) socket.emit('t:bitir', {});
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
  function etiketYolla() {
    socket.emit('t:etiket', { metin: $('#dersEtiketi').value });
  }
  $('#dersEtiketi').addEventListener('change', etiketYolla);
  $('#dersEtiketi').addEventListener('blur', etiketYolla);
  $('#dersEtiketi').addEventListener('keydown', (e) => { if (e.key === 'Enter') etiketYolla(); });

  $('#yayinlaBtn').addEventListener('click', () => {
    ayarYolla();
    socket.emit('t:yayinla', { dersEtiketi: $('#dersEtiketi').value }, (r) => {
      if (r && r.ok) duyuruGoster(`🎬 ${gAd[r.grup] || r.grup} yayında — isim kartları öğrencilerde.`);
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
    if (!$('#raporKatman').hidden) return;          // rapor ekranı açıkken kısayollar kapalı
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
