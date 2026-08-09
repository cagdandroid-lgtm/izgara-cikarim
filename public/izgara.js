/* Çıkarım tablolarının çizimi ve işaretlenmesi.
   Hücre durumları: '' (boş) → 'y' (✔) → 'n' (✖) → ''
   Sunucu çözümü asla göndermez; burada yalnız öğrencinin kendi işaretleri tutulur. */
(function (global) {
  'use strict';

  const IKON = { y: '✔', n: '✖', '': '' };
  const ETIKET = { y: 'evet', n: 'hayır', '': 'boş' };

  const Izgara = {
    kap: null,
    bulmaca: null,
    isaretler: {},
    onIsaret: null,
    saltOkunur: false,

    /* Tüm tabloları yeniden çizer */
    ciz(kap, bulmaca, isaretler, secenekler) {
      const s = secenekler || {};
      this.kap = kap;
      this.bulmaca = bulmaca;
      this.isaretler = isaretler || {};
      this.onIsaret = s.onIsaret || null;
      this.saltOkunur = !!s.saltOkunur;
      kap.innerHTML = '';
      if (!bulmaca) return;

      const kat = bulmaca.kategoriler;
      for (let i = 0; i < kat.length; i++) {
        for (let j = i + 1; j < kat.length; j++) {
          kap.appendChild(this._tablo(i, j));
        }
      }
      this.tumHucreleriTazele();
    },

    _tablo(i, j) {
      const kat = this.bulmaca.kategoriler;
      const sar = document.createElement('div');
      sar.className = 'izgara-sarmal';

      const bas = document.createElement('h3');
      bas.className = 'izgara-baslik';
      bas.textContent = `${kat[i].ad} × ${kat[j].ad}`;
      sar.appendChild(bas);

      const kaydir = document.createElement('div');
      kaydir.className = 'izgara-kaydir';
      const t = document.createElement('table');
      t.className = 'izgara';
      t.dataset.p = `${i}-${j}`;

      const thead = document.createElement('thead');
      const hr = document.createElement('tr');
      const bos = document.createElement('th');
      bos.className = 'kose';
      bos.setAttribute('scope', 'col');
      bos.textContent = '';
      hr.appendChild(bos);
      kat[j].ogeler.forEach((o) => {
        const th = document.createElement('th');
        th.setAttribute('scope', 'col');
        th.className = 'sutun-basi';
        th.innerHTML = `<span>${kacir(o)}</span>`;
        hr.appendChild(th);
      });
      thead.appendChild(hr);
      t.appendChild(thead);

      const tbody = document.createElement('tbody');
      kat[i].ogeler.forEach((oa, a) => {
        const tr = document.createElement('tr');
        tr.dataset.satir = String(a);
        const th = document.createElement('th');
        th.setAttribute('scope', 'row');
        th.className = 'satir-basi';
        th.textContent = oa;
        tr.appendChild(th);
        kat[j].ogeler.forEach((ob, b) => {
          const td = document.createElement('td');
          const dg = document.createElement('button');
          dg.type = 'button';
          dg.className = 'hucre';
          dg.dataset.p = `${i}-${j}`;
          dg.dataset.c = `${a}-${b}`;
          dg.setAttribute('aria-label', `${kat[i].ad} ${oa} – ${kat[j].ad} ${ob}: boş`);
          dg.addEventListener('click', () => this._tikla(dg));
          td.appendChild(dg);
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      t.appendChild(tbody);
      kaydir.appendChild(t);
      sar.appendChild(kaydir);
      return sar;
    },

    _tikla(dg) {
      if (this.saltOkunur) return;
      const p = dg.dataset.p, c = dg.dataset.c;
      const suan = (this.isaretler[p] || {})[c] || '';
      const yeni = suan === '' ? 'y' : suan === 'y' ? 'n' : '';
      this._yaz(p, c, yeni);
      if (this.onIsaret) this.onIsaret(p, c, yeni);

      // ✔ konulduğunda aynı satır/sütundaki boş hücreler otomatik ✖ olur (eleme kolaylığı)
      if (yeni === 'y') {
        const [a, b] = c.split('-').map(Number);
        const n = this.bulmaca.kategoriler[0].ogeler.length;
        for (let k = 0; k < n; k++) {
          if (k !== b) this._otomatikHayir(p, `${a}-${k}`);
          if (k !== a) this._otomatikHayir(p, `${k}-${b}`);
        }
      }
      this.tumHucreleriTazele();
    },

    _otomatikHayir(p, c) {
      const suan = (this.isaretler[p] || {})[c] || '';
      if (suan !== '') return;
      this._yaz(p, c, 'n');
      if (this.onIsaret) this.onIsaret(p, c, 'n');
    },

    _yaz(p, c, d) {
      if (!this.isaretler[p]) this.isaretler[p] = {};
      if (d === '') delete this.isaretler[p][c];
      else this.isaretler[p][c] = d;
    },

    /* Sunucudan gelen işaret (birlikte modu) */
    disaridanIsaret(p, c, d) {
      this._yaz(p, c, d);
      this.tumHucreleriTazele();
    },

    isaretleriDegistir(isaretler) {
      this.isaretler = isaretler || {};
      this.tumHucreleriTazele();
    },

    saltOkunurYap(deger) {
      this.saltOkunur = !!deger;
      if (!this.kap) return;
      this.kap.classList.toggle('kilitli', this.saltOkunur);
      this.kap.querySelectorAll('.hucre').forEach((h) => { h.disabled = this.saltOkunur; });
    },

    tumHucreleriTazele() {
      if (!this.kap) return;
      this.kap.querySelectorAll('.hucre').forEach((dg) => {
        const d = (this.isaretler[dg.dataset.p] || {})[dg.dataset.c] || '';
        dg.textContent = IKON[d];
        dg.dataset.d = d;
        const et = dg.getAttribute('aria-label') || '';
        dg.setAttribute('aria-label', et.replace(/: (boş|evet|hayır)$/, ': ' + ETIKET[d]));
        dg.classList.toggle('celiski', false);
      });
      this._celiskileriIsaretle();
    },

    /* Aynı satırda/sütunda birden çok ✔ varsa nazikçe uyar (renk + kesikli çerçeve) */
    _celiskileriIsaretle() {
      if (!this.bulmaca) return;
      const n = this.bulmaca.kategoriler[0].ogeler.length;
      this.kap.querySelectorAll('table.izgara').forEach((t) => {
        const p = t.dataset.p;
        const tablo = this.isaretler[p] || {};
        const satirSay = new Array(n).fill(0), sutunSay = new Array(n).fill(0);
        for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
          if (tablo[`${a}-${b}`] === 'y') { satirSay[a]++; sutunSay[b]++; }
        }
        t.querySelectorAll('.hucre[data-d="y"]').forEach((dg) => {
          const [a, b] = dg.dataset.c.split('-').map(Number);
          if (satirSay[a] > 1 || sutunSay[b] > 1) dg.classList.add('celiski');
        });
      });
    },

    /* Sunucunun "kesinleşti" dediği satırları vurgula (yalnız 1. kategori satırları) */
    kesinVurgu(kesinlesen) {
      if (!this.kap) return;
      this.kap.querySelectorAll('tr.kesin').forEach((tr) => tr.classList.remove('kesin'));
      this.kap.querySelectorAll('.satir-basi .kesin-rozet').forEach((e) => e.remove());
      if (!kesinlesen || !kesinlesen.length) return;
      this.kap.querySelectorAll('table.izgara').forEach((t) => {
        if (!t.dataset.p.startsWith('0-')) return;
        kesinlesen.forEach((a) => {
          const tr = t.querySelector(`tr[data-satir="${a}"]`);
          if (!tr) return;
          tr.classList.add('kesin');
          const th = tr.querySelector('.satir-basi');
          if (th && !th.querySelector('.kesin-rozet')) {
            const r = document.createElement('span');
            r.className = 'kesin-rozet';
            r.textContent = '✔';
            r.title = 'Bu satır kesinleşti';
            th.appendChild(r);
          }
        });
      });
    }
  };

  function kacir(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  global.Izgara = Izgara;
})(window);
