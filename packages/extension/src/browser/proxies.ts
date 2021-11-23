function noop() {}

function originalProp(target, prop) {
  if (typeof target[prop] === 'function' && /^[a-z]/.test(prop as string)) {
    return target[prop].bind && target[prop].bind(target);
  }
  return target[prop];
}

export function createProxiedDocument(proxiedHead: HTMLHeadElement) {
  return new Proxy(document, {
    get: (target, prop) => {
      switch (prop) {
        case 'write':
        case 'writeln':
          return noop;
        case 'querySelector':
          return (selector) => {
            if (selector === 'head') {
              return proxiedHead;
            }
            return originalProp(target, prop)(selector);
          };
        default:
          return originalProp(target, prop);
      }
    },
  });
}

export function createProxiedWindow(proxiedDocument: HTMLDocument, proxiedHead: HTMLHeadElement) {
  return new Proxy(window, {
    get: (target, prop) => {
      switch (prop) {
        case 'document':
          return proxiedDocument || createProxiedDocument(proxiedHead);
        default:
          return originalProp(target, prop);
      }
    },
  });
}
