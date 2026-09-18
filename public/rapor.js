/* Ölçme ve raporlar (yalnız öğretmen paneli).
   CSV dışa aktarım · isim↔kod eşlemesi · öğrenci raporu · A4 veli karnesi.
   Öğrenci ekranında bu dosya hiç yüklenmez. */
window.Rapor = (function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const kacir = (s) => String(s === undefined || s === null ? '' : s)
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* Veli diline uygun kategori adları (öğrenci ekranında ASLA görünmez) */
  const KATEGORI_ADI = {
    dogrudan: 'Doğrudan ipucunu okuma',
    olumsuz: 'Olumsuz ipucuyla eleme',
    'coklu-kategori': 'Birden çok kategoriyi birlikte düşünme',
    kosullu: 'Koşullu (eğer–ise) akıl yürütme',
    konum: 'Sıra ve konum ilişkisi',
    siralama: 'Sıralama çıkarımı (boy · yaş · varış)',
    genel: 'Genel çıkarım'
  };
  const KADEME_ADI = {
    'e-1': '1. kademe', 'e-2': '2. kademe', 'i-1': '3. kademe',
    'i-2': '4. kademe', 'c-1': '5. kademe', 'c-2': '6. kademe'
  };

  let socket = null;
  let son = null;             // son durum paketi
  let acikRapor = null;       // açık rapor ekranındaki oyuncu id
  let gecmis = null;          // içe aktarılan önceki oturum: { ad, kayit: Map }

  /* ---------------- kurulum ---------------- */
  function kur(s) {
    socket = s;
    $('#csvBtn').addEventListener('click', csvIndir);
    $('#karneBtn').addEventListener('click', () => karneYazdir(tumOgrenciler()));
    $('#eslesmeBtn').addEventListener('click', () => {
      const k = $('#eslesmeKutu');
      k.hidden = !k.hidden;
      $('#eslesmeBtn').setAttribute('aria-expanded', String(!k.hidden));
    });
    $('#gecmisDosya').addEventListener('change', gecmisYukle);
    document.querySelectorAll('input[name="karneModu"]').forEach((r) =>
      r.addEventListener('change', () => { if (acikRapor) raporCiz(acikRapor); }));
    $('#olcumSifirlaBtn').addEventListener('click', () => {
      if (!confirm('Bu oturumun TÜM ölçüm kayıtları silinecek (isim↔kod eşlemesi kalır). İndirmediyseniz veriler kaybolur. Emin misiniz?')) return;
      socket.emit('t:olcumSifirla', {}, (r) => bilgi(`🧹 ${(r && r.silinen) || 0} kayıt silindi`));
    });
    $('#raporKapat').addEventListener('click', raporKapat);
    $('#raporKatman').addEventListener('click', (e) => { if (e.target.id === 'raporKatman') raporKapat(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') raporKapat(); });
    $('#karneTekBtn').addEventListener('click', () => {
      const o = tumOgrenciler().find((x) => x.id === acikRapor);
      if (o) karneYazdir([o]);
    });
  }

  /* ---------------- her durum yayınında ---------------- */
  function ciz(d) {
    son = d;
    const o = d.ogretmen.olcum;
    $('#olcumOzet').textContent =
      `· ${o.kayit} olay kaydı · ${o.kodlar.length} öğrenci kodu` +
      (dersEtiketi() ? ` · 🏷 ${dersEtiketi()}` : '') +
      (gecmis ? ` · 📂 ${gecmis.ad}` : '');
    $('#olcumHatirlatma').hidden = !(o.aktarilmamis > 0);
    if (o.aktarilmamis > 0) {
      $('#olcumHatirlatmaSayi').textContent = o.aktarilmamis;
    }
    eslesmeCiz(o.kodlar);
    if (acikRapor) raporCiz(acikRapor);          // açık rapor canlı tazelenir
  }

  function eslesmeCiz(kodlar) {
    const tb = $('#eslesmeGovde');
    tb.innerHTML = kodlar.map((k) =>
      `<tr><td><b>${kacir(k.kod)}</b></td><td>${kacir(k.ad)}</td>` +
      `<td>${k.oyunda ? 'oyunda' : '<span class="alt">ayrıldı</span>'}</td></tr>`).join('');
    $('#eslesmeBos').hidden = kodlar.length > 0;
  }

  /* Rapor/karne listesi oturuma bir kez katılmış HERKESİ kapsar: "Etkinliği Bitir"den sonra
     öğrenci listesi boşalsa da öğretmen karneleri üretebilsin. */
  const tumOgrenciler = () => {
    if (!son) return [];
    const canli = son.ogretmen.oyuncular;
    const kodlar = son.ogretmen.olcum.kodlar || [];
    return kodlar.map((k) => canli.find((o) => o.id === k.id) || { id: k.id, ad: k.ad, kod: k.kod })
      .concat(canli.filter((o) => !kodlar.some((k) => k.id === o.id)));
  };
  const dersEtiketi = () => (son && son.ogretmen.dersEtiketi) || '';
  /* Karne/rapor adı: "İsimli" veli içindir, "Kodlu" isim yerine öğrenci kodunu yazar. */
  const kodluMu = () => {
    const s = document.querySelector('input[name="karneModu"]:checked');
    return !!s && s.value === 'kod';
  };
  const gosterAd = (o) => (kodluMu() ? kodOf(o.id) : o.ad);
  const kodOf = (id) => {
    const k = son && son.ogretmen.olcum.kodlar.find((x) => x.id === id);
    return k ? k.kod : '—';
  };
  const ozetOf = (id) => (son && son.ogretmen.olcum.ozetler[id]) || null;

  /* ---------------- CSV dışa aktarım ---------------- */
  function csvIndir() {
    const isimli = document.querySelector('input[name="isimModu"]:checked').value === 'isim';
    socket.emit('t:csv', { isimli }, (r) => {
      if (!r || !r.icerik) return bilgi('⚠️ Dışa aktarılacak kayıt yok.');
      const bag = new Blob([r.icerik], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(bag);
      a.download = r.ad;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      bilgi(`📥 ${r.ad} indirildi (${r.kayit} kayıt, ${isimli ? 'isimli' : 'kodlu'})`);
    });
  }

  /* ---------------- geçen oturum CSV'si ---------------- */
  function gecmisYukle(e) {
    const dosya = e.target.files && e.target.files[0];
    if (!dosya) return;
    const okuyucu = new FileReader();
    okuyucu.onload = () => {
      try {
        const c = csvOzetle(String(okuyucu.result));
        gecmis = { ad: dosya.name, kayit: c.kayit };
        $('#gecmisDurum').textContent =
          `📂 ${dosya.name} · ${c.ogrenci} öğrenci okundu — raporlarda karşılaştırma görünür.`;
      } catch (hata) {
        gecmis = null;
        $('#gecmisDurum').textContent = '⚠️ Dosya okunamadı. Bu oyunun CSV çıktısını seçin.';
      }
      if (son) ciz(son);
    };
    okuyucu.readAsText(dosya, 'utf-8');
  }

  /* Standart sütun adlarıyla gelen CSV → { anahtar -> {gorev, cozulen, dogruluk} } */
  function csvOzetle(metin) {
    const satirlar = metin.replace(/^﻿/, '').split(/\r?\n/).filter((x) => x.trim());
    const basliklar = bolCsv(satirlar[0]);
    const su = (ad) => basliklar.indexOf(ad);
    const iKod = su('ogrenci_kod'), iGorev = su('gorev_id'), iSonuc = su('sonuc'), iAd = su('ogrenci_ad');
    if (iKod < 0 || iGorev < 0 || iSonuc < 0) throw new Error('standart sütunlar yok');
    const donusum = (son && son.ogretmen.kodDonusumu) || {};   // eski İ/C kodları → U kodları
    const ham = new Map();      // anahtar (kod ve varsa ad) -> Map(gorev -> dogruMu)
    const kodlar = new Set();
    for (const satir of satirlar.slice(1)) {
      const h = bolCsv(satir);
      if (h[iKod] && donusum[h[iKod].toUpperCase()]) h[iKod] = donusum[h[iKod].toUpperCase()];
      if (h[iKod]) kodlar.add(h[iKod]);
      for (const anahtar of [h[iKod], iAd >= 0 ? h[iAd] : null]) {
        if (!anahtar) continue;
        const k = anahtar.toLocaleLowerCase('tr');
        const g = ham.get(k) || new Map();
        g.set(h[iGorev], (g.get(h[iGorev]) || false) || h[iSonuc] === 'dogru');
        ham.set(k, g);
      }
    }
    const out = new Map();
    for (const [k, g] of ham) {
      const gorev = g.size, cozulen = [...g.values()].filter(Boolean).length;
      out.set(k, { gorev, cozulen, dogruluk: gorev ? Math.round((100 * cozulen) / gorev) : 0 });
    }
    return { kayit: out, ogrenci: kodlar.size };
  }

  function bolCsv(satir) {
    const out = [];
    let s = '', tirnak = false;
    for (let i = 0; i < satir.length; i++) {
      const c = satir[i];
      if (tirnak) {
        if (c === '"' && satir[i + 1] === '"') { s += '"'; i++; }
        else if (c === '"') tirnak = false;
        else s += c;
      } else if (c === '"') tirnak = true;
      else if (c === ',') { out.push(s); s = ''; }
      else s += c;
    }
    out.push(s);
    return out.map((x) => x.trim());
  }

  function gecmisBul(oyuncu) {
    if (!gecmis) return null;
    return gecmis.kayit.get(kodOf(oyuncu.id).toLocaleLowerCase('tr')) ||
      gecmis.kayit.get(String(oyuncu.ad).toLocaleLowerCase('tr')) || null;
  }

  /* ---------------- öğrenci raporu ekranı ---------------- */
  function raporAc(id) {
    acikRapor = id;
    $('#raporKatman').hidden = false;
    raporCiz(id);
  }
  function raporKapat() {
    acikRapor = null;
    $('#raporKatman').hidden = true;
  }

  function raporCiz(id) {
    const o = tumOgrenciler().find((x) => x.id === id);
    const oz = ozetOf(id);
    if (!o || !oz) { raporKapat(); return; }
    $('#raporBaslik').textContent = kodluMu()
      ? `📄 ${kodOf(id)}` + (dersEtiketi() ? ` · ${dersEtiketi()}` : '')
      : `📄 ${o.ad} · ${kodOf(id)}` + (dersEtiketi() ? ` · ${dersEtiketi()}` : '');
    const eski = gecmisBul(o);
    const fark = eski ? oz.dogruluk - eski.dogruluk : null;
    const kutu = (etiket, deger) => `<div class="olcu"><span class="olcu-deger">${deger}</span><span class="olcu-etiket">${etiket}</span></div>`;
    const katSatirlari = Object.entries(oz.kategoriler).map(([k, v]) =>
      `<tr><td>${kacir(KATEGORI_ADI[k] || k)}</td><td>${v.cozulen}/${v.toplam}</td>` +
      `<td><span class="cubuk"><i style="width:${v.yuzde}%"></i></span> %${v.yuzde}</td></tr>`).join('');

    $('#raporIcerik').innerHTML =
      `<div class="olculer">` +
      kutu('bulmaca', oz.gorev) + kutu('çözdü', oz.cozulen) + kutu('doğruluk', '%' + oz.dogruluk) +
      kutu('ort. süre', oz.ortSureSn + ' sn') + kutu('en uzun seri', oz.enUzunSeri) +
      kutu('kademe', oz.kademe ? KADEME_ADI[oz.kademe] || oz.kademe : '—') +
      `</div>` +
      (eski
        ? `<p class="degisim ${fark >= 0 ? 'arti' : 'eksi'}">📈 Geçen oturuma göre: %${eski.dogruluk} → %${oz.dogruluk} ` +
          `(${fark >= 0 ? '▲ +' : '▼ '}${fark} puan) · geçen oturum ${eski.cozulen}/${eski.gorev} bulmaca</p>`
        : `<p class="alt">📂 Geçen oturum CSV'si yüklenirse burada karşılaştırma görünür.</p>`) +
      `<h3>Kategori bazlı doğruluk</h3>` +
      (katSatirlari
        ? `<div class="tablo-kaydir"><table class="ogr-tablo"><thead><tr><th>Kategori</th><th>Çözülen</th><th>Oran</th></tr></thead><tbody>${katSatirlari}</tbody></table></div>`
        : `<p class="alt">Bu öğrenci için henüz kayıt yok.</p>`) +
      `<p class="alt">Ortalama deneme: ${oz.ortDeneme} · ipucu kullanımı bu oyunda tutulmaz (0).</p>`;
  }

  /* ---------------- A4 veli karnesi ---------------- */
  function veliCumlesi(ad, oz) {
    if (!oz.gorev) return `${ad} bu oturumda henüz bulmaca tamamlamadı.`;
    const guclu = Object.entries(oz.kategoriler).sort((a, b) => b[1].yuzde - a[1].yuzde)[0];
    const zayif = Object.entries(oz.kategoriler).sort((a, b) => a[1].yuzde - b[1].yuzde)[0];
    let c = `${ad}, bu oturumda ${oz.gorev} bulmacanın ${oz.cozulen} tanesini çözdü (%${oz.dogruluk}). `;
    if (guclu) c += `En rahat ilerlediği alan: ${(KATEGORI_ADI[guclu[0]] || guclu[0]).toLocaleLowerCase('tr')}. `;
    if (zayif && guclu && zayif[0] !== guclu[0] && zayif[1].yuzde < 100) {
      c += `Birlikte biraz daha çalışılabilecek alan: ${(KATEGORI_ADI[zayif[0]] || zayif[0]).toLocaleLowerCase('tr')}. `;
    }
    if (oz.enUzunSeri > 1) c += `Üst üste ${oz.enUzunSeri} bulmaca çözdüğü bir seri yakaladı. `;
    c += `Evde “bu ipucundan ne çıkarabiliriz?” diye sorarak aynı düşünme biçimini birlikte deneyebilirsiniz.`;
    return c;
  }

  function karneHtml(o) {
    const oz = ozetOf(o.id) || { gorev: 0, cozulen: 0, dogruluk: 0, ortSureSn: 0, ortDeneme: 0, enUzunSeri: 0, kademe: null, kategoriler: {} };
    const eski = gecmisBul(o);
    const fark = eski ? oz.dogruluk - eski.dogruluk : null;
    const bugun = new Date().toLocaleDateString('tr-TR');
    const kat = Object.entries(oz.kategoriler).map(([k, v]) =>
      `<tr><td>${kacir(KATEGORI_ADI[k] || k)}</td><td class="ortala">${v.cozulen}/${v.toplam}</td>` +
      `<td class="ortala">%${v.yuzde}</td></tr>`).join('') ||
      '<tr><td colspan="3">Bu oturumda kayıt oluşmadı.</td></tr>';
    return `<section class="karne">
      <header><h1>🧩 Izgara Çıkarım — Öğrenci Karnesi</h1>
        <p class="ust-bilgi">UYCEP Logic · ${kacir(bugun)}${dersEtiketi() ? ' · ' + kacir(dersEtiketi()) : ''}</p></header>
      <p class="ogrenci"><b>${kacir(gosterAd(o))}</b>` +
      (kodluMu() ? '' : ` <span class="kod">(${kacir(kodOf(o.id))})</span>`) + `</p>
      <table class="ozet">
        <tr><th>Katıldığı bulmaca</th><td>${oz.gorev}</td><th>Çözdüğü bulmaca</th><td>${oz.cozulen}</td></tr>
        <tr><th>Doğruluk</th><td>%${oz.dogruluk}</td><th>Ortalama süre</th><td>${oz.ortSureSn} sn</td></tr>
        <tr><th>En uzun seri</th><td>${oz.enUzunSeri}</td><th>Ulaştığı kademe</th><td>${oz.kademe ? kacir(KADEME_ADI[oz.kademe] || oz.kademe) : '—'}</td></tr>
      </table>
      ${eski ? `<p class="degisim">Geçen oturuma göre doğruluk: %${eski.dogruluk} → %${oz.dogruluk} (${fark >= 0 ? '+' : ''}${fark} puan)</p>` : ''}
      <h2>Neleri çalıştı?</h2>
      <table class="kategori">
        <thead><tr><th>Düşünme becerisi</th><th class="ortala">Çözülen</th><th class="ortala">Oran</th></tr></thead>
        <tbody>${kat}</tbody>
      </table>
      <h2>Öğretmen notu</h2>
      <p class="veli">${kacir(veliCumlesi(gosterAd(o), oz))}</p>
      <p class="imza">Öğretmen: ..................................................</p>
      <footer>Bu karne sınıf içi etkinlik verilerinden üretilmiştir · Izgara Çıkarım · UYCEP Logic</footer>
    </section>`;
  }

  function karneYazdir(ogrenciler) {
    if (!ogrenciler.length) return bilgi('⚠️ Karne üretilecek öğrenci yok.');
    const pencere = window.open('', '_blank');
    if (!pencere) return bilgi('⚠️ Açılır pencere engellendi. Tarayıcı ayarından izin verin.');
    const baslik = (ogrenciler.length === 1 ? `Karne · ${gosterAd(ogrenciler[0])}` : `Tüm Karneler (${ogrenciler.length})`) +
      (dersEtiketi() ? ` · ${dersEtiketi()}` : '');
    pencere.document.write(`<!doctype html><html lang="tr"><head><meta charset="utf-8">
<title>${kacir(baslik)}</title><style>${KARNE_CSS}</style></head><body>
<div class="arac no-print">
  <button onclick="window.print()">🖨 Yazdır / PDF olarak kaydet</button>
  <span>${ogrenciler.length} öğrenci · her öğrenci için bir A4 sayfa</span>
</div>
${ogrenciler.map(karneHtml).join('')}
</body></html>`);
    pencere.document.close();
    pencere.focus();
    setTimeout(() => { try { pencere.print(); } catch (e) { /* kullanıcı elle yazdırır */ } }, 400);
  }

  const KARNE_CSS = `
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: "Poppins", "Segoe UI", system-ui, sans-serif; color: #1f2430; margin: 0; background: #f4f4f7; }
  .arac { position: sticky; top: 0; background: #fff; border-bottom: 2px solid #ddd; padding: 10px 14px; display: flex; gap: 12px; align-items: center; }
  .arac button { font: inherit; font-weight: 600; padding: 10px 16px; border-radius: 10px; border: 0; background: #2f6f4f; color: #fff; cursor: pointer; min-height: 44px; }
  .karne { background: #fff; width: 190mm; min-height: 262mm; margin: 12px auto; padding: 10mm; page-break-after: always; }
  .karne:last-of-type { page-break-after: auto; }
  h1 { font-size: 20pt; margin: 0 0 2mm; }
  h2 { font-size: 13pt; margin: 7mm 0 2mm; border-bottom: 2px solid #e3e6ee; padding-bottom: 1mm; }
  .ust-bilgi { margin: 0; color: #5a6172; font-size: 10pt; }
  .ogrenci { font-size: 16pt; margin: 6mm 0 4mm; }
  .ogrenci .kod { color: #5a6172; font-size: 11pt; }
  table { width: 100%; border-collapse: collapse; font-size: 11pt; }
  .ozet th { text-align: left; background: #f0f3f9; width: 26%; }
  .ozet td { width: 24%; font-weight: 600; }
  th, td { border: 1px solid #d8dce6; padding: 2.5mm 3mm; }
  .ortala { text-align: center; }
  .kategori thead th { background: #f0f3f9; }
  .veli { font-size: 11.5pt; line-height: 1.6; }
  .degisim { font-size: 11pt; background: #eef6ef; border-left: 4px solid #2f6f4f; padding: 2mm 3mm; }
  .imza { margin-top: 10mm; font-size: 11pt; }
  footer { margin-top: 8mm; font-size: 9pt; color: #6b7280; border-top: 1px solid #e3e6ee; padding-top: 2mm; }
  @media print { .no-print { display: none; } body { background: #fff; } .karne { width: auto; min-height: 0; margin: 0; padding: 0; } }`;

  /* ---------------- yardımcı ---------------- */
  function bilgi(m) {
    const e = $('#duyuru');
    if (!e) return;
    e.textContent = m; e.hidden = false;
    clearTimeout(bilgi._z);
    bilgi._z = setTimeout(() => { e.hidden = true; }, 4000);
  }

  return { kur, ciz, raporAc, kodOf };
})();
