// Service worker: rende l'app disponibile offline.
// Strategia: risposta immediata dalla cache e aggiornamento in background; a ogni rilascio
// si cambia VERSIONE, così la cache vecchia viene eliminata. pdf.js (vendor/) non è nell'elenco
// perché serve solo a chi importa i comunicati: entra in cache al primo utilizzo.

const VERSIONE = 'aics-v3';

const FILE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
  './js/app.js',
  './js/archivio.js',
  './js/backup.js',
  './js/calendario.js',
  './js/classifica.js',
  './js/db.js',
  './js/normalizza.js',
  './js/pdf.js',
  './js/seed.js',
  './js/stato.js',
  './js/util.js',
  './js/viste/calendario.js',
  './js/viste/classifiche.js',
  './js/viste/comuni.js',
  './js/viste/gestione.js',
  './js/viste/partite.js',
  './js/viste/squadre.js',
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
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

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
