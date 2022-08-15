/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import { precacheAndRoute, PrecacheFallbackPlugin } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkOnly } from 'workbox-strategies';

//@ts-expect-error
precacheAndRoute(self.__WB_MANIFEST);

// Not sure why but it doesn't work
// Cache the Google Fonts stylesheets with a stale-while-revalidate strategy.
// registerRoute(
//   ({ url }) => url.origin === 'https://fonts.googleapis.com',
//   new StaleWhileRevalidate({
//     cacheName: 'google-fonts-stylesheets',
//   }),
// );

// Cache the underlying font files with a cache-first strategy for 1 year.
registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
      new ExpirationPlugin({
        maxAgeSeconds: 60 * 60 * 24 * 365,
        maxEntries: 30,
      }),
    ],
  }),
);

registerRoute(
  ({ request, url }) =>
    request.mode === 'navigate' && /harika\.io$/.test(url.host),
  new NetworkOnly({
    plugins: [
      new PrecacheFallbackPlugin({
        fallbackURL: '/index.html',
      }),
    ],
  }),
);

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    //@ts-expect-error
    self.skipWaiting();
  }
});
