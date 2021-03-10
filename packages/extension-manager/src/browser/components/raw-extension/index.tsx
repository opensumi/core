import * as React from 'react';
import { localize, IClientApp } from '@ali/ide-core-browser';
import { getIcon } from '@ali/ide-core-browser';
import { Button } from '@ali/ide-components';
import { InlineActionBar } from '@ali/ide-core-browser/lib/components/actions';
import * as clx from 'classnames';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import { generateCtxMenu, ICtxMenuRenderer } from '@ali/ide-core-browser/lib/menu/next';
import * as compareVersions from 'compare-versions';
import { RawExtension, IExtensionManagerService } from '../../../common';
import * as commonStyles from '../../extension-manager.common.module.less';
import * as styles from './index.module.less';

interface RawExtensionProps extends React.HTMLAttributes<HTMLDivElement> {
  extension: RawExtension;
  select: (extension: RawExtension, isDouble: boolean) => void;
  install: (extension: RawExtension) => Promise<void>;
  showExtraAction?: boolean;
}

export const RawExtensionView: React.FC<RawExtensionProps> = observer(({
  extension, select, install, className,
  showExtraAction = true,
}) => {
  const timmer = React.useRef<any>();
  const clickCount = React.useRef(0);

  const clientApp = useInjectable<IClientApp>(IClientApp);
  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const ctxMenuRenderer = useInjectable<ICtxMenuRenderer>(ICtxMenuRenderer);
  const extensionMomentState = extensionManagerService.extensionMomentState.get(extension.extensionId);
  const isUpdating = extensionMomentState?.isUpdating;
  const isInstalling = extensionMomentState?.isInstalling;
  const isDisable = extension.installed && !extension.enable;

  function handleInstall(e) {
    e.stopPropagation();
    install(extension);
  }

  function handleClick(e) {
    clickCount.current++;
    clearTimeout(timmer.current);
    timmer.current = setTimeout(() => {
      if (clickCount.current === 1) {
        select(extension, false);
      } else if (clickCount.current === 2) {
        select(extension, true);
      }
      clickCount.current = 0;
    }, 200);
  }

  const handleCtxMenu = React.useCallback((e: React.MouseEvent<HTMLElement>) => {
    e.preventDefault();
    // 只有已安装才有右键菜单
    if (!extension.installed) {
      return;
    }
    const result = generateCtxMenu({
      menus: extensionManagerService.contextMenu,
      args: [extension],
    });

    ctxMenuRenderer.show({
      anchor: { x: e.clientX, y: e.clientY },
      menuNodes: result[1],
    });
  }, []);

  const canUpdate = React.useMemo(() => {
    // 内置插件不应该升级
    if (extension && extension.isBuiltin) {
      return false;
    }
    return extension && !!extension.newVersion && compareVersions(extension.version, extension.newVersion) === -1;
  }, [extension]);

  return (
    <div className={className} onContextMenu={handleCtxMenu}>
      <div onClick={handleClick} className={clx(styles.wrap, 'kt-extension-raw')}>
        <div className={clx({
          [styles.gray]: isDisable,
        })}>
          <img className={styles.icon} src={extension.icon}></img>
        </div>
        <div className={styles.info_wrap}>
          <div className={styles.info_header}>
            <div className={clx(styles.name_wrapper, {
              [styles.gray]: isDisable,
            })}>
              <div className={styles.name}>{extension.displayName || extension.name}</div>
              {extension.isBuiltin ? (<span className={commonStyles.tag}>{localize('marketplace.extension.builtin')}</span>) : null}
              {extension.isDevelopment ? (<span className={clx(commonStyles.tag, commonStyles.developmentMode)}>{localize('marketplace.extension.development')}</span>) : null}
            </div>
            {showExtraAction && (
              <span style={{ display: 'flex', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
                {extension.reloadRequire && <Button size='small' type='primary' ghost={true} style={{ marginRight: 4 }} onClick={() => clientApp.fireOnReload()}>{localize('marketplace.extension.reloadrequire')}</Button>}
                {canUpdate && <Button size='small' type='primary' ghost={true} style={{ marginRight: 4 }} onClick={() => extensionManagerService.updateExtension(extension, extension.newVersion!)}>{isUpdating ? localize('marketplace.extension.updating') : localize('marketplace.extension.update')}</Button>}
                {extension.installed ? (
                  <InlineActionBar
                    menus={extensionManagerService.contextMenu}
                    context={[extension]} />
                ) : <Button size='small' type='primary' loading={isInstalling} onClick={handleInstall} ghost={true} style={{ flexShrink: 0 }}>{localize('marketplace.extension.install')}</Button>}
            </span>)}
          </div>
          <div className={clx(styles.extension_props, {
            [styles.gray]: isDisable,
          })}>
            <span>{extension.displayGroupName || extension.publisher}</span>
            {extension.downloadCount ? (<span><i className={clx(commonStyles.icon, getIcon('download'))}></i>{extension.downloadCount}</span>) : null}
            <span>v{extension.version}</span>
          </div>
          <div  className={clx(styles.description, 'kt-extension-raw-description', {
            [styles.gray]: isDisable,
          })}>{extension.description}</div>
        </div>
      </div>
    </div>
  );
});
