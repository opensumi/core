import cls from 'classnames';
import * as React from 'react';

import {
  AINativeConfigService,
  IContextKeyService,
  SlotLocation,
  SlotRenderer,
  getIcon,
  useInjectable,
} from '@opensumi/ide-core-browser';
import {
  AI_AGENTIC_WORKBENCH_IS_VISIBLE,
  AI_AGENTIC_WORKBENCH_TOGGLE,
  AI_PANEL_LAYOUT_CONTEXT,
  AI_PANEL_LAYOUT_GET,
} from '@opensumi/ide-core-browser/lib/ai-native/command';
import { Icon } from '@opensumi/ide-core-browser/lib/components';
import { EnhanceIcon } from '@opensumi/ide-core-browser/lib/components/ai-native';
import { DesignLayoutConfig } from '@opensumi/ide-core-browser/lib/layout/constants';
import { VIEW_CONTAINERS } from '@opensumi/ide-core-browser/lib/layout/view-id';
import { AbstractContextMenuService, ICtxMenuRenderer, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import { CommandRegistry, CommandService, PanelLayoutMode } from '@opensumi/ide-core-common';
import { IMainLayoutService } from '@opensumi/ide-main-layout';
import { ToolBar } from '@opensumi/ide-toolbar/lib/browser/toolbar.view';

import { DESIGN_MENU_BAR_LEFT, DESIGN_MENU_BAR_RIGHT } from '../../common';

import OpenSumiLogo from './logo.svg';
import styles from './menu-bar.module.less';

const panelLayoutContextKeys = new Set([AI_PANEL_LAYOUT_CONTEXT]);

const normalizePanelLayoutMode = (mode: unknown): PanelLayoutMode => (mode === 'agentic' ? 'agentic' : 'classic');

const DesignMenuBarRender = () => {
  const contextmenuService = useInjectable<AbstractContextMenuService>(AbstractContextMenuService);
  const designLayoutConfig = useInjectable<DesignLayoutConfig>(DesignLayoutConfig);
  const ctxMenuRenderer = useInjectable<ICtxMenuRenderer>(ICtxMenuRenderer);

  const iconRef = React.useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = React.useState<{ x: number; y: number } | undefined>(undefined);

  React.useEffect(() => {
    handleRefRect();
  }, []);

  const handleRefRect = React.useCallback(
    (cb?: (_anchor: { x: number; y: number }) => void) => {
      requestAnimationFrame(() => {
        if (iconRef.current) {
          const rect = iconRef.current.getBoundingClientRect();
          const { x, y, width, height } = rect;
          const _anchor = {
            x,
            y: y + height,
          };

          setAnchor(_anchor);

          if (cb) {
            cb(_anchor);
          }
        }
      });
    },
    [iconRef.current],
  );

  const extraTopMenus = React.useMemo(
    () =>
      contextmenuService.createMenu({
        id: MenuId.DesignMenuBarTopExtra,
      }),
    [contextmenuService],
  );

  const handleClick = React.useCallback(() => {
    if (!anchor) {
      return;
    }

    const menuNodes = extraTopMenus.getMergedMenuNodes();
    extraTopMenus.dispose();

    handleRefRect((_anchor) => {
      ctxMenuRenderer.show({
        anchor: _anchor,
        menuNodes,
      });
    });
  }, [anchor, extraTopMenus]);

  const logo = React.useMemo(() => designLayoutConfig.menubarLogo || OpenSumiLogo, [designLayoutConfig.menubarLogo]);

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

export const DesignMenuBarView = () => {
  const commandService = useInjectable<CommandService>(CommandService);
  const commandRegistry = useInjectable<CommandRegistry>(CommandRegistry);
  const contextKeyService = useInjectable<IContextKeyService>(IContextKeyService);
  const mainLayoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const aiNativeConfigService = useInjectable<AINativeConfigService>(AINativeConfigService);
  const [isLeftPanelVisible, setIsVisiablePanel] = React.useState<boolean>(false);
  const [panelLayout, setPanelLayout] = React.useState<PanelLayoutMode>(() =>
    normalizePanelLayoutMode(contextKeyService.getContextKeyValue(AI_PANEL_LAYOUT_CONTEXT)),
  );

  const isVisiable = React.useCallback(() => {
    const tabbarService = mainLayoutService.getTabbarService(SlotLocation.view);
    return !!tabbarService.currentContainerId.get();
  }, [mainLayoutService]);

  const getAgenticWorkbenchVisible = React.useCallback(async () => {
    if (!commandRegistry.getCommand(AI_AGENTIC_WORKBENCH_IS_VISIBLE.id)) {
      return undefined;
    }

    try {
      return await commandService.executeCommand<boolean | undefined>(AI_AGENTIC_WORKBENCH_IS_VISIBLE.id);
    } catch {
      return undefined;
    }
  }, [commandRegistry, commandService]);

  const refreshPanelVisible = React.useCallback(() => {
    requestAnimationFrame(() => {
      void getAgenticWorkbenchVisible().then((visible) => {
        setIsVisiablePanel(typeof visible === 'boolean' ? visible : isVisiable());
      });
    });
  }, [getAgenticWorkbenchVisible, isVisiable]);

  const refreshPanelLayout = React.useCallback(() => {
    const contextPanelLayout = contextKeyService.getContextKeyValue<PanelLayoutMode>(AI_PANEL_LAYOUT_CONTEXT);
    if (contextPanelLayout === 'classic' || contextPanelLayout === 'agentic') {
      setPanelLayout(contextPanelLayout);
      return;
    }

    if (!commandRegistry.getCommand(AI_PANEL_LAYOUT_GET.id)) {
      setPanelLayout('classic');
      return;
    }

    void commandService
      .executeCommand<PanelLayoutMode | undefined>(AI_PANEL_LAYOUT_GET.id)
      .then((mode) => setPanelLayout(normalizePanelLayoutMode(mode)))
      .catch(() => setPanelLayout('classic'));
  }, [commandRegistry, commandService, contextKeyService]);

  React.useEffect(() => {
    refreshPanelVisible();
    const tabbarService = mainLayoutService.getTabbarService(SlotLocation.view);
    const toDispose = tabbarService.onCurrentChange(() => refreshPanelVisible());

    return () => {
      toDispose.dispose();
    };
  }, [mainLayoutService, refreshPanelVisible]);

  React.useEffect(() => {
    refreshPanelLayout();
    const toDispose = contextKeyService.onDidChangeContext((event) => {
      if (event.payload.affectsSome(panelLayoutContextKeys)) {
        refreshPanelLayout();
      }
    });

    return () => {
      toDispose.dispose();
    };
  }, [contextKeyService, refreshPanelLayout]);

  const handleLeftMenuVisiable = React.useCallback(async () => {
    if (commandRegistry.getCommand(AI_AGENTIC_WORKBENCH_TOGGLE.id)) {
      const visible = await commandService
        .executeCommand<boolean | undefined>(AI_AGENTIC_WORKBENCH_TOGGLE.id)
        .catch(() => undefined);

      if (typeof visible === 'boolean') {
        setIsVisiablePanel(visible);
        return;
      }
    }

    await commandService.executeCommand('main-layout.left-panel.toggle');
    refreshPanelVisible();
  }, [commandRegistry, commandService, refreshPanelVisible]);

  const leftPanelToggle = (
    <EnhanceIcon
      wrapperClassName={styles.enhance_menu}
      icon={isLeftPanelVisible ? 'left-nav-open' : 'left-nav-close'}
      onClick={handleLeftMenuVisiable}
    />
  );
  const topMenusBar = (
    <div className={styles.top_menus_bar}>
      <DesignMenuBarRender />
    </div>
  );
  const isAgenticLayout = panelLayout === 'agentic';

  return (
    <div
      id={VIEW_CONTAINERS.MENUBAR}
      className={styles.menu_bar_view}
      style={{ height: aiNativeConfigService.layoutViewSize.menubarHeight }}
    >
      <div className={styles.container}>
        <div className={styles.left}>
          {!isAgenticLayout && leftPanelToggle}
          {!isAgenticLayout && <span className={styles.dividing}></span>}
          {!isAgenticLayout && topMenusBar}
          <SlotRenderer id='design-menubar-left' slot={DESIGN_MENU_BAR_LEFT} flex={1} />
        </div>
        <div className={styles.right}>
          <ToolBar />
          <SlotRenderer id='design-menubar-right' slot={DESIGN_MENU_BAR_RIGHT} flex={1} />
          {isAgenticLayout && topMenusBar}
          {isAgenticLayout && leftPanelToggle}
        </div>
      </div>
    </div>
  );
};
