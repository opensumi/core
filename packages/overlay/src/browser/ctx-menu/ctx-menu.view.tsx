import * as React from 'react';
import Portal from '@ali/ide-core-browser/lib/components/portal';
import { observer } from 'mobx-react-lite';
import clx from 'classnames';
import { ClickOutside } from '@ali/ide-core-browser/lib/components/click-outside';
import { useInjectable, KeybindingRegistry, ResolvedKeybinding } from '@ali/ide-core-browser';
import { IBrowserCtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import { SeparatorMenuItemNode } from '@ali/ide-core-browser/lib/menu/next/menu-service';
import { MenuNode } from '@ali/ide-core-browser/lib/menu/next/base';
import Icon from '@ali/ide-core-browser/lib/components/icon';

import Menu, { Item, Divider } from 'rc-menu';
import { ClickParam } from 'antd/lib/menu';
import 'rc-menu/assets/index.css';

import * as styles from './ctx-menu.module.less';

export const MenuContent: React.FC<{
  data: MenuNode;
}> = ({ data }) => {
  const keybindings = useInjectable<KeybindingRegistry>(KeybindingRegistry);

  const shortcut = React.useMemo(() => {
    if (data.id) {
      const keybinding = keybindings.getKeybindingsForCommand(data.id) as ResolvedKeybinding[];
      if (keybinding.length > 0) {
        return keybinding[0]!.resolved![0].toString();
      }
    }
    return '';
  }, [data.id]);

  return (
    <>
      <div className={styles.icon}>
        { data.icon && <Icon iconClass={data.icon} /> }
      </div>
      {data.label}
      <div className={styles.shortcut}>{shortcut}</div>
      <div className={styles.submenuIcon}>
        {/* need a arrow right here */}
      </div>
    </>
  );
};

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
                  return <Divider key={`divider-${index}`} />;
                }
                return (
                  <Item key={menuNode.id}>
                    <MenuContent key={menuNode.id} data={menuNode} />
                  </Item>
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
