import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import { MenuActionList } from '@ali/ide-core-browser/lib/components/actions';
import { ClickOutside } from '@ali/ide-core-browser/lib/components/click-outside';
import Dropdown from 'antd/lib/dropdown';
import 'antd/lib/dropdown/style/index.less';

import { MenubarService } from './menu-bar.service';
import * as styles from './menu-bar.module.less';

export const MenuBar = observer(() => {
  const menuBarService = useInjectable<MenubarService>(MenubarService);

  const [clicked, setClicked] = React.useState<boolean>(false);

  const handleClick = React.useCallback(() => {
    setClicked((r) => !r);
  }, []);

  return (
    <ClickOutside
      className={styles.menubars}
      mouseEvents={['click', 'contextmenu']}
      onOutsideClick={() => setClicked(false)}>
      {
        menuBarService.menubarItems.map(({ id, label }) => {
          const menuBarService = useInjectable<MenubarService>(MenubarService);
          const menuNodes = menuBarService.menuNodeCollection.get(id) || [];
          return <div className={styles.menubar} key={id}>
            {
              Array.isArray(menuNodes) && menuNodes.length
                ? <Dropdown
                  overlay={<MenuActionList data={menuNodes} />}
                  trigger={clicked ? ['hover', 'click'] : ['click']}>
                  <div className={styles['menubar-title']} onClick={handleClick}>{label}</div>
                </Dropdown>
                : <div className={styles['menubar-title']} onClick={handleClick}>{label}</div>
            }
          </div>;
        })
      }
    </ClickOutside>
  );
});

MenuBar.displayName = 'MenuBar';
