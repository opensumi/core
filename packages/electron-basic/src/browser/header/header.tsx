import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, useRef } from 'react';

import {
  useInjectable,
  MaybeNull,
  ComponentRenderer,
  ComponentRegistry,
  DomListener,
  AppConfig,
  replaceLocalizePlaceholder,
  electronEnv,
  IWindowService,
} from '@opensumi/ide-core-browser';
import { getIcon } from '@opensumi/ide-core-browser';
import { path, isMacintosh, Disposable } from '@opensumi/ide-core-browser';
import { LAYOUT_VIEW_SIZE } from '@opensumi/ide-core-browser/lib/layout/constants';
import { localize } from '@opensumi/ide-core-common';
import { IElectronMainUIService } from '@opensumi/ide-core-common/lib/electron';
import { WorkbenchEditorService, IResource } from '@opensumi/ide-editor';

const { basename } = path;
import styles from './header.module.less';

const useFullScreen = () => {
  const uiService: IElectronMainUIService = useInjectable(IElectronMainUIService);
  const [isFullScreen, setFullScreen] = useState<boolean>(false);

  useEffect(() => {
    uiService.isFullScreen(electronEnv.currentWindowId).then((fullScreen) => {
      setFullScreen(fullScreen);
    });
    const listener = uiService.on('fullScreenStatusChange', (windowId, fullScreen) => {
      if (windowId === electronEnv.currentWindowId) {
        setFullScreen(fullScreen);
      }
    });
    return () => {
      listener.dispose();
    };
  }, []);
  return {
    isFullScreen,
  };
};

const useMaximize = () => {
  const uiService: IElectronMainUIService = useInjectable(IElectronMainUIService);
  const [maximized, setMaximized] = useState(false);

  const getMaximized = async () => uiService.isMaximized(electronEnv.currentWindowId);

  useEffect(() => {
    const maximizeListener = uiService.on('maximizeStatusChange', (windowId, isMaximized) => {
      if (windowId === electronEnv.currentWindowId) {
        setMaximized(isMaximized);
      }
    });
    getMaximized().then((maximized) => {
      setMaximized(maximized);
    });
    return () => {
      maximizeListener.dispose();
    };
  }, []);

  return {
    maximized,
    getMaximized,
  };
};

// Big Sur increases title bar height
const isNewMacHeaderBar = () => isMacintosh && parseFloat(electronEnv.osRelease) >= 20;

export const HeaderBarLeftComponent = () => {
  const componentRegistry: ComponentRegistry = useInjectable(ComponentRegistry);

  if (isMacintosh) {
    return null;
  }

  const initialProps = {
    className: 'menubarWrapper',
  };

  return (
    <>
      <ComponentRenderer
        Component={componentRegistry.getComponentRegistryInfo('@opensumi/ide-menu-bar')!.views[0].component!}
        initialProps={initialProps}
      />
    </>
  );
};

export const HeaderBarRightComponent = () => {
  const { maximized } = useMaximize();
  const windowService: IWindowService = useInjectable(IWindowService);

  if (isMacintosh) {
    return null;
  }

  return (
    <div
      className={styles.windowActions}
      style={{
        height: isNewMacHeaderBar() ? LAYOUT_VIEW_SIZE.BIG_SUR_TITLEBAR_HEIGHT : LAYOUT_VIEW_SIZE.TITLEBAR_HEIGHT,
      }}
    >
      <div className={getIcon('min')} onClick={() => windowService.minimize()} />
      {maximized ? (
        <div className={getIcon('max')} onClick={() => windowService.unmaximize()} />
      ) : (
        <div className={getIcon('unmax')} onClick={() => windowService.maximize()} />
      )}
      <div className={getIcon('close1')} onClick={() => windowService.close()} />
    </div>
  );
};

interface ElectronHeaderBarPorps {
  LeftComponent?: React.FunctionComponent;
  RightComponent?: React.FunctionComponent;
  TitleComponent?: React.FunctionComponent<TitleBarProps>;
  Icon?: React.FunctionComponent;
  autoHide?: boolean;
}

/**
 * autoHide: Hide the HeaderBar when the macOS full screen
 */
