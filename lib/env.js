'use strict';
/* Bağımlılıksız .env yükleyici. Yerelde .env dosyasındaki KEY=değer satırlarını
   process.env'e aktarır; Render gibi ortamlarda dosya yoksa sessizce geçer. */
const fs = require('fs');
const path = require('path');

module.exports = function yukle(kok) {
  const dosya = path.join(kok || process.cwd(), '.env');
  if (!fs.existsSync(dosya)) return;
  const satirlar = fs.readFileSync(dosya, 'utf8').split(/\r?\n/);
  for (const satir of satirlar) {
    const s = satir.trim();
    if (!s || s.startsWith('#')) continue;
    const i = s.indexOf('=');
    if (i < 0) continue;
    const ad = s.slice(0, i).trim();
    let deger = s.slice(i + 1).trim();
    if ((deger.startsWith('"') && deger.endsWith('"')) || (deger.startsWith("'") && deger.endsWith("'"))) {
      deger = deger.slice(1, -1);
    }
    if (!(ad in process.env)) process.env[ad] = deger;
  }
};
