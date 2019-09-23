import * as React from 'react';
import Portal from '@ali/ide-core-browser/lib/components/portal';
import { observer } from 'mobx-react-lite';
import clx from 'classnames';
import { ClickOutside } from '@ali/ide-core-browser/lib/components/click-outside';
import { useInjectable } from '@ali/ide-core-browser';
import { IBrowserCtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import { SeparatorMenuItemNode } from '@ali/ide-core-browser/lib/menu/next/menu-service';

import Menu, { Item as MenuItem, Divider } from 'rc-menu';
import 'rc-menu/assets/index.css';

import * as styles from './ctx-menu.module.less';
import { ClickParam } from 'antd/lib/menu';

export const CtxMenu = observer(() => {
  const ctxMenuService = useInjectable<IBrowserCtxMenuRenderer>(IBrowserCtxMenuRenderer);

  const handleClick = React.useCallback(({ key }: ClickParam) => {
    // do nothing when click separator node
    if (key === SeparatorMenuItemNode.ID) {
      return;
    }
    const menuItem = ctxMenuService.menuNodes.find((n) => n.id === key);
    if (menuItem && menuItem.execute) {
      menuItem.execute(ctxMenuService.context);
    }

    ctxMenuService.hide();
  }, [ ctxMenuService.menuNodes ]);

  return (
    <Portal id='ctx-menu'>
      <ClickOutside
        mouseEvents={['click', 'contextmenu']}
        onOutsideClick={() => ctxMenuService.hide()}>
        <div
          style={
            ctxMenuService.position ? {
              left: ctxMenuService.position.left,
              top: ctxMenuService.position.top,
            } : {}
          }
          className={clx(styles.ctxmenu, { [styles.hidden]: !ctxMenuService.visible })}>
          <Menu
            className={styles.menu}
            mode='inline'
            selectedKeys={[]}
            onClick={handleClick}>
            {
              ctxMenuService.menuNodes.map((menuNode, index) => {
                if (menuNode.id === SeparatorMenuItemNode.ID) {
                  return <Divider key={`divider${index}`} />;
                }
                return (
                  <MenuItem key={menuNode.id}>
                    {menuNode.label}
                  </MenuItem>
                );
              })
            }
          </Menu>
        </div>
      </ClickOutside>
    </Portal>
  );
});

CtxMenu.displayName = 'CtxMenu';
