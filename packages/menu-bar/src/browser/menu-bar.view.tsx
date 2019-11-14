import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import { MenuActionList } from '@ali/ide-core-browser/lib/components/actions';
import { ClickOutside } from '@ali/ide-core-browser/lib/components/click-outside';
import { IMenubarItem, generateCtxMenu, MenuNode } from '@ali/ide-core-browser/lib/menu/next';
import Dropdown from 'antd/lib/dropdown';
import 'antd/lib/dropdown/style/index.less';

import { MenubarStore } from './menu-bar.store';
import * as styles from './menu-bar.module.less';

const MenubarItem = observer<IMenubarItem>(({ id, label }) => {
  const menubarStore = useInjectable<MenubarStore>(MenubarStore);
  const [menuNodes, setMenuNodes] = React.useState<MenuNode[]>([]);

  const handleClick = React.useCallback(() => {
    const menus = menubarStore.getMenubarItem(id);
    if (menus) {
      const result = generateCtxMenu({ menus });
      if (result.length === 2) {
        setMenuNodes([ ...result[0], ...result[1] ]);
      }
    }
  }, [id]);

  return (
    <Dropdown
      transitionName=''
      overlay={<MenuActionList data={menuNodes} />}
      trigger={['click']}>
      <div className={styles['menubar-title']} onClick={handleClick}>{label}</div>
    </Dropdown>
  );
});

export const MenuBar = observer(() => {
  const menubarStore = useInjectable<MenubarStore>(MenubarStore);

  return (
    <div className={styles.menubars}>
      {
        menubarStore.menubarItems.map(({ id, label }) => {
          return <div className={styles.menubar}>
            <MenubarItem key={id} id={id} label={label} />
          </div>;
        })
      }
    </div>
  );
});

MenuBar.displayName = 'MenuBar';
