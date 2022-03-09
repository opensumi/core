const { JSDOM } = require('jsdom');
// new TextDecoder('ascii') is not supported in node12
// use TextDecoder and TextEncoder from `text-encoding`
const { TextDecoder, TextEncoder } = require('text-encoding');

const jsdom = new JSDOM('<div id="main"></div>', {
  // https://github.com/jsdom/jsdom#basic-options
  // 禁用掉 resources: usable, 采用 jsdom 默认策略不加载 subresources
  // 避免测试用例加载 external subresource, 如 iconfont 的 css 挂掉
  // resources: 'usable',
  runScripts: 'dangerously',
  url: 'http://localhost/?id=1',
});
global.document = jsdom.window.document;
let text = '';
global.navigator = Object.assign(jsdom.window.navigator, {
  clipboard: {
    writeText(value) {
      text = value;
    },
    readText() {
      return text;
    },
  },
});
global.Element = jsdom.window.Element;
global.HTMLDivElement = jsdom.window.HTMLDivElement;
global.fetch = jsdom.window.fetch;
global.location = jsdom.window.location;
global.getComputedStyle = jsdom.window.getComputedStyle;
global.window = jsdom.window;
global.DOMParser = jsdom.window.DOMParser;
global.HTMLDivElement = jsdom.window.HTMLDivElement;
global.MutationObserver = jsdom.window.MutationObserver;
global.KeyboardEvent = jsdom.window.KeyboardEvent;
global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
jsdom.window.requestAnimationFrame = (fn) => setTimeout(fn, 16);
jsdom.window.cancelAnimationFrame = () => {};
global.document.queryCommandSupported = () => {};
global.document.execCommand = () => {};
global.HTMLElement = jsdom.window.HTMLElement;
global.self = global;
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

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
