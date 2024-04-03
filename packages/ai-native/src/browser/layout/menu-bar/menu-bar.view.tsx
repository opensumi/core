import cls from 'classnames';
import * as React from 'react';

import { AINativeConfigService, SlotLocation, SlotRenderer, getIcon, useInjectable } from '@opensumi/ide-core-browser';
import { Icon } from '@opensumi/ide-core-browser/lib/components';
import { AILogoAvatar, EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import { AbstractContextMenuService, ICtxMenuRenderer, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { CommandService } from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import { AI_CHAT_VIEW_ID } from '../../../common/';
import { AI_MENU_BAR_LEFT, AI_MENU_BAR_RIGHT } from '../layout-config';

import opensumiLogo from './logo.svg';
import styles from './menu-bar.module.less';

const AIMenuBarRender = () => {
  const contextmenuService = useInjectable<AbstractContextMenuService>(AbstractContextMenuService);
  const ctxMenuRenderer = useInjectable<ICtxMenuRenderer>(ICtxMenuRenderer);
  const aiNativeConfigService = useInjectable<AINativeConfigService>(AINativeConfigService);

  const iconRef = React.useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = React.useState<{ x: number; y: number } | undefined>(undefined);

  React.useEffect(() => {
    if (iconRef.current) {
      const rect = iconRef.current.getBoundingClientRect();
      const { x, y, height } = rect;

      setAnchor({
        x,
        y: y + height + 4,
      });
    }
  }, []);

  const extraTopMenus = React.useMemo(
    () =>
      contextmenuService.createMenu({
        id: MenuId.AIMenuBarTopExtra,
      }),
    [contextmenuService],
  );

  const handleClick = React.useCallback(() => {
    if (!anchor) {
      return;
    }

    const menuNodes = extraTopMenus.getMergedMenuNodes();
    extraTopMenus.dispose();

    ctxMenuRenderer.show({
      anchor,
      menuNodes,
    });
  }, [anchor, extraTopMenus]);

  const logo = React.useMemo(
    () => aiNativeConfigService.layout.menubarLogo || opensumiLogo,
    [aiNativeConfigService.layout.menubarLogo],
  );

  return (
    <>
      <EnhanceIcon wrapperClassName={styles.ai_enhance_menu} ref={iconRef} onClick={handleClick}>
        <div className={styles.logo_container}>
          <img className={styles.extra_top_icon} src={logo} alt='' />
          <Icon className={cls(getIcon('down'), styles.caret_icon)} />
        </div>
      </EnhanceIcon>
    </>
  );
};

export const AIMenuBarView = () => {
  const commandService = useInjectable<CommandService>(CommandService);
  const mainLayoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const aiNativeConfigService = useInjectable<AINativeConfigService>(AINativeConfigService);
  const layoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const [isVisiablePanel, setIsVisiablePanel] = React.useState<boolean>(false);

  React.useEffect(() => {
    requestAnimationFrame(() => {
      setIsVisiablePanel(isVisiable());
    });
  }, []);

  const handleLeftMenuVisiable = React.useCallback(() => {
    commandService.executeCommand('main-layout.left-panel.toggle');
    requestAnimationFrame(() => {
      setIsVisiablePanel(isVisiable());
    });
  }, []);

  const isVisiable = React.useCallback(() => {
    const tabbarService = mainLayoutService.getTabbarService(SlotLocation.left);
    return !!tabbarService.currentContainerId;
  }, [mainLayoutService]);

  const handleChatVisible = React.useCallback(() => {
    layoutService.toggleSlot(AI_CHAT_VIEW_ID);
  }, [layoutService]);

  return (
    <div
      id={VIEW_CONTAINERS.MENUBAR}
      className={styles.menu_bar_view}
      style={{ height: aiNativeConfigService.appConfig.layoutViewSize?.menubarHeight }}
    >
      <div className={styles.container}>
        <div className={styles.left}>
          <EnhanceIcon
            wrapperClassName={styles.enhance_menu}
            icon={isVisiablePanel ? 'left-nav-open' : 'left-nav-close'}
            onClick={handleLeftMenuVisiable}
          />
          <span className={styles.dividing}></span>
          <div className={styles.top_menus_bar}>
            <AIMenuBarRender />
          </div>
          <SlotRenderer slot={AI_MENU_BAR_LEFT} flex={1} overflow={'initial'} />
        </div>
        <div className={styles.right}>
          <SlotRenderer slot={AI_MENU_BAR_RIGHT} flex={1} overflow={'initial'} />
          <div className={styles.ai_switch} onClick={handleChatVisible}>
            <AILogoAvatar iconClassName={styles.avatar_icon_large} />
          </div>
        </div>
      </div>
    </div>
  );
};
