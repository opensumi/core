import React, { useEffect, useState } from 'react';

import { AppConfig, localize, useInjectable, ViewContextKeyRegistry } from '@opensumi/ide-core-browser';
import { InlineMenuBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { LAYOUT_VIEW_SIZE } from '@opensumi/ide-core-browser/lib/layout/constants';
import { AbstractContextMenuService, IContextMenu, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { TitleBar } from '@opensumi/ide-main-layout/lib/browser/accordion/titlebar.view';

import { Testing } from '../../common/constants';

import { TestingExplorerTree } from './testing.explorer.tree';
import styles from './testing.module.less';

export const TestingView = () => {
  const menuService = useInjectable<AbstractContextMenuService>(AbstractContextMenuService);
  const viewContextKeyRegistry = useInjectable<ViewContextKeyRegistry>(ViewContextKeyRegistry);
  const appConfig = useInjectable<AppConfig>(AppConfig);

  const [menus, setMenus] = useState<IContextMenu>();

  useEffect(() => {
    const menu = menuService.createMenu({
      id: MenuId.ViewTitle,
      contextKeyService: viewContextKeyRegistry.getContextKeyService(Testing.ExplorerViewId),
    });
    setMenus(menu);
  }, []);

  const PANEL_TITLEBAR_HEIGHT = React.useMemo(
    () => appConfig.layoutViewSize?.PANEL_TITLEBAR_HEIGHT || LAYOUT_VIEW_SIZE.PANEL_TITLEBAR_HEIGHT,
    [appConfig.layoutViewSize],
  );

  return (
    <div className={styles.testing_container}>
      <TitleBar
        title={localize('test.title')}
        height={PANEL_TITLEBAR_HEIGHT}
        menubar={menus ? <InlineMenuBar menus={menus}></InlineMenuBar> : null}
      />
      {/* 筛选器暂时先不搞 */}
      {/* <Input placeholder={'Filter (e.g. text, !exclude, @tag)'} addonAfter={<Icon icon='filter' />} /> */}
      <TestingExplorerTree />
    </div>
  );
};
