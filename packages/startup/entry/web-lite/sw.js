const cacheAssetUrlPrefixList = [
  'https://cdn.jsdelivr.net/gh/microsoft/vscode/extensions/',
  'https://g.alicdn.com/tb-ide/monaco-editor-core/0.17.0/',
];

self.addEventListener('fetch', (event) => {
  if (cacheAssetUrlPrefixList.some((prefix) => event.request.url.startsWith(prefix))) {
    event.respondWith(
      caches.open('kt-ext').then((cache) => {
        return cache.match(event.request).then((res) => {
          return res || fetch(event.request).then((response) => {
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    );
  }
});
