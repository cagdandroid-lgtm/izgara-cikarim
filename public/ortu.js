/* Örtü ekranı: duraklama, tur sonucu, "cevabın kaydedildi" bekleme sahnesi ve
   kapanış rozetleri. Bekleme mini oyunu yalnız buradan açılır (puana etkisi yoktur). */
window.Ortu = (function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const kacir = (s) => String(s === undefined || s === null ? '' : s)
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function durum(d) {
    if (d.duraklatildi) {
      return goster('⏸', 'Öğretmeninizi dinleyin', 'Oyun duraklatıldı, süre donduruldu.');
    }
    if (d.faz === 'sonuc') {
      return sonucGoster(d);
    }
    // erken bitirenler beklerken sıkılmasın: mini oyun yalnız burada açılır
    if (d.ilerlemeMod === 'senkron' && d.ben.bitti) {
      return goster('🎉', 'Cevabın kaydedildi!',
        `⭐ ${d.ben.puan} puan · 📊 Sıran: ${d.ben.siram}/${d.ben.oyuncuSayisi} — arkadaşlarını bekliyoruz…`,
        d.podyum, true);
    }
    if (d.ben.tamamlandi) {
      return goster('🏅', 'Tüm soruları bitirdin!',
        `⭐ ${d.ben.puan} puan · 🎯 ${d.ben.isabet}/${d.ben.soruSayisi} soruyu ilk denemede bildin`, d.podyum, true);
    }
    if (d.mod === 'ikili' && d.ben.takim && d.ben.takim.bitti) {
      return goster('🎉', 'Takımınız çözdü!', 'Diğer takımları bekliyoruz…', d.podyum, true);
    }
    if (d.mod === 'ikili' && !d.ben.takim) {
      return goster('👥', 'Takımın hazırlanıyor', 'Öğretmenin seni bir eşle eşleştirecek.');
    }
    gizle();
  }

  function sonucGoster(d) {
    const kazanan = d.podyum && d.podyum.length ? d.podyum[0].ad : null;
    const r = d.rozetler;
    const rozetMetni = r
      ? `🏆 En Yüksek Puan: ${r.enYuksekPuan.ad} (${r.enYuksekPuan.puan}) · 🎯 En İsabetli: ${r.enIsabetli.ad} (%${r.enIsabetli.yuzde})`
      : '';
    if (rozetMetni) {
      return goster('🏁', 'Tur bitti',
        `${kazanan ? 'Birinci: ' + kazanan + ' · ' : ''}${rozetMetni}\n⭐ Senin puanın: ${d.ben.puan} · 📊 Sıran: ${d.ben.siram}/${d.ben.oyuncuSayisi}`,
        d.podyum);
    }
    if (d.mod === 'ikili') {
      return goster('🏁', 'Tur bitti', kazanan ? `Birinci takım: ${kazanan}` : 'Bu turda bitiren takım olmadı.', d.podyum);
    }
    if (d.mod === 'birlikte') {
      goster('🤝', 'Tur bitti', d.ben.sonSonuc && d.ben.sonSonuc.dogru
        ? 'Sınıfça çözdünüz! Harikasınız 🎉' : 'Öğretmen turu bitirdi. Şimdi birlikte konuşalım.');
    } else {
      goster('🏁', 'Tur bitti', kazanan ? `Birinci: ${kazanan}` : 'Bu turda bitiren olmadı.', d.podyum);
    }
  }

  function goster(ikon, baslik, metin, podyum, miniOyun) {
    BeklemeOyunu.goster(!!miniOyun);
    $('#ortuIkon').textContent = ikon;
    $('#ortuBaslik').textContent = baslik;
    $('#ortuMetin').textContent = metin || '';
    const ol = $('#ortuPodyum');
    ol.innerHTML = '';
    if (podyum && podyum.length) {
      ol.hidden = false;
      const madalya = ['🥇', '🥈', '🥉'];
      podyum.slice(0, 3).forEach((p, i) => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="madalya">${madalya[i]}</span> <b>${kacir(p.ad)}</b> <span class="sure">${(p.sure / 1000).toFixed(0)} sn · +${p.puan}</span>`;
        ol.appendChild(li);
      });
    } else ol.hidden = true;
    $('#ortu').hidden = false;
  }
  function gizle() {
    $('#ortu').hidden = true;
    BeklemeOyunu.goster(false);
  }

  BeklemeOyunu.bagla('beklemeAlani', 'beklemeOyun', 'beklemeAcBtn');

  return { durum, goster, gizle };
})();
