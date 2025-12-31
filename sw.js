// Import FCM SDK for background notifications
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getMessaging, onBackgroundMessage } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-sw.js";

// Your web app's Firebase configuration (must be present in SW)
const firebaseConfig = {
  apiKey: "AIzaSyDwhB3e0cQiIYIcjQRqN2hCFviv5iVPNO4", // Restored key to fix login.
  authDomain: "appvsvistorias1.firebaseapp.com",
  projectId: "appvsvistorias1",
  storageBucket: "appvsvistorias1.firebasestorage.app",
  messagingSenderId: "987443685390",
  appId: "1:987443685390:web:2a222636b79429ef42f45f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// Handle background messages with FCM
onBackgroundMessage(messaging, (payload) => {
  console.log('[sw.js] Received background message ', payload);

  const notificationTitle = payload.data?.title || 'GestorPRO';
  const notificationOptions = {
    body: payload.data?.body || 'Você tem uma nova notificação.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200, 100, 200], // Vibration pattern
    data: {
        url: payload.data?.url || '/' // URL to open on click
    }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});


// --- PWA Caching Logic ---
const CACHE_NAME = 'vistorias-pro-cache-v2'; // Bump version to ensure SW update
// Add icons and manifest to the cache list. These form the basic "app shell".
const urlsToCache = [
  '/',
  '/index.html',
  '/index.css',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png'
];

// On install, pre-cache the app shell.
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching App Shell');
        return cache.addAll(urlsToCache);
      })
  );
});

// On activation, clean up old caches.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName.startsWith('vistorias-pro-cache-') && cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      );
    }).then(() => self.clients.claim()) // Take control of open pages immediately
  );
});

// On fetch, apply a robust caching strategy.
self.addEventListener('fetch', event => {
  const { request } = event;

  // Let Firebase/Firestore handle their own networking.
  if (request.url.includes('firestore.googleapis.com') || request.url.includes('firebaseinstallations.googleapis.com')) {
    return;
  }

  // For navigation requests (e.g., loading the page), use network-first.
  // This ensures the user gets the latest HTML, but it still works offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For all other requests (assets like JS, CSS, images), use cache-first.
  // This makes the app load instantly from the cache.
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      // If the response is in the cache, return it.
      if (cachedResponse) {
        return cachedResponse;
      }
      
      // If not in the cache, fetch from the network.
      return fetch(request).then(networkResponse => {
        // If the fetch is successful, cache the new response for next time.
        if (networkResponse && networkResponse.status === 200 && request.method === 'GET') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      });
    })
  );
});


// --- Push Notification Click Handler ---
self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Notification click Received.', event.notification);
    event.notification.close();

    event.waitUntil(
        clients.matchAll({
            type: "window",
            includeUncontrolled: true
        }).then(clientList => {
            const urlToOpen = new URL(event.notification.data.url || '/', self.location.origin).href;

            // Check if a window is already open with the target URL
            for (const client of clientList) {
                if (new URL(client.url).pathname === new URL(urlToOpen).pathname && 'focus' in client) {
                    return client.focus();
                }
            }

            // If not, open a new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});