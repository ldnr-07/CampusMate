const CACHE_NAME = 'campusmate-v4';

// All paths are relative to the Vercel-served root.
// The Vercel wildcard route maps /anything -> /src/anything,
// so browser requests for assets inside /src/ arrive at the
// origin as /src/css/…, /src/js/…, etc.
const STATIC_ASSETS = [
  '/',
  '/src/landing-page.html',
  '/src/login.html',
  '/src/signup.html',
  '/src/dashboard.html',
  '/src/calendar.html',
  '/src/tasks.html',
  '/src/classes.html',
  '/src/exams.html',
  '/src/quiz.html',
  '/src/profile.html',
  '/src/forgot-password.html',
  '/src/css/main.css',
  '/src/css/variables.css',
  '/src/css/auth.css',
  '/src/css/layout.css',
  '/src/css/dashboard.css',
  '/src/css/classes.css',
  '/src/css/calendar.css',
  '/src/css/shared.css',
  '/src/css/tasks.css',
  '/src/css/exams.css',
  '/src/css/quiz.css',
  '/src/css/profile.css',
  '/src/css/responsive.css',
  '/src/css/landing.css',
  '/src/css/polish.css',
  '/src/css/terms.css',
  '/src/js/config.js',
  '/src/js/icons.js',
  '/src/js/utils.js',
  '/src/js/ui.js',
  '/src/js/navigation.js',
  '/src/js/auth.js',
  '/src/js/dashboard.js',
  '/src/js/calendar.js',
  '/src/js/tasks.js',
  '/src/js/exams.js',
  '/src/js/classes.js',
  '/src/js/quiz.js',
  '/src/js/profile.js',
  '/src/config/supabaseClient.js',
  '/src/manifest.json',
  '/src/image/Logo.png',
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

  // Never cache Supabase API or auth calls — always go to network
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
        // Offline fallback: return cached root for navigation requests
        if (event.request.destination === 'document') {
          return caches.match('/');
        }
      });
    })
  );
});
