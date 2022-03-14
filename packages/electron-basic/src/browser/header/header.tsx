import cls from 'classnames';
import { observer } from 'mobx-react-lite';
import React, { useState, useEffect, useRef } from 'react';


import {
  useInjectable,
  MaybeNull,
  ComponentRenderer,
  ComponentRegistry,
  Disposable,
  DomListener,
  AppConfig,
  replaceLocalizePlaceholder,
  electronEnv,
  isOSX,
  IWindowService,
} from '@opensumi/ide-core-browser';
import { getIcon } from '@opensumi/ide-core-browser';
import { localize } from '@opensumi/ide-core-common';
import { IElectronMainUIService } from '@opensumi/ide-core-common/lib/electron';
import { basename } from '@opensumi/ide-core-common/lib/utils/paths';
import { WorkbenchEditorService, IResource } from '@opensumi/ide-editor';

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
const isNewMacHeaderBar = () => isOSX && parseFloat(electronEnv.osRelease) >= 20;

/**
 * autoHide: Hide the HeaderBar when the macOS full screen
 */
export const ElectronHeaderBar = observer(
  ({ Icon, autoHide = true }: React.PropsWithChildren<{ Icon?: React.FunctionComponent; autoHide?: boolean }>) => {
    const windowService: IWindowService = useInjectable(IWindowService);
    const componentRegistry: ComponentRegistry = useInjectable(ComponentRegistry);

    const { isFullScreen } = useFullScreen();
    const { maximized, getMaximized } = useMaximize();

    const LeftComponent = () => {
      if (isOSX) {
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

    const RightComponent = () => {
      if (isOSX) {
        return null;
      }

      return (
        <div className={styles.windowActions}>
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

    // in Mac, hide the header bar if it is in full screen mode
    if (isOSX && isFullScreen && autoHide) {
      return (
        <div>
          <TitleInfo hidden={true} />
        </div>
      );
    }

    return (
      <div
        className={cls(styles.header, isNewMacHeaderBar() ? styles.macNewHeader : null)}
        onDoubleClick={async () => {
          if (await getMaximized()) {
            windowService.unmaximize();
          } else {
            windowService.maximize();
          }
        }}
      >
        <LeftComponent />
        <TitleInfo />
        <RightComponent />
      </div>
    );
  },
);

declare const ResizeObserver: any;

export const TitleInfo = observer(({ hidden }: { hidden?: boolean }) => {
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

  const title =
    (currentResource ? currentResource.name + ' — ' : '') +
    (dirname ? dirname + ' — ' : '') +
    replaceLocalizePlaceholder(appConfig.appName) +
    (appConfig.isRemote ? ` [${localize('common.remoteMode')}]` : '');

  // 同时更新 Html Title
  useEffect(() => {
    let documentTitle = title;
    if (appConfig.extensionDevelopmentHost) {
      documentTitle = `[${localize('workspace.development.title')}] ${title}`;
    }
    document.title = documentTitle;
    setAppTitle(documentTitle);
  }, [title]);

  if (hidden) {
    return null;
  }

  return (
    <div className={styles.title_info} ref={ref}>
      <span ref={spanRef}>{appTitle}</span>
    </div>
  );
});
