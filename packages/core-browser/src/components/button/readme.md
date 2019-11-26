### 示例代码

```tsx
import * as React from 'react';
import { Menu, Dropdown } from 'antd';
import { Button } from '@ali/ide-core-browser/lib/components/button';

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
      <Dropdown className={'kt-menu'} overlay={menu} trigger={['click']}>
        <Button type='danger'>123</Button>
      </Dropdown>

      <Button type='primary' ghost block>123</Button>
      <Button type='danger' ghost>123</Button>
      <Button type='primary'>123</Button>
      <Button type='danger'>123</Button>
    </div>
  );
};
```
