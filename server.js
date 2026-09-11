'use strict';
/* Izgara Çıkarım — UYCEP Logic sınıf oyunu sunucusu */
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');

require('./lib/env')(__dirname);
const oyunuKur = require('./lib/oyun');

const PORT = process.env.PORT || 3000;
const RENDERDA = !!process.env.RENDER;
const YEREL_VARSAYILAN = 'uycep-local';   // UYCEP Logic ortak standardı (CLAUDE.md)

/* ADMIN_PASSWORD yoksa davranış ortama göre ayrılır:
   yerelde varsayılan şifreyle çalışır, Render'da panel kapalı kalır. */
const SIFRE = process.env.ADMIN_PASSWORD || (RENDERDA ? null : YEREL_VARSAYILAN);

if (!SIFRE) {
  console.warn('\n' + '='.repeat(64));
  console.warn('⚠️  ADMIN_PASSWORD TANIMLI DEĞİL — ÖĞRETMEN PANELİ KAPALI');
  console.warn('   Render panelinde Environment sekmesinden ADMIN_PASSWORD ekleyin;');
  console.warn('   /teacher girişi şifre tanımlanana kadar kapalı kalacak.');
  console.warn('='.repeat(64) + '\n');
} else {
  if (!process.env.ADMIN_PASSWORD) {
    console.log('ℹ️  ADMIN_PASSWORD tanımlı değil; yerel varsayılan şifre kullanılıyor.');
    console.log('   Kendi şifrenizi belirlemek için .env dosyasına ADMIN_PASSWORD=... yazın.');
  }
  console.log(`🔑 Öğretmen paneli şifresi: ${SIFRE}`);
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingTimeout: 20000, pingInterval: 10000 });

app.use(express.urlencoded({ extended: false }));

/* ---------- çerez ---------- */
function cerezler(req) {
  const ham = req.headers.cookie || '';
  const out = {};
  for (const parca of ham.split(';')) {
    const i = parca.indexOf('=');
    if (i < 0) continue;
    out[parca.slice(0, i).trim()] = decodeURIComponent(parca.slice(i + 1).trim());
  }
  return out;
}
const yetkili = (req) => cerezler(req).admin_auth === 'true';

/* ---------- öğretmen dosyalarına doğrudan erişim engellenir ---------- */
app.use((req, res, next) => {
  // rapor/liste/bildirim/takim.js de panel dosyalarıdır; öğrenci tarafında hiç yüklenmez
  if (/^\/(teacher\.(html|js)|(rapor|liste|bildirim|takim)\.js)$/.test(req.path) && !yetkili(req)) return res.redirect('/teacher');
  next();
});

/* ---------- öğretmen girişi ---------- */
const girisSayfasi = (hata) => `<!doctype html><html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Öğretmen Girişi · Izgara Çıkarım</title><link rel="stylesheet" href="/style.css"></head>
<body class="giris-sayfa"><main class="kart giris-kart">
<h1>🔐 Öğretmen Girişi</h1>
${hata ? `<p class="uyari" role="alert">⚠️ ${hata}</p>` : ''}
<form method="post" action="/teacher/giris">
<label for="sifre">Şifre</label>
<input id="sifre" name="sifre" type="password" autocomplete="current-password" required autofocus>
<button type="submit" class="btn btn-ana">Giriş Yap</button>
</form>
<p class="ipucu">Öğrenci misin? <a href="/">Oyuna katıl →</a></p>
</main></body></html>`;

app.get('/teacher', (req, res) => {
  if (!SIFRE) return res.status(503).send(girisSayfasi('Öğretmen girişi, sunucuda ADMIN_PASSWORD tanımlanana kadar kapalıdır.'));
  if (yetkili(req)) return res.sendFile(path.join(__dirname, 'public', 'teacher.html'));
  res.send(girisSayfasi(req.query.hata ? 'Şifre yanlış.' : ''));
});

app.post('/teacher/giris', (req, res) => {
  if (!SIFRE) return res.status(503).send(girisSayfasi('Öğretmen girişi, sunucuda ADMIN_PASSWORD tanımlanana kadar kapalıdır.'));
  if ((req.body.sifre || '') === SIFRE) {
    res.setHeader('Set-Cookie', 'admin_auth=true; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200');
    return res.redirect('/teacher');
  }
  console.warn('⚠️ hatalı öğretmen şifresi denemesi');
  res.redirect('/teacher?hata=1');
});

app.post('/teacher/cikis', (req, res) => {
  res.setHeader('Set-Cookie', 'admin_auth=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.redirect('/teacher');
});

app.use(express.static(path.join(__dirname, 'public')));

/* ---------- socket tarafında öğretmen doğrulaması ---------- */
function ogretmenMi(socket) {
  if (!SIFRE) return false;
  return cerezler({ headers: socket.handshake.headers }).admin_auth === 'true';
}

oyunuKur(io, ogretmenMi);

server.listen(PORT, () => {
  console.log(`🧩 Izgara Çıkarım çalışıyor → http://localhost:${PORT}`);
  console.log(`   Öğrenci: /   ·   Öğretmen: /teacher`);
});
