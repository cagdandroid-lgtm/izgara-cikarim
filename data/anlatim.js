'use strict';
/* Anlatımlı çözüm üreteci.
   İpucu türleri: eq, neq, cond, left (hemen ardından), next (yan yana),
   once (önce gelir), ara (aralarında tam k-1 sıra).
   Bulmacayı bir öğrencinin yapacağı gibi adım adım çözer ve her adımı Türkçe cümleye çevirir:
     1) ipuçlarını uygula        2) satır/sütunda tek seçenek kaldıysa işaretle
     3) köprü kategori üzerinden çıkarım   4) tıkanırsa "varsayalım → çelişki" denemesi
   data/uretec.js tarafından çağrılır, data/cozumler.md dosyasını besler. */

class Cozucu {
  constructor(cats, clues, sol) {
    this.cats = cats;
    this.clues = clues;
    this.sol = sol;
    this.n = cats[0].ogeler.length;
    this.K = cats.length;
    this.adimlar = [];
    this.sessiz = false;
    this.celiski = false;
    // mum['i-j'][a][b] = (i kategorisinin a öğesi) ile (j kategorisinin b öğesi) hâlâ eşleşebilir mi
    this.mum = {};
    for (let i = 0; i < this.K; i++) for (let j = i + 1; j < this.K; j++) {
      this.mum[`${i}-${j}`] = Array.from({ length: this.n }, () => new Array(this.n).fill(true));
    }
  }

  /* ---------- durum erişimi ---------- */
  norm(i, j, a, b) { return i < j ? [i, j, a, b] : [j, i, b, a]; }
  m(i, j) { return this.mum[`${i}-${j}`]; }
  olabilir(i, j, a, b) { const [x, y, p, q] = this.norm(i, j, a, b); return this.m(x, y)[p][q]; }
  secenekler(i, j, a) {
    const out = [];
    for (let b = 0; b < this.n; b++) if (this.olabilir(i, j, a, b)) out.push(b);
    return out;
  }
  atanmis(i, j, a) { const s = this.secenekler(i, j, a); return s.length === 1 ? s[0] : null; }

  ad(k, v) { return this.cats[k].ogeler[v]; }
  not(metin) { if (!this.sessiz) this.adimlar.push(metin); }

  ele(i, j, a, b) {
    const [x, y, p, q] = this.norm(i, j, a, b);
    if (!this.m(x, y)[p][q]) return false;
    this.m(x, y)[p][q] = false;
    return true;
  }

  /* Bir eşleşmeyi kesinleştir: satır ve sütundaki diğer seçenekler elenir */
  ata(i, j, a, b) {
    let degisti = this.olabilir(i, j, a, b) === false ? false : false;
    if (!this.olabilir(i, j, a, b)) { this.celiski = true; return false; }
    for (let v = 0; v < this.n; v++) {
      if (v !== b && this.ele(i, j, a, v)) degisti = true;
      if (v !== a && this.ele(i, j, v, b)) degisti = true;
    }
    return degisti;
  }

  celiskiVarMi() {
    if (this.celiski) return true;
    for (let i = 0; i < this.K; i++) for (let j = i + 1; j < this.K; j++) {
      for (let a = 0; a < this.n; a++) {
        if (!this.secenekler(i, j, a).length) return true;
        let sutun = 0;
        for (let x = 0; x < this.n; x++) if (this.olabilir(i, j, x, a)) sutun++;
        if (!sutun) return true;
      }
    }
    return false;
  }

  cozulduMu() {
    for (let i = 0; i < this.K; i++) for (let j = i + 1; j < this.K; j++) {
      for (let a = 0; a < this.n; a++) if (this.secenekler(i, j, a).length !== 1) return false;
    }
    return true;
  }

  kopya() {
    const c = new Cozucu(this.cats, this.clues, this.sol);
    for (const k of Object.keys(this.mum)) c.mum[k] = this.mum[k].map((r) => r.slice());
    c.sessiz = true;
    return c;
  }

