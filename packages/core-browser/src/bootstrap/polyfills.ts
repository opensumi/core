import ResizeObserver from 'resize-observer-polyfill';

// 添加resize observer polyfill
if (typeof (window as any).ResizeObserver === 'undefined') {
  (window as any).ResizeObserver = ResizeObserver;
}
