'use strict';
/* Zamanlama sabitleri.
   PUANLAMA ARTIK CEVAPTAN GELİR ve lib/akis.js'tedir:
     doğru cevap = 500 taban + hedef süreye göre azalan hız bonusu (en çok 500)
                 + ilk denemede doğruysa 100 bonus.
   Izgara (tablo) yalnız bir araçtır; tabloya puan verilmez. */

const YASAK_MS = 2 * 60 * 1000;   // oyundan çıkarılan öğrencinin bekleme süresi

module.exports = { YASAK_MS };
