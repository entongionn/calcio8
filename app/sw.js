// Service worker: rende l'app disponibile offline.
// - File dell'app: risposta immediata dalla cache e aggiornamento in background; a ogni rilascio
//   si cambia VERSIONE, così la cache vecchia viene eliminata.
// - dati.json: prima la rete (i dati devono essere aggiornati), la cache solo se si è offline.
// pdf.js (vendor/) non è nell'elenco perché serve solo a chi importa i comunicati: entra in cache
// al primo utilizzo.

const VERSIONE = 'aics-v5';

const FILE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './img/campo.jpg',
  './icons/icon.svg',
  './icons/logo.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './js/app.js',
  './js/archivio.js',
  './js/backup.js',
  './js/calendario.js',
  './js/classifica.js',
  './js/db.js',
  './js/facebook.js',
  './js/marcatori.js',
  './js/normalizza.js',
  './js/pdf.js',
  './js/pubblica.js',
  './js/seed.js',
  './js/stato.js',
  './js/stemmi.js',
  './js/util.js',
  './js/viste/altro.js',
  './js/viste/calendario.js',
  './js/viste/classifiche.js',
  './js/viste/comuni.js',
  './js/viste/facebook.js',
  './js/viste/gestione.js',
  './js/viste/home.js',
  './js/viste/marcatori.js',
  './js/viste/novita.js',
  './js/viste/partite.js',
  './js/viste/squadre.js',
  './js/viste/squadre-pubbliche.js',
];

self.addEventListener('install', evento => {
  evento.waitUntil(caches.open(VERSIONE).then(c => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', evento => {
  evento.waitUntil(
    caches.keys()
      .then(chiavi => Promise.all(chiavi.filter(k => k !== VERSIONE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', evento => {
  const { request } = evento;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (url.pathname.endsWith('/dati.json')) {
    evento.respondWith(caches.open(VERSIONE).then(cache =>
      fetch(request)
        .then(risposta => {
          if (risposta.ok) cache.put('./dati.json', risposta.clone());
          return risposta;
        })
        .catch(async () => (await cache.match('./dati.json')) ?? Response.error())));
    return;
  }

  evento.respondWith(caches.open(VERSIONE).then(async cache => {
    const inCache = await cache.match(request, { ignoreSearch: true })
      ?? (request.mode === 'navigate' ? await cache.match('./index.html') : undefined);
    const dallaRete = fetch(request)
      .then(risposta => {
        if (risposta.ok) cache.put(request, risposta.clone());
        return risposta;
      })
      .catch(() => inCache ?? Response.error());
    if (inCache) {
      evento.waitUntil(dallaRete);
      return inCache;
    }
    return dallaRete;
  }));
});
