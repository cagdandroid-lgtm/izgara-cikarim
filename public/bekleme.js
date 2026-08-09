/* Beklerken oynanan mini oyun: "Hafıza Kartları".
   Tamamen istemci tarafındadır — sunucuya hiçbir şey göndermez, sınıf puanını ETKİLEMEZ.
   Yalnız bulmacayı erken bitiren öğrencinin bekleme ekranında açılır. */
(function (global) {
  'use strict';

  const EMOJILER = ['🧙', '🪐', '🍰', '🐾', '🎵', '🌷', '📚', '⚽', '🎈', '🚀', '🦊', '🍄'];
  const CIFT = 6;             // 6 çift = 12 kart (4×3)
  const KAPALI_GERI_MS = 800;

  function karistir(a) {
    const b = a.slice();
    for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
    return b;
  }

  const Bekleme = {
    kap: null, kartlar: [], acikIndex: [], eslesen: 0, hamle: 0,
    kilit: false, baslangic: 0, sayacId: null, calisiyor: false,

    /* Bekleme ekranındaki aç/kapa düğmesini bağlar (app.js bir kez çağırır) */
    bagla(alanId, kutuId, dugmeId) {
      this.alan = document.getElementById(alanId);
      this.kutu = document.getElementById(kutuId);
      this.dugme = document.getElementById(dugmeId);
      if (!this.dugme) return;
      this.dugme.addEventListener('click', () => {
        const acilacak = this.kutu.hidden;
        this.kutu.hidden = !acilacak;
        this.dugme.setAttribute('aria-expanded', String(acilacak));
        this.dugme.textContent = acilacak ? '✖️ Oyunu kapat' : '🎮 Beklerken oyna';
        if (acilacak) this.baslat(this.kutu); else this.durdur();
      });
    },

    /* Bekleme ekranı açıldı/kapandı: kapanınca oyun da durur */
    goster(acik) {
      if (!this.alan) return;
      if (acik) { this.alan.hidden = false; return; }
      this.alan.hidden = true;
      if (this.kutu) this.kutu.hidden = true;
      if (this.dugme) {
        this.dugme.setAttribute('aria-expanded', 'false');
        this.dugme.textContent = '🎮 Beklerken oyna';
      }
      this.durdur();
    },

    baslat(kap) {
      this.durdur();
      this.kap = kap;
      this.calisiyor = true;
      this._kur();
    },

    durdur() {
      this.calisiyor = false;
      if (this.sayacId) clearInterval(this.sayacId);
      this.sayacId = null;
      if (this.kap) this.kap.innerHTML = '';
    },

    _kur() {
      const secilen = karistir(EMOJILER).slice(0, CIFT);
      this.kartlar = karistir(secilen.concat(secilen)).map((e, i) => ({ i, emoji: e, acik: false, bulundu: false }));
      this.acikIndex = [];
      this.eslesen = 0;
      this.hamle = 0;
      this.kilit = false;
      this.baslangic = Date.now();

      this.kap.innerHTML =
        '<p class="mini-yonerge">Aynı iki simgeyi bul. Bu oyun sınıf puanını etkilemez 🙂</p>' +
        '<div class="mini-durum"><span id="miniHamle">Hamle: 0</span>' +
        '<span id="miniSure">Süre: 0 sn</span>' +
        '<span id="miniRekor"></span></div>' +
        '<div class="mini-tahta" id="miniTahta"></div>' +
        '<p class="mini-sonuc" id="miniSonuc" role="status" aria-live="polite"></p>';

      const tahta = this.kap.querySelector('#miniTahta');
      this.kartlar.forEach((k) => {
        const d = document.createElement('button');
        d.type = 'button';
        d.className = 'mini-kart';
        d.dataset.i = String(k.i);
        d.setAttribute('aria-label', 'kapalı kart');
        d.textContent = '❓';
        d.addEventListener('click', () => this._tikla(k.i));
        tahta.appendChild(d);
      });

      this._rekorYaz();
      if (this.sayacId) clearInterval(this.sayacId);
      this.sayacId = setInterval(() => this._sureYaz(), 500);
    },

    _tikla(i) {
      if (this.kilit || !this.calisiyor) return;
      const k = this.kartlar[i];
      if (!k || k.acik || k.bulundu) return;
      this._ac(i, true);
      this.acikIndex.push(i);

      if (this.acikIndex.length < 2) return;
      this.hamle++;
      this._yaz('#miniHamle', 'Hamle: ' + this.hamle);
      const [a, b] = this.acikIndex;

      if (this.kartlar[a].emoji === this.kartlar[b].emoji) {
        this.kartlar[a].bulundu = this.kartlar[b].bulundu = true;
        this.acikIndex = [];
        this.eslesen++;
        [a, b].forEach((x) => {
          const el = this._el(x);
          if (el) { el.classList.add('bulundu'); el.disabled = true; }
        });
        if (this.eslesen === CIFT) this._bitir();
        return;
      }

      this.kilit = true;
      setTimeout(() => {
        [a, b].forEach((x) => this._ac(x, false));
        this.acikIndex = [];
        this.kilit = false;
      }, KAPALI_GERI_MS);
    },

    _el(i) { return this.kap ? this.kap.querySelector(`.mini-kart[data-i="${i}"]`) : null; },

    _ac(i, acik) {
      const k = this.kartlar[i], el = this._el(i);
      if (!k || !el) return;
      k.acik = acik;
      el.textContent = acik ? k.emoji : '❓';
      el.classList.toggle('acik', acik);
      el.setAttribute('aria-label', acik ? k.emoji + ' kartı açık' : 'kapalı kart');
    },

    _sureYaz() {
      if (!this.calisiyor || !this.kap) return;
      this._yaz('#miniSure', 'Süre: ' + Math.round((Date.now() - this.baslangic) / 1000) + ' sn');
    },

    _yaz(sec, metin) {
      const el = this.kap && this.kap.querySelector(sec);
      if (el) el.textContent = metin;
    },

    _rekorYaz() {
      const r = this._rekor();
      this._yaz('#miniRekor', r ? `Rekorun: ${r.hamle} hamle` : '');
    },
    _rekor() {
      try { return JSON.parse(localStorage.getItem('izgara_mini_rekor') || 'null'); } catch (e) { return null; }
    },

    _bitir() {
      if (this.sayacId) clearInterval(this.sayacId);
      this.sayacId = null;
      const sn = Math.round((Date.now() - this.baslangic) / 1000);
      const eski = this._rekor();
      const yeniRekor = !eski || this.hamle < eski.hamle;
      if (yeniRekor) {
        try { localStorage.setItem('izgara_mini_rekor', JSON.stringify({ hamle: this.hamle, sn })); } catch (e) { /* yoksay */ }
      }
      const sonuc = this.kap.querySelector('#miniSonuc');
      if (sonuc) {
        sonuc.innerHTML = `🎉 Tamamladın! <b>${this.hamle}</b> hamle · <b>${sn}</b> sn` +
          (yeniRekor ? ' · <b>yeni rekor!</b> 🏅' : '');
      }
      const yeniden = document.createElement('button');
      yeniden.type = 'button';
      yeniden.className = 'btn btn-ikincil mini-yeniden';
      yeniden.textContent = '🔁 Yeniden oyna';
      yeniden.addEventListener('click', () => this._kur());
      if (sonuc) sonuc.appendChild(document.createElement('br'));
      if (sonuc) sonuc.appendChild(yeniden);
    }
  };

  global.BeklemeOyunu = Bekleme;
})(window);
