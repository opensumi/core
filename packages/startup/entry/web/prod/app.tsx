// eslint-disable-next-line import/order
import { LOCALE_TYPES } from '@opensumi/ide-core-common/lib/const';

const defaultLanguage = LOCALE_TYPES.EN_US;
// eslint-disable-next-line import/order
import { setLocale } from '@opensumi/ide-monaco/lib/browser/monaco-localize';
// 请注意，集成方在这里需要自己传一个正确的 locale 进去
// 如果不传则默认会根据 PreferenceScope 的优先级从 LocalStorage 取值
setLocale(defaultLanguage);

import '@opensumi/ide-i18n';
import '@opensumi/ide-core-browser/lib/style/index.less';

import { getDefaultClientAppOpts, renderApp } from '../render-app';

import '../../styles.less';

const hostname = window.location.hostname;
const port = window.location.port;

renderApp(
  getDefaultClientAppOpts({
    defaultLanguage,
    opts: {
      webviewEndpoint: '/webview',
      extWorkerHost: '/worker-host.js',
      wsPath: window.location.protocol === 'https:' ? `wss://${hostname}:${port}` : `ws://${hostname}:${port}`,
    },
  }),
);
