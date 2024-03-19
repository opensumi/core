// eslint-disable-next-line import/order
import { LOCALE_TYPES } from '@opensumi/ide-core-common/lib/const';

const defaultLanguage = LOCALE_TYPES.EN_US;
import '@opensumi/ide-i18n';
import '@opensumi/ide-core-browser/lib/style/index.less';

import { getDefaultClientAppOpts, renderApp } from './render-app';

import '../styles.less';

renderApp(
  getDefaultClientAppOpts({
    defaultLanguage,
  }),
);
