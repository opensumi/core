### 示例代码

```tsx
import * as React from 'react';
import { Menu, Dropdown } from 'antd';
import Button from './';

const SCMEmpty = () => {
  const menu = (
    <Menu>
      <Menu.Item key='1'>1st menu item</Menu.Item>
      <Menu.Item key='2'>2nd memu item</Menu.Item>
      <Menu.Item key='3'>3rd menu item</Menu.Item>
    </Menu>
  );

  return (
    <div className={styles.noop}>
      <Button loading>123</Button>
      <Button type='danger'>123</Button>
      <Button loading>123</Button>
      <Dropdown overlay={menu} trigger={['click']}>
        <Button type='danger'>123</Button>
      </Dropdown>

      {localize('scm.provider.empty')}
    </div>
  );
};
```
