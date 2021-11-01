# Electron Basic

## 添加 Menu Logo Icon 的方法
在 ComponentContribution 中添加对应的 containerId ,就会在 Menubar 中显示一个 logoIcon。
```typescript
registry.register('@ali/ide-menu-bar-logo', {
  id: '@ali/ide-menu-bar-logo',
  component: LogoIcon,
}, {
  containerId: '@ali/ide-menu-bar-logo',
});
```

下面是 logoIcon 的实现， 一般 icon 的宽度是 35px
```typescript
import React from 'react';
import cls from 'classnames';
import { getIcon } from '@ali/ide-core-browser';
import styles from './logo.module.less';

export const LogoIcon = () => <div className={cls(styles.logoIcon, getIcon('logo'))}></div>;
```
注意：目前的 font icon 不支持渐变等，所以可以单独使用 svg 创建组件。
