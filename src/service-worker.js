const CACHE_NAME = 'campusmate-v3';

const STATIC_ASSETS = [
  '/index.html',
  '/css/main.css',
  '/css/variables.css',
  '/css/auth.css',
  '/css/layout.css',
  '/css/dashboard.css',
  '/css/classes.css',
  '/css/calendar.css',
  '/css/shared.css',
  '/css/tasks.css',
  '/css/exams.css',
  '/css/quiz.css',
  '/css/profile.css',
  '/css/responsive.css',
  '/js/config.js',
  '/js/icons.js',
  '/js/utils.js',
  '/js/ui.js',
  '/js/navigation.js',
  '/js/auth.js',
  '/js/dashboard.js',
  '/js/calendar.js',
  '/js/tasks.js',
  '/js/exams.js',
  '/js/classes.js',
  '/js/quiz.js',
  '/js/profile.js',
  '/config/supabaseClient.js',
  '/manifest.json',
  '/image/Logo.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Never cache Supabase API calls — always network
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for static assets, network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        if (event.request.destination === 'document') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
