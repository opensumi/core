require('./jest.setup.base');
require('jest-canvas-mock');
require('intersection-observer');
require('jest-fetch-mock').enableMocks();
const { Buffer } = require('buffer');
const timer = require('timers');

// vscode-jsonrpc 的 node 层需要 setImmediate 函数
global.setImmediate = timer.setImmediate;
global.Buffer = Buffer;
global.clearImmediate = timer.clearImmediate;

// packages/extension/__tests__/browser/main.thread.env.test.ts
// MainThreadEnvAPI Test Suites  › can read/write text via clipboard
let text = '';
global.IS_REACT_ACT_ENVIRONMENT = true;

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

global.localStorage = new MockLocalStorage();

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

// Mock window.crypto
Object.defineProperty(window, 'crypto', {
  writable: true,
  value: {
    randomUUID: () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    }),
    getRandomValues: (array) => {
      if (!(array instanceof Int8Array || array instanceof Uint8Array ||
            array instanceof Int16Array || array instanceof Uint16Array ||
            array instanceof Int32Array || array instanceof Uint32Array ||
            array instanceof Uint8ClampedArray)) {
        throw new TypeError('Expected a TypedArray');
      }
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    },
  },
});

// Mock window.CSS
Object.defineProperty(window, 'CSS', {
  writable: true,
  value: {
    escape: jest.fn((str) => str),
  },
});
