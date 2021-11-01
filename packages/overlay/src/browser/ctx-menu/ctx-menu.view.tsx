import React from 'react';
import { observer } from 'mobx-react-lite';
import { ClickOutside } from '@ali/ide-core-browser/lib/components/click-outside';
import { useInjectable } from '@ali/ide-core-browser';
import { IBrowserCtxMenu } from '@ali/ide-core-browser/lib/menu/next/renderer/ctxmenu/browser';
import { MenuActionList } from '@ali/ide-core-browser/lib/components/actions';
import placements from '@ali/ide-core-browser/lib/components/actions/placements';
import CtxMenuTrigger from 'react-ctxmenu-trigger';
import 'react-ctxmenu-trigger/assets/index.css';

export const CtxMenu = observer(() => {
  const ctxMenuService = useInjectable<IBrowserCtxMenu>(IBrowserCtxMenu);

  const handleClick = React.useCallback(() => {
    ctxMenuService.hide(false);
  }, []);

  const onClickOutSide = React.useCallback(() => {
    if (ctxMenuService.visible) {
      ctxMenuService.hide(true);
    }
  }, [ctxMenuService.visible]);

  // todo: 缓存上一次点击 visible 完成 toggle 效果
  return (
    <CtxMenuTrigger
      // popupTransitionName='slide-up'
      popupPlacement='bottomLeft'
      popupVisible={ctxMenuService.visible}
      action={['contextMenu']}
      popupAlign={{
        overflow: {
          adjustX: 1,
          adjustY: 1,
        },
      }}
      point={ctxMenuService.point || {}}
      popupClassName='point-popup'
      builtinPlacements={placements}
      popup={(
        <ClickOutside
          mouseEvents={['click', 'contextmenu']}
          onOutsideClick={onClickOutSide}>
          <MenuActionList
            data={ctxMenuService.menuNodes}
            afterClick={handleClick}
            context={ctxMenuService.context}
          />
        </ClickOutside>
      )}
      alignPoint
    />
  );
});

CtxMenu.displayName = 'CtxMenu';
