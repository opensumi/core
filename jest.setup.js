const {JSDOM} = require('jsdom');

const jsdom = new JSDOM(``, {
  resources: 'usable',
  runScripts: 'dangerously',
});
global.document = jsdom.window.document;
global.navigator = jsdom.window.navigator;
global.Element = jsdom.window.Element;
global.fetch = jsdom.window.fetch;
// global.window = jsdom.window;
