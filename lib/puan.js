'use strict';
/* Puanlama ve zamanlama sabitleri (durum.js ve takimlar.js ortak kullanır) */

const PUAN = {
  taban: 60,            // doğru çözen herkes
  podyum: [40, 25, 15], // ilk üç (ikili modda ilk üç TAKIM)
  ceza: 5,              // her hatalı "Kontrol Et"
  taban_min: 20,        // cezalar sonrası alt sınır
  birlikte: 30          // "Birlikte" modunda sınıfa dağıtılan puan
};

const KONTROL_BEKLEME_MS = 4000;
const YASAK_MS = 2 * 60 * 1000;

module.exports = { PUAN, KONTROL_BEKLEME_MS, YASAK_MS };