export const ElectronHeaderBar = observer(
  ({
    LeftComponent,
    RightComponent,
    TitleComponent,
    Icon,
    autoHide = true,
  }: React.PropsWithChildren<ElectronHeaderBarPorps>) => {
    const windowService: IWindowService = useInjectable(IWindowService);

    const { isFullScreen } = useFullScreen();
    const { getMaximized } = useMaximize();
    if (!LeftComponent) {
      LeftComponent = HeaderBarLeftComponent;
    }
    if (!RightComponent) {
      RightComponent = HeaderBarRightComponent;
    }
    if (!TitleComponent) {
      TitleComponent = HeaderBarTitleComponent;
    }

    // in Mac, hide the header bar if it is in full screen mode
    if (isMacintosh && isFullScreen && autoHide) {
      return (
        <div>
          <TitleComponent hidden={true} transformer={defaultTitleTransformer} />
        </div>
      );
    }

    return (
      <div
        className={styles.header}
        style={{
          height: isNewMacHeaderBar() ? LAYOUT_VIEW_SIZE.BIG_SUR_TITLEBAR_HEIGHT : LAYOUT_VIEW_SIZE.TITLEBAR_HEIGHT,
        }}
        onDoubleClick={async () => {
          if (await getMaximized()) {
            windowService.unmaximize();
          } else {
            windowService.maximize();
          }
        }}
      >
        <LeftComponent />
        <TitleComponent transformer={defaultTitleTransformer} />
        <RightComponent />
      </div>
    );
  },
);

declare const ResizeObserver: any;

export interface TitleInfo {
  currentResourceName?: string;
  workspaceName?: string;
  appName?: string;
  remoteMode?: boolean;
  extensionDevelopmentHost?: boolean;
}

export interface TitleBarProps {
  hidden?: boolean;
  transformer?: (titleInfo: TitleInfo) => string;
}

const defaultTitleTransformer = (titleInfo: TitleInfo) => {
  const developmentTitle = titleInfo.extensionDevelopmentHost ? `[${localize('workspace.development.title')}]` : '';
  const remoteMode = titleInfo.remoteMode ? ` [${localize('common.remoteMode')}]` : '';

  const workspaceName = titleInfo.workspaceName ?? '';
  let currentResourceName = titleInfo.currentResourceName ?? '';
  if (workspaceName !== '' && currentResourceName) {
    currentResourceName += ' — ';
  }
  return developmentTitle + currentResourceName + workspaceName + remoteMode;
};

export const HeaderBarTitleComponent = observer(({ hidden, transformer }: TitleBarProps) => {
  const editorService = useInjectable(WorkbenchEditorService) as WorkbenchEditorService;
  const [currentResource, setCurrentResource] = useState<MaybeNull<IResource>>(editorService.currentResource);
  const ref = useRef<HTMLDivElement>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const appConfig: AppConfig = useInjectable(AppConfig);
  const [appTitle, setAppTitle] = useState<string>();

  useEffect(() => {
    setPosition();
    const disposer = new Disposable();
    disposer.addDispose(
      editorService.onActiveResourceChange((resource) => {
        setCurrentResource(resource);
      }),
    );
    disposer.addDispose(
      new DomListener(window, 'resize', () => {
        setPosition();
      }),
    );
    if (ref.current && ref.current.previousElementSibling) {
      const resizeObserver = new ResizeObserver(setPosition);
      resizeObserver.observe(ref.current.previousElementSibling);
      disposer.addDispose({
        dispose: () => {
          resizeObserver.disconnect();
        },
      });
    }
    return disposer.dispose.bind(disposer);
  }, [currentResource]);

  function setPosition() {
    // 在下一个 animationFrame 执行，此时 spanRef.current!.offsetWidth 的宽度才是正确的
    window.requestAnimationFrame(() => {
      if (ref.current) {
        const windowWidth = window.innerWidth;
        let prevWidth = 0;
        let node = ref.current.previousElementSibling;
        while (node) {
          prevWidth += (node as HTMLElement).offsetWidth;
          node = node.previousElementSibling;
        }
        const left = Math.max(0, windowWidth * 0.5 - prevWidth - spanRef.current!.offsetWidth * 0.5);
        ref.current.style.paddingLeft = left + 'px';
      }
    });
  }

  const dirname = appConfig.workspaceDir ? basename(appConfig.workspaceDir) : undefined;

  // 同时更新 Html Title
  useEffect(() => {
    const titleInfo: TitleInfo = {
      currentResourceName: currentResource?.name,
      workspaceName: dirname,
      appName: replaceLocalizePlaceholder(appConfig.appName),
      remoteMode: appConfig.isRemote,
      extensionDevelopmentHost: appConfig.extensionDevelopmentHost,
    };
    const documentTitle = (transformer && transformer(titleInfo)) || defaultTitleTransformer(titleInfo);

    document.title = documentTitle;
    setAppTitle(documentTitle);
  }, [currentResource?.name]);

  if (hidden) {
    return null;
  }

  return (
    <div className={styles.title_info} ref={ref}>
      <span ref={spanRef}>{appTitle}</span>
    </div>
  );
});
