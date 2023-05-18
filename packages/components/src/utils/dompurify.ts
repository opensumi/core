import DOMPurify from 'dompurify';

function importModule(requiredModule: any) {
  return (requiredModule && requiredModule.default) || requiredModule;
}

function initDOMPurifyWithJSDOM() {
  const DOMPurifyInitializer = importModule(require('dompurify'));
  // jsdom 22.0 使用了 esm
  const { JSDOM } = importModule(require('jsdom'));
  const { window } = new JSDOM('<!DOCTYPE html>');
  return DOMPurifyInitializer(window);
}

export function resolveDOMPurify() {
  if (DOMPurify.isSupported) {
    return DOMPurify;
  }
  return initDOMPurifyWithJSDOM() as DOMPurify.DOMPurifyI;
}