  /* ---------- ipuçları ---------- */
  ipucuUygula(no, c) {
    const N = `İpucu ${no}`;
    switch (c.kind) {
      case 'eq': {
        if (this.atanmis(c.ka, c.kb, c.va) === c.vb) return false;
        if (!this.olabilir(c.ka, c.kb, c.va, c.vb)) { this.celiski = true; return false; }
        this.ata(c.ka, c.kb, c.va, c.vb);
        this.not(`**${N}** → **${this.ad(c.ka, c.va)} = ${this.ad(c.kb, c.vb)}** ✔ (satırındaki ve sütunundaki diğer hücreler ✖ olur)`);
        return true;
      }
      case 'neq': {
        if (!this.olabilir(c.ka, c.kb, c.va, c.vb)) return false;
        this.ele(c.ka, c.kb, c.va, c.vb);
        this.not(`**${N}** → **${this.ad(c.ka, c.va)} ≠ ${this.ad(c.kb, c.vb)}** ✖`);
        return true;
      }
      case 'cond': {
        // "kb = vb" YA DA "kc = vc" doğrudur; biri elendiyse öteki kesinleşir
        const birOlmaz = !this.olabilir(c.ka, c.kb, c.va, c.vb);
        const ikiOlmaz = !this.olabilir(c.ka, c.kc, c.va, c.vc);
        if (birOlmaz && ikiOlmaz) { this.celiski = true; return false; }
        // İpucu şu iki seçenekten en az birinin doğru olduğunu söyler:
        //   (ka = kb değeri)  YA DA  (ka = kc değeri)
        if (birOlmaz && this.atanmis(c.ka, c.kc, c.va) !== c.vc) {
          this.ata(c.ka, c.kc, c.va, c.vc);
          this.not(`**${N}** (koşullu) → **${this.ad(c.ka, c.va)} ≠ ${this.ad(c.kb, c.vb)}** olduğundan koşul devreye girer: **${this.ad(c.ka, c.va)} = ${this.ad(c.kc, c.vc)}** ✔`);
          return true;
        }
        if (ikiOlmaz && this.atanmis(c.ka, c.kb, c.va) !== c.vb) {
          this.ata(c.ka, c.kb, c.va, c.vb);
          this.not(`**${N}** (koşullu) → **${this.ad(c.ka, c.va)} = ${this.ad(c.kc, c.vc)}** artık mümkün değil; ipucunun geriye kalan tek seçeneği: **${this.ad(c.ka, c.va)} = ${this.ad(c.kb, c.vb)}** ✔`);
          return true;
        }
        return false;
      }
      case 'left': return this.konumUygula(no, c, 'left');
      case 'next': return this.konumUygula(no, c, 'next');
      case 'once': return this.konumUygula(no, c, 'once');
      case 'ara': return this.konumUygula(no, c, 'ara');
      default: return false;
    }
  }

  /* Konum ipuçları: 0 numaralı kategori "Sıra"dır, satır indeksi = konum */
  konumUygula(no, c, tur) {
    const N = `İpucu ${no}`;
    const Sb = [], Sc = [];
    for (let p = 0; p < this.n; p++) {
      if (this.olabilir(0, c.kb, p, c.vb)) Sb.push(p);
      if (this.olabilir(0, c.kc, p, c.vc)) Sc.push(p);
    }
    const uyar = tur === 'left' ? (p, q) => q === p + 1
      : tur === 'next' ? (p, q) => Math.abs(q - p) === 1
      : tur === 'once' ? (p, q) => q > p                       // kb, kc'den önce gelir
      : (p, q) => Math.abs(q - p) === c.k;                     // aralarında tam c.k-1 sıra

    let degisti = false;
    const atilanB = [], atilanC = [];
    for (const p of Sb) if (!Sc.some((q) => uyar(p, q))) { this.ele(0, c.kb, p, c.vb); atilanB.push(p); degisti = true; }
    for (const q of Sc) if (!Sb.some((p) => uyar(p, q))) { this.ele(0, c.kc, q, c.vc); atilanC.push(q); degisti = true; }
    if (!degisti) return false;

    const iliski = tur === 'left' ? 'hemen ardından'
      : tur === 'next' ? 'yan yana'
      : tur === 'once' ? 'önce/sonra'
      : `aralarında ${c.k - 1} sıra`;
    const parcalar = [];
    if (atilanB.length) parcalar.push(`**${this.ad(c.kb, c.vb)}** şu sıralarda olamaz: ${atilanB.map((p) => this.ad(0, p)).join(', ')}`);
    if (atilanC.length) parcalar.push(`**${this.ad(c.kc, c.vc)}** şu sıralarda olamaz: ${atilanC.map((p) => this.ad(0, p)).join(', ')}`);
    this.not(`**${N}** (${iliski}) → ${parcalar.join('; ')} ✖`);
    return true;
  }

