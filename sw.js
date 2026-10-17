// スワップ4：オフライン用 Service Worker
// ゲームを更新したら VERSION の数字を上げる（古いキャッシュが入れ替わります）
const VERSION = 'v4';
const CACHE = `swap4-${VERSION}`;
const FONT_CACHE = 'swap4-fonts';

// 最初に保存しておくファイル
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './maruo-opening.js',
  './maruo-ranking.js',
  './config.js',
  './img/chara-idle.png',
  './img/chara-cheer.png',
  './img/chara-panic.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys
        .filter(k => k.startsWith('swap4-') && k !== CACHE && k !== FONT_CACHE)
        .map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Supabase（ランキング）など外部への通信は横取りしない。Google Fonts だけ保存する
  const isFont = url.hostname.endsWith('fonts.googleapis.com') || url.hostname.endsWith('fonts.gstatic.com');
  if (url.origin !== self.location.origin && !isFont) return;

  if (isFont) {
    // フォント：保存済みならそれを使い、なければ取得して保存
    event.respondWith(
      caches.open(FONT_CACHE).then(cache =>
        cache.match(req).then(hit => hit || fetch(req).then(res => {
          if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
          return res;
        }))
      )
    );
    return;
  }

  // ゲーム本体：保存済みのものをすぐ返し、裏で最新版を取得して保存（次回起動時に反映）
  event.respondWith(
    caches.open(CACHE).then(cache =>
      cache.match(req, { ignoreSearch: true }).then(hit => {
        const network = fetch(req).then(res => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => hit || (req.mode === 'navigate' ? cache.match('./index.html') : undefined));
        return hit || network;
      })
    )
  );
});
