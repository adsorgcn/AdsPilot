// Service Worker for Google-Monetize PWA
const CACHE_NAME = 'gm-v1.0.0';
const STATIC_CACHE = 'gm-static-v1.0.0';
const IMAGE_CACHE = 'gm-images-v1.0.0';
const API_CACHE = 'gm-api-v1.0.0';

// 需要缓存的静态资源
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/app/offers',
  '/app/tasks',
  '/settings',
  '/manifest.json',
  '/_next/static/css/app/layout.css',
  '/_next/static/css/app/dashboard/page.css',
  '/fonts/inter-var.woff2',
];

// 需要缓存的API端点
const API_ENDPOINTS = [
  '/api/user',
  '/api/offers',
  '/api/tasks',
  '/api/analytics',
];

// 图片缓存策略
const IMAGE_STRATEGIES = {
  // 缓存策略配置
  cacheFirst: {
    cacheName: IMAGE_CACHE,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
    maxEntries: 100,
  },
  staleWhileRevalidate: {
    cacheName: IMAGE_CACHE,
    maxAge: 24 * 60 * 60 * 1000, // 1天
    maxEntries: 200,
  },
};

// 安装事件 - 预缓存关键资源
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    Promise.all([
      // 预缓存静态资源
      caches.open(STATIC_CACHE).then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      }),

      // 预缓存应用外壳
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Caching app shell');
        return cache.addAll([
          '/',
          '/manifest.json',
          '/icons/icon-192x192.png',
          '/icons/icon-512x512.png',
        ]);
      }),
    ]).then(() => {
      console.log('[SW] Installation complete');
      self.skipWaiting();
    })
  );
});

// 激活事件 - 清理旧缓存
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // 删除旧版本缓存
          if (!cacheName.includes('v1.0.0')) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      self.clients.claim();
    })
  );
});

// 网络请求拦截
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非HTTP请求
  if (!request.url.startsWith('http')) {
    return;
  }

  // 处理API请求
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // 处理图片请求
  if (url.pathname.match(/\.(png|jpg|jpeg|gif|webp|avif|svg)$/i)) {
    event.respondWith(handleImageRequest(request));
    return;
  }

  // 处理静态资源
  if (STATIC_ASSETS.some(asset => url.pathname === asset) ||
      url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/fonts/')) {
    event.respondWith(handleStaticRequest(request));
    return;
  }

  // 处理导航请求（App Shell）
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }
});

// 处理API请求 - Stale While Revalidate策略
async function handleApiRequest(request) {
  const cache = await caches.open(API_CACHE);
  const cachedResponse = await cache.match(request);

  // 网络请求
  const fetchPromise = fetch(request)
    .then((response) => {
      // 只缓存成功的GET请求
      if (request.method === 'GET' && response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch((error) => {
      console.error('[SW] API request failed:', error);

      // 网络失败时，尝试返回缓存（即使过期）
      if (cachedResponse) {
        return cachedResponse;
      }

      // 返回离线页面
      return new Response(JSON.stringify({
        error: 'Offline',
        message: 'No network connection and cached data unavailable'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      });
    });

  // 如果有缓存，立即返回，同时在后台更新
  if (cachedResponse) {
    fetchPromise; // 触发后台更新
    return cachedResponse;
  }

  return fetchPromise;
}

// 处理图片请求 - Cache First策略
async function handleImageRequest(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    // 检查缓存是否过期
    const cachedDate = cachedResponse.headers.get('sw-cached-at');
    if (cachedDate) {
      const cacheAge = Date.now() - parseInt(cachedDate);
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7天

      if (cacheAge < maxAge) {
        return cachedResponse;
      }
    }
  }

  try {
    const response = await fetch(request);

    if (response.ok) {
      // 添加缓存时间戳
      const responseToCache = response.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cached-at', Date.now().toString());

      const modifiedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers,
      });

      cache.put(request, modifiedResponse);
    }

    return response;
  } catch (error) {
    console.error('[SW] Image request failed:', error);

    // 网络失败时返回缓存（即使过期）
    if (cachedResponse) {
      return cachedResponse;
    }

    // 返回默认图片占位符
    return new Response(
      '<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#f3f4f6"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#9ca3af">Image unavailable</text></svg>',
      {
        status: 200,
        headers: { 'Content-Type': 'image/svg+xml' }
      }
    );
  }
}

// 处理静态资源请求 - Cache First策略
async function handleStaticRequest(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const response = await fetch(request);

    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.error('[SW] Static request failed:', error);

    // 尝试从应用缓存中获取
    const appCache = await caches.open(CACHE_NAME);
    const appCached = await appCache.match(request);

    if (appCached) {
      return appCached;
    }

    throw error;
  }
}

