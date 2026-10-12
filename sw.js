// Plant a Thought service worker: lets the game install and work offline.
// The game page and config.js are fetched fresh when online (so uploads to GitHub
// show up straight away) and fall back to the saved copy when offline.
// Bump VERSION only if you change this file's caching rules.
const VERSION = 'pat-v1';
const SHELL = ['./', 'index.html', 'config.js', 'manifest.webmanifest',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

function networkFirst(req) {
  return fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
    return res;
  }).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('index.html')));
}

function staleWhileRevalidate(req) {
  return caches.open(VERSION).then(c => c.match(req).then(hit => {
    const fresh = fetch(req).then(res => {
      if (res.ok || res.type === 'opaque') c.put(req, res.clone());
      return res;
    }).catch(() => hit);
    return hit || fresh;
  }));
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) {
    const isPage = req.mode === 'navigate' || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/config.js');
    e.respondWith(isPage ? networkFirst(req) : staleWhileRevalidate(req));
  } else if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith(staleWhileRevalidate(req));
  }
  // Everything else (Supabase online play) goes straight to the network.
});
