import * as React from 'react';
import Portal from '@ali/ide-core-browser/lib/components/portal';
import { observer } from 'mobx-react-lite';
import clx from 'classnames';
import { ClickOutside } from '@ali/ide-core-browser/lib/components/click-outside';
import { useInjectable } from '@ali/ide-core-browser';
import { IBrowserCtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import { SeparatorMenuItemNode } from '@ali/ide-core-browser/lib/menu/next/menu-service';
import { MenuNode } from '@ali/ide-core-browser/lib/menu/next/base';
import { MenuActionList } from '@ali/ide-core-browser/lib/components/actions';

import * as styles from './ctx-menu.module.less';

export const CtxMenu = observer(() => {
  const ctxMenuService = useInjectable<IBrowserCtxMenuRenderer>(IBrowserCtxMenuRenderer);

  const handleClick = React.useCallback((item: MenuNode) => {
    // do nothing when click separator node
    if (item.id === SeparatorMenuItemNode.ID) {
      return;
    }

    ctxMenuService.hide();
  }, []);

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
          <MenuActionList
            data={ctxMenuService.menuNodes}
            onClick={handleClick}
            context={ctxMenuService.context}
          />
        </div>
      </ClickOutside>
    </Portal>
  );
});

CtxMenu.displayName = 'CtxMenu';
