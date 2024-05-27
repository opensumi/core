import clsx from 'classnames';
import * as React from 'react';

import { getIcon, useInjectable, SlotRenderer, SlotLocation, AiNativeConfigService } from '@opensumi/ide-core-browser';
// import { AI_RUN_DEBUG_COMMANDS } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { AI_CHAT_PANEL_TOGGLE_VISIBLE } from '@opensumi/ide-core-browser/lib/ai-native/command';
import { Icon } from '@opensumi/ide-core-browser/lib/components';
import { AILogoAvatar, EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { LAYOUT_VIEW_SIZE } from '@opensumi/ide-core-browser/lib/layout/constants';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import { AbstractContextMenuService, ICtxMenuRenderer, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { CommandService } from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';

import { AI_MENU_BAR_LEFT, AI_MENU_BAR_RIGHT } from '../layout-config';

import styles from './menu-bar.module.less';

const AiMenuBarRender = () => {
  const contextmenuService = useInjectable<AbstractContextMenuService>(AbstractContextMenuService);
  const ctxMenuRenderer = useInjectable<ICtxMenuRenderer>(ICtxMenuRenderer);

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
  }, [iconRef.current]);

  const extraTopMenus = React.useMemo(
    () =>
      contextmenuService.createMenu({
        id: MenuId.AiMenuBarTopExtra,
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

  return (
    <>
      <EnhanceIcon
        wrapperClassName={styles.ai_enhance_menu}
        className={styles.extra_top_icon}
        ref={iconRef}
        onClick={handleClick}
      >
        <Icon className={clsx(getIcon('down'), styles.caret_icon)} />
      </EnhanceIcon>
    </>
  );
};

export const AiMenuBarView = () => {
  const commandService = useInjectable<CommandService>(CommandService);
  const mainLayoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const aiNativeConfigService = useInjectable<AiNativeConfigService>(AiNativeConfigService);
  const [isVisiablePanel, setIsVisiablePanel] = React.useState<boolean>(false);

  // const handleRun = () => {
  //   commandService.executeCommand(AI_RUN_DEBUG_COMMANDS.id);
  // };

  const handleRightPanel = () => {
    commandService.executeCommand(AI_CHAT_PANEL_TOGGLE_VISIBLE.id);
  };

  const isVisiable = React.useCallback(() => {
    const tabbarService = mainLayoutService.getTabbarService(SlotLocation.left);
    return !!tabbarService.currentContainerId;
  }, [mainLayoutService]);

  React.useEffect(() => {
    requestAnimationFrame(() => {
      setIsVisiablePanel(isVisiable());
    });
  }, []);

  const MENUBAR_HEIGHT = React.useMemo(
    () => aiNativeConfigService.appConfig.layoutViewSize?.MENUBAR_HEIGHT || LAYOUT_VIEW_SIZE.MENUBAR_HEIGHT,
    [aiNativeConfigService],
  );

  const handleLeftMenuVisiable = React.useCallback(() => {
    commandService.executeCommand('main-layout.left-panel.toggle');
    requestAnimationFrame(() => {
      setIsVisiablePanel(isVisiable());
    });
  }, []);

  return (
    <div id={VIEW_CONTAINERS.MENUBAR} className={styles.menu_bar_view} style={{ height: MENUBAR_HEIGHT }}>
      <div className={styles.container}>
        <div className={styles.left}>
          <EnhanceIcon
            wrapperClassName={styles.enhance_menu}
            icon={isVisiablePanel ? 'left-nav-open' : 'left-nav-close'}
            onClick={handleLeftMenuVisiable}
          />
          <span className={styles.dividing}></span>
          <div className={styles.top_menus_bar}>
            <AiMenuBarRender />
          </div>
          <SlotRenderer slot={AI_MENU_BAR_LEFT} flex={1} overflow={'initial'} />
        </div>
        <div className={styles.center}>
          {/* <div className={styles.run}>
            <Button size={'default'} type='default' onClick={handleRun} className={styles.btn}>
              <Icon className={getIcon('run')} /> 运行
            </Button>
          </div> */}
        </div>
        <div className={styles.right}>
          <SlotRenderer slot={AI_MENU_BAR_RIGHT} flex={1} overflow={'initial'} />
          {/* <div className={styles.input}>
            <Input
              className={styles.input_wrapper}
              width={'100%'}
              addonBefore={<Icon style={{ color: '#ffffff1f' }} className={getIcon('search')} />}
              placeholder='请搜索并选择指令'
            ></Input>
          </div> */}
          {aiNativeConfigService.capabilities.supportsAiChatAssistant && (
            <div className={styles.ai_switch} onClick={handleRightPanel}>
              <AILogoAvatar iconClassName={styles.avatar_icon_large} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
