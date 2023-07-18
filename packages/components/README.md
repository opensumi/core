# @opensumi/ide-components

## Usage

### Icon/createFromIconfontCN

```tsx
import React from 'react';

import { createFromIconfontCN } from '@opensumi/ide-components/lib/icon/iconfont-cn';
import { Icon } from '@opensumi/ide-components/lib/icon';

type IconFontMap = 'icon-javascript' | 'icon-java' | 'icon-shoppingcart' | 'icon-python';

const IconFont = createFromIconfontCN<IconFontMap>({
  scriptUrl: [
    '//at.alicdn.com/t/font_1788044_0dwu4guekcwr.js', // icon-javascript, icon-java, icon-shoppingcart (overrided)
    '//at.alicdn.com/t/font_1788592_a5xf2bdic3u.js', // icon-shoppingcart, icon-python
  ],
});

export const Sample = () => (
  <div className='icons-list'>
    <IconFont size='large' icon='icon-javascript' />
    <IconFont icon='icon-java' onClick={() => console.log('icon java clicked')} />
    <IconFont loading icon='icon-shoppingcart' />
    <IconFont disabled size='large' icon='icon-python' />
    <Icon icon='explorer' />
    {/* <Icon icon='fanhui' /> */}
    <Icon icon='shangchuan' />
  </div>
);
```

在 OpenSumi 中可通过 appConfig 传入新 Icon/覆盖已存在的 Icon

```js
renderApp({
  // ...
  iconStyleSheets: [
    {
      iconMap: {
        explorer: 'fanhui', // 这种是覆盖，因此在 Icon 中通过 `explorer` 去取
        shangchuan: 'shangchuan', // 这种是新增，因此在 Icon 中通过 `shangchuan` 去取
      },
      prefix: 'tbe tbe-',
      cssPath: '//at.alicdn.com/t/font_403404_1qiu0eed62f.css',
    },
  ],
});
```

## Attention

- components 包的定位是直接能对外使用，不限定于在 OpenSumi 运行环境的组件
- 因此需要注意的是，放到这里的组件应该是纯组件
  - 不包含对 OpenSumi runtime 依赖
  - 不包含对 OpenSumi 其他包的依赖
  - 自己的依赖自己管理
- 脱离 OpenSumi 去单独使用 `@opensumi/ide-components` 时，应手动 import 字体文件

  ```less
  @import '@opensumi/ide-components/lib/icon/iconfont/iconfont.css';
  ```