  /* ---------- genel çıkarım kuralları ---------- */
  tekSecenek() {
    for (let i = 0; i < this.K; i++) for (let j = i + 1; j < this.K; j++) {
      for (let a = 0; a < this.n; a++) {
        const s = this.secenekler(i, j, a);
        if (s.length === 1) {
          // satırda tek seçenek: sütunu da temizlenmeli mi?
          let sutunFazla = false;
          for (let x = 0; x < this.n; x++) if (x !== a && this.olabilir(i, j, x, s[0])) sutunFazla = true;
          if (sutunFazla) {
            this.ata(i, j, a, s[0]);
            this.not(`**${this.ad(i, a)}** için geriye tek seçenek kaldı: **${this.ad(j, s[0])}** ✔`);
            return true;
          }
        }
      }
      for (let b = 0; b < this.n; b++) {
        const satirlar = [];
        for (let a = 0; a < this.n; a++) if (this.olabilir(i, j, a, b)) satirlar.push(a);
        if (satirlar.length === 1 && this.secenekler(i, j, satirlar[0]).length > 1) {
          this.ata(i, j, satirlar[0], b);
          this.not(`**${this.ad(j, b)}** yalnızca **${this.ad(i, satirlar[0])}** ile eşleşebilir ✔`);
          return true;
        }
      }
    }
    return false;
  }

  /* Köprü kategori: A=B ve B≠C ise A≠C (ya da hiçbir köprü kalmadıysa eleme) */
  koprü() {
    for (let i = 0; i < this.K; i++) for (let k = 0; k < this.K; k++) {
      if (i === k) continue;
      for (let j = 0; j < this.K; j++) {
        if (j === i || j === k) continue;
        for (let a = 0; a < this.n; a++) for (let c = 0; c < this.n; c++) {
          if (!this.olabilir(i, k, a, c)) continue;
          const kopruler = [];
          for (let b = 0; b < this.n; b++) if (this.olabilir(i, j, a, b) && this.olabilir(j, k, b, c)) kopruler.push(b);
          if (kopruler.length) continue;
          this.ele(i, k, a, c);
          const sabit = this.atanmis(i, j, a);
          if (sabit !== null) {
            this.not(`**${this.ad(i, a)} = ${this.ad(j, sabit)}** ve **${this.ad(j, sabit)} ≠ ${this.ad(k, c)}** olduğundan **${this.ad(i, a)} ≠ ${this.ad(k, c)}** ✖`);
          } else {
            this.not(`**${this.ad(i, a)}**, hiçbir **${this.cats[j].ad}** seçeneği üzerinden **${this.ad(k, c)}** ile bağlanamıyor → **${this.ad(i, a)} ≠ ${this.ad(k, c)}** ✖`);
          }
          return true;
        }
      }
    }
    return false;
  }

  /* ---------- ana döngü ---------- */
  tur() {
    for (let idx = 0; idx < this.clues.length; idx++) {
      if (this.ipucuUygula(idx + 1, this.clues[idx])) return true;
      if (this.celiski) return false;
    }
    if (this.tekSecenek()) return true;
    if (this.koprü()) return true;
    return false;
  }

  yay() { let d = true; while (d && !this.celiski) d = this.tur(); }

  /* Tıkanınca: bir olasılığı varsay, çelişkiye götürüyorsa ele */
  varsayimDene() {
    for (let k = 1; k < this.K; k++) {
      for (let a = 0; a < this.n; a++) {
        const s = this.secenekler(0, k, a);
        if (s.length < 2) continue;
        for (const b of s) {
          const deneme = this.kopya();
          deneme.ata(0, k, a, b);
          deneme.yay();
          if (deneme.celiski || deneme.celiskiVarMi()) {
            this.ele(0, k, a, b);
            this.not(`_Deneyelim:_ **${this.ad(0, a)} = ${this.ad(k, b)}** olsaydı ipuçları çelişirdi → **${this.ad(0, a)} ≠ ${this.ad(k, b)}** ✖`);
            return true;
          }
        }
      }
    }
    return false;
  }

  coz() {
    this.yay();
    let guvenlik = 0;
    while (!this.cozulduMu() && !this.celiski && guvenlik++ < 60) {
      if (!this.varsayimDene()) break;
      this.yay();
    }
    return { adimlar: this.adimlar, cozuldu: this.cozulduMu() && !this.celiski };
  }

  /* Çözüm doğru mu (üretilen anlatım gerçek çözüme mi ulaştı) */
  dogrulandiMi() {
    for (let k = 1; k < this.K; k++) for (let e = 0; e < this.n; e++) {
      if (this.atanmis(0, k, this.sol[0][e]) !== this.sol[k][e]) return false;
    }
    return true;
  }
}

module.exports = { Cozucu };
