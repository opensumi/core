// packages/extension/__tests__/browser/main.thread.env.test.ts
// MainThreadEnvAPI Test Suites  › can read/write text via clipboard
let text = '';
window.navigator = Object.assign(window.navigator, {
  clipboard: {
    writeText(value) {
      text = value;
    },
    readText() {
      return text;
    },
  },
});

// global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
// jsdom.window.requestAnimationFrame = (fn) => setTimeout(fn, 16);
// jsdom.window.cancelAnimationFrame = () => {};

// https://github.com/jsdom/jsdom/issues/1742
document.queryCommandSupported = () => {};
document.execCommand = (command, ui, value) => {
  const node = window.getSelection().anchorNode;
  switch (command) {
    case 'insertHTML':
      if (node.innerHTML) {
        node.innerHTML += value;
      } else {
        // Text node
        node.parentNode.innerHTML += value;
      }
      break;
    case 'insertLineBreak':
      node.innerHTML += '<br>';
      break;
  }
};

global.ElectronIpcRenderer = {
  send: () => {},
  removeListener: () => {},
  on: () => {},
};

class MockLocalStorage {
  constructor() {
    this.store = {};
  }

  clear() {
    this.store = {};
  }

  getItem(key) {
    return this.store[key] || null;
  }

  setItem(key, value) {
    this.store[key] = value.toString();
  }

  removeItem(key) {
    delete this.store[key];
  }
}

// global.localStorage = new MockLocalStorage();

process.env.IS_JEST_TEST = true;

// https://jestjs.io/docs/manual-mocks#mocking-methods-which-are-not-implemented-in-jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(), // deprecated
    removeListener: jest.fn(), // deprecated
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});
