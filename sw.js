/* ==========================================================
   BLOOD REIGN — Service Worker
   Caches the app shell (HTML/CSS/JS/icons) so the app opens
   instantly and works offline. Live data (Supabase/Discord/ads)
   is never cached — those always go straight to the network.
   ========================================================== */

const CACHE_NAME = 'blood-reign-v1';

const CORE_ASSETS = [
  'index.html', 'privacy.html', 'terms.html', 'manifest.json',
  'css/tokens.css', 'css/base.css', 'css/components.css', 'css/layout.css',
  'css/screens.css', 'css/animations.css', 'css/responsive.css',
  'js/admin.js', 'js/auth.js', 'js/coins.js', 'js/config.js', 'js/data.js',
  'js/guestStore.js', 'js/home.js', 'js/leaderboard.js', 'js/main.js',
  'js/mockData.js', 'js/nav.js', 'js/profile.js', 'js/scrims.js', 'js/shop.js',
  'js/supabaseClient.js', 'js/teamStore.js', 'js/teams.js', 'js/tournaments.js',
  'js/tryouts.js', 'js/ui.js', 'js/utils.js',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/icon-512-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache/intercept API calls, Discord webhooks, Supabase, ads, or
  // any cross-origin request — those must always hit the live network.
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached); // offline fallback to cache
      return cached || network;
    })
  );
});