// 处理导航请求 - Network First策略
async function handleNavigationRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  try {
    const response = await fetch(request);

    if (response.ok) {
      cache.put(request, response.clone());
    }

    return response;
  } catch (error) {
    console.error('[SW] Navigation request failed:', error);

    // 返回缓存的页面或离线页面
    if (cachedResponse) {
      return cachedResponse;
    }

    // 返回离线页面
    const offlineResponse = await cache.match('/offline.html');
    if (offlineResponse) {
      return offlineResponse;
    }

    // 生成基本的离线页面
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Offline - Google-Monetize</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 2rem; background: #f9fafb; }
            .container { max-width: 400px; margin: 0 auto; text-align: center; }
            .icon { font-size: 4rem; margin-bottom: 1rem; }
            h1 { color: #111827; margin-bottom: 1rem; }
            p { color: #6b7280; margin-bottom: 2rem; }
            button { background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="icon">📱</div>
            <h1>You're offline</h1>
            <p>Please check your internet connection and try again.</p>
            <button onclick="window.location.reload()">Retry</button>
          </div>
        </body>
      </html>
    `, {
      status: 503,
      headers: { 'Content-Type': 'text/html' }
    });
  }
}

// 后台同步
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);

  if (event.tag === 'background-sync') {
    event.waitUntil(doBackgroundSync());
  }
});

// 执行后台同步
async function doBackgroundSync() {
  try {
    // 获取待同步的数据
    const cache = await caches.open(API_CACHE);
    const pendingRequests = await cache.keys();

    for (const request of pendingRequests) {
      if (request.url.includes('/sync/')) {
        try {
          await fetch(request);
          await cache.delete(request);
          console.log('[SW] Background sync completed for:', request.url);
        } catch (error) {
          console.error('[SW] Background sync failed for:', request.url, error);
        }
      }
    }
  } catch (error) {
    console.error('[SW] Background sync error:', error);
  }
}

// 推送通��
self.addEventListener('push', (event) => {
  console.log('[SW] Push message received:', event);

  const options = {
    body: event.data ? event.data.text() : 'New notification from Google-Monetize',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'View',
        icon: '/images/checkmark.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/images/xmark.png'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Google-Monetize', options)
  );
});

// 通知点击处理
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification click received:', event);

  event.notification.close();

  if (event.action === 'explore') {
    // 打开应用到相关页面
    event.waitUntil(
      clients.openWindow('/dashboard')
    );
  } else if (event.action === 'close') {
    // 关闭通知
    return;
  } else {
    // 默认行为：打开应用
    event.waitUntil(
      clients.matchAll().then((clientList) => {
        for (const client of clientList) {
          if (client.url && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// 消息处理
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CACHE_UPDATE') {
    // 更新特定缓存
    event.waitUntil(updateCache(event.data.payload));
  }
});

// 更新缓存
async function updateCache(payload) {
  const { url, cacheName } = payload;

  try {
    const cache = await caches.open(cacheName || CACHE_NAME);
    const response = await fetch(url);

    if (response.ok) {
      await cache.put(url, response);
      console.log('[SW] Cache updated for:', url);
    }
  } catch (error) {
    console.error('[SW] Cache update failed for:', url, error);
  }
}

// 缓存清理
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CLEAN_CACHE') {
    event.waitUntil(cleanCache());
  }
});

async function cleanCache() {
  try {
    const cacheNames = await caches.keys();
    const oldCaches = cacheNames.filter(name => !name.includes('v1.0.0'));

    await Promise.all(
      oldCaches.map(name => {
        console.log('[SW] Deleting old cache:', name);
        return caches.delete(name);
      })
    );

    console.log('[SW] Cache cleanup completed');
  } catch (error) {
    console.error('[SW] Cache cleanup failed:', error);
  }
}