import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import { ICtxMenuRenderer, MenuNode } from '@ali/ide-core-browser/lib/menu/next';
import { MenuActionList } from '@ali/ide-core-browser/lib/components/actions';
import Dropdown from 'antd/lib/dropdown';
import 'antd/lib/dropdown/style/index.less';

import { MenuBarService } from './menu-bar.service';
import * as styles from './menu-bar.module.less';

export const MenuBar = observer(() => {
  const menuBarService = useInjectable<MenuBarService>(MenuBarService);

  const handleClick = React.useCallback((titleEnum: string, e: React.MouseEvent<HTMLElement>) => {
    const menuNodes = menuBarService.getMenuNodes(titleEnum);
  }, []);

  return (
    <div className={styles.menubars}>
      {
        Object.entries(menuBarService.titles).map((config, index) => {
          const menuNodes = menuBarService.menuNodeCollection[config[0]];
          return <div key={index} className={styles.menubar}>
            {
              Array.isArray(menuNodes)
                ? <Dropdown
                  transitionName=''
                  overlay={<MenuActionList data={menuNodes} />}
                  trigger={['click', 'hover']}>
                  <div className={styles['menubar-title']}>{config[1]}</div>
                </Dropdown>
                : <div className={styles['menubar-title']}>{config[1]}</div>
            }
          </div>;
        })
      }
    </div>
  );
});
