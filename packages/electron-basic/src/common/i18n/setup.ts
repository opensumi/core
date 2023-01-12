import { registerLocalizationBundle } from '@opensumi/ide-core-common/lib/localize';

import { localizationBundle as en } from './en-US.lang';
import { localizationBundle as zh } from './zh-CN.lang';

registerLocalizationBundle(zh);
registerLocalizationBundle(en);
