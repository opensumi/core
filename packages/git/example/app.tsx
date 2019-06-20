import { renderApp } from '@ali/ide-dev-tool/src/dev-app';
const packageName = require('../package.json').name;

renderApp({
  modules: [ packageName ],
});
