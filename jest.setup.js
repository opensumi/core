const { JSDOM } = require('jsdom');

const jsdom = new JSDOM(`<div id="main"></div>`, {
  resources: 'usable',
  runScripts: 'dangerously',
  url: 'http://localhost/',
});
global.document = jsdom.window.document;
global.navigator = jsdom.window.navigator;
global.Element = jsdom.window.Element;
global.fetch = jsdom.window.fetch;
global.location = jsdom.window.location;
global.getComputedStyle = jsdom.window.getComputedStyle;
global.window = jsdom.window;
