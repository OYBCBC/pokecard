import { init } from './ui.js';

init();

// PWA：离线缓存（localhost / https 下生效）
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
