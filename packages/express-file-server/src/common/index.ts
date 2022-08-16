export const EXPRESS_SERVER_PORT = 8000;
export const EXPRESS_SERVER_PATH = process.env.STATIC_SERVER_PATH || `http://127.0.0.1:${EXPRESS_SERVER_PORT}/`;
// 静态服务资源白名单
export const ALLOW_MIME = {
  gif: 'image/gif',
  jpg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ttf: 'font/ttf',
  eot: 'font/eot',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  js: 'application/javascript',
  css: 'text/css',
  mp4: 'video/mp4',
  ogg: 'video/ogg',
  webm: 'video/webm',
};
