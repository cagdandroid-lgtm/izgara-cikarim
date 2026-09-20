/* ASIL GÖREV: TAM EŞLEŞTİRME. Öğrenci her özneye karşılığını atar; aynı seçenek iki özneye
   verilemez (yeniden seçilirse öbüründen düşer). Gönderim TEK HAKTIR: onay sorulur, sonra kilitlenir.
   Tablo (ızgara) yalnız yardımcıdır; buradan "tablonu kontrol et" ile açılır. */
window.SoruAlani = (function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const kacir = (s) => String(s === undefined || s === null ? '' : s)
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  let socket = null;
  let imza = '';            // o anki görevin kimliği (değişince alan yeniden kurulur)
  let kilit = false;

  function kur(s) {
    socket = s;
    $('#gonderBtn').addEventListener('click', gonder);
    $('#ilerleBtn').addEventListener('click', () => {
      $('#ilerleBtn').disabled = true;
      socket.emit('ilerle', null, (r) => {
        $('#ilerleBtn').disabled = false;
        if (r && r.hata) geri('⚠️ ' + r.hata, 'bekle');
      });
    });
    $('#tabloBagi').addEventListener('click', (e) => {
      e.preventDefault();
      const kutu = $('#izgaraKutu');
      kutu.open = true;
      if (kutu.scrollIntoView) kutu.scrollIntoView({ behavior: 'smooth', block: 'start' });
      $('#kontrolBtn').click();
    });
  }

  function ciz(d) {
    const soru = d.ben.soru;
    $('#soruMetin').textContent = soru ? soru.metin : '—';
    const sayac = $('#soruSayac');
    if (d.ilerlemeMod === 'bireysel') {
      sayac.hidden = false;
      sayac.textContent = `Soru ${d.ben.soruNo}${d.ben.toplamSoru ? '/' + d.ben.toplamSoru : ''}`;
    } else sayac.hidden = true;
    $('#olasilik').textContent = soru ? `${soru.olasilik} olasılık — tahminle tutturulmaz, eleyerek bul` : '';

    const yeniImza = soru
      ? `${d.turNo}#${d.ben.soruNo}#${soru.metin}|${soru.ozneler.join('|')}|${soru.secenekler.join('|')}`
      : '';
    if (yeniImza !== imza) {
      imza = yeniImza;
      kur_alan(soru);
      sonucGizle();
    }
    // sunucudaki kilit (yenilense/koptuğunda da sürer)
    kilitle(!!d.ben.gonderildi || d.duraklatildi || d.faz !== 'oyun');
    if (d.ben.sonGonderim) sonucGoster(d.ben.sonGonderim, d.ben.sonGonderim.puan);
    else sonucGizle();
    // bireyselde sıradaki soruya öğrenci kendi hazır olunca geçer (sonucu okuyabilsin)
    $('#ilerleBtn').hidden = !(d.ilerlemeMod === 'bireysel' && d.ben.ilerlemeyeHazir);
  }

  function kur_alan(soru) {
    const kap = $('#eslestirme');
    kap.innerHTML = '';
    if (!soru) return;
    soru.ozneler.forEach((ozne, i) => {
      const satir = document.createElement('div');
      satir.className = 'eslestirme-satir';
      satir.innerHTML =
        `<label class="ozne" for="atama-${i}">${kacir(ozne)}</label>` +
        `<select class="atama" id="atama-${i}" data-i="${i}">` +
        `<option value="">— seç —</option>` +
        soru.secenekler.map((s, j) => `<option value="${j}">${kacir(s)}</option>`).join('') +
        `</select>`;
      kap.appendChild(satir);
    });
    kap.querySelectorAll('.atama').forEach((sec) => sec.addEventListener('change', () => secildi(sec)));
    tazele();
  }

  /* Aynı seçenek iki özneye verilemez: yeniden seçilirse öbür öznenin seçimi düşer */
  function secildi(sec) {
    const deger = sec.value;
    if (deger !== '') {
      $('#eslestirme').querySelectorAll('.atama').forEach((o) => {
        if (o !== sec && o.value === deger) o.value = '';
      });
    }
    tazele();
  }

  function atamalar() {
    return [...$('#eslestirme').querySelectorAll('.atama')]
      .map((s) => (s.value === '' ? null : Number(s.value)));
  }

  function tazele() {
    const a = atamalar();
    const eksik = a.filter((x) => x === null).length;
    const dg = $('#gonderBtn');
    dg.textContent = eksik ? `📨 Cevabı Gönder (${eksik} eksik)` : '📨 Cevabı Gönder';
    dg.classList.toggle('eksik-var', eksik > 0);
    $('#eslestirme').querySelectorAll('.atama').forEach((s) => {
      s.classList.toggle('dolu', s.value !== '');
    });
  }

  function gonder() {
    if (kilit) return;
    const a = atamalar();
    const kap = $('#eslestirme');
    const eksikAdlar = [...kap.querySelectorAll('.eslestirme-satir')]
      .filter((_, i) => a[i] === null)
      .map((sat) => sat.querySelector('.ozne').textContent);
    if (eksikAdlar.length) {
      geri(`⚠️ Önce herkese bir karşılık seç. Eksik: ${eksikAdlar.join(', ')}`, 'bekle');
      const ilk = kap.querySelector('.atama:not(.dolu)');
      if (ilk && ilk.focus) ilk.focus();
      return;
    }
    if (!confirm('Emin misin? Tek hakkın var — gönderdikten sonra değiştiremezsin.')) return;
    kilitle(true);
    socket.emit('cevap', { atamalar: a }, (c) => {
      if (!c) return kilitle(false);
      if (c.hata) { geri('⚠️ ' + c.hata, 'bekle'); return kilitle(false); }
      sonucGoster(c, c.puan);
      if (c.bekliyor) $('#ilerleBtn').hidden = false;
      if (c.dogru) { Efekt.konfeti(); Efekt.cal('dogru'); } else Efekt.cal('eksik');
    });
  }

  function sonucGoster(c, puan) {
    if (c.dogru && c.tekrar) {
      // öğretmen bu soruya geri döndü: doğru ama bu derste zaten çözülmüştü → puan yok
      geri('🎉 Yine doğru! Bu soruyu bu derste çözmüştün, tekrarında puan verilmiyor.', 'dogru');
      $('#dogruEslestirme').hidden = true;
    } else if (c.dogru) {
      geri(`🎉 Tam isabet! Bütün eşleştirmeler doğru · +${puan || 0} puan`, 'dogru');
      $('#dogruEslestirme').hidden = true;
    } else if (c.gizli || !c.dogruAtama) {
      // senkron mod: doğru eşleştirme tur bitince açılır (kimse sınıfa duyurmasın)
      geri('Cevabın alındı 🌱 Bu kez olmadı; doğru eşleştirmeyi tur bitince birlikte göreceğiz.', 'eksik');
      $('#dogruEslestirme').hidden = true;
    } else {
      geri('Bu kez olmadı 🌱 Puan yok ama doğru eşleştirme aşağıda — ipuçlarını birlikte okuyalım.', 'eksik');
      const kutu = $('#dogruEslestirme');
      kutu.hidden = false;
      kutu.innerHTML = '<h3>✅ Doğru eşleştirme</h3>' +
        '<ul class="dogru-liste">' +
        (c.dogruAtama || []).map((x) => `<li><b>${kacir(x.ozne)}</b> → ${kacir(x.dogru)}</li>`).join('') +
        '</ul><p class="alt">Her ipucu bir eleme demekti: önce kesin ✗\'leri koy, kalan tek seçenek ✓ olur.</p>';
    }
  }

  function sonucGizle() {
    $('#dogruEslestirme').hidden = true;
    geri('', '');
  }

  function kilitle(deger) {
    kilit = !!deger;
    $('#gonderBtn').disabled = kilit;
    $('#eslestirme').querySelectorAll('.atama').forEach((s) => { s.disabled = kilit; });
  }

  function geri(m, tur) {
    const e = $('#cevapGeri');
    e.textContent = m;
    e.className = 'geri-bildirim' + (tur ? ' ' + tur : '');
  }

  return { kur, ciz, kilitle, geri, sonuc: (c) => sonucGoster(c, c.puan) };
})();
