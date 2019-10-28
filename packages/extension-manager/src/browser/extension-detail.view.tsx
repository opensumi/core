import { ILogger, useInjectable, IClientApp, localize } from '@ali/ide-core-browser';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { Markdown } from '@ali/ide-markdown';
import { observer } from 'mobx-react-lite';
import * as React from 'react';
import { ExtensionDetail, IExtensionManagerService } from '../common';
import * as clx from 'classnames';
import * as styles from './extension-detail.module.less';
import { IDialogService, IMessageService } from '@ali/ide-overlay';
import * as compareVersions from 'compare-versions';
import { getIcon } from '@ali/ide-core-browser/lib/icon';

export const ExtensionDetailView: ReactEditorComponent<null> = observer((props) => {
  const isLocal = props.resource.uri.authority === 'local';
  const { extensionId, version } = props.resource.uri.getParsedQuery();
  const [currentExtension, setCurrentExtension] = React.useState<ExtensionDetail | null>(null);
  const [latestExtension, setLatestExtension] = React.useState<ExtensionDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isInstalling, setIsInstalling] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isUnInstalling, setUnIsInstalling] = React.useState(false);
  const [tabIndex, setTabIndex] = React.useState(0);
  const [reloadRequire, setReloadRequire] = React.useState(false);
  const [updated, setUpdated] = React.useState(false);
  const tabs = [{
    name: 'readme',
    displayName: localize('marketplace.extension.readme', '细节'),
  }, {
    name: 'changelog',
    displayName: localize('marketplace.extension.changelog', '更改日志'),
  }];

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const dialogService = useInjectable<IDialogService>(IDialogService);
  const messageService = useInjectable<IMessageService>(IMessageService);
  const logger = useInjectable<ILogger>(ILogger);
  const clientApp = useInjectable<IClientApp>(IClientApp);
  const delayReload = localize('marketplace.extension.reload.delay');
  const nowReload = localize('marketplace.extension.reload.now');
  const delayUpdate = localize('marketplace.extension.update.delay', '稍后我自己更新');
  const nowUpdate = localize('marketplace.extension.update.now', '是，现在更新');

  if (currentExtension && (!currentExtension.enable || !currentExtension.installed)) {
    updateReloadStateIfNeed(currentExtension);
  }

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const remote = await extensionManagerService.getDetailFromMarketplace(extensionId);
        if (remote) {
          setLatestExtension(remote);
        }

        if (isLocal) {
          const local = await extensionManagerService.getDetailById(extensionId);
          if (local) {
            setCurrentExtension(local);
          }
        } else {
          setCurrentExtension(remote!);
        }
      } catch (err) {
        logger.error(err);
      }
      setIsLoading(false);
    };

    fetchData();
  }, [extensionId]);

  function getContent(name: string, extension: ExtensionDetail) {
    switch (name) {
      case 'readme':
        return <Markdown content={extension.readme}/>;
      case 'changelog':
        return <Markdown content={extension.changelog}/>;
      default:
        return null;
    }
  }

  async function updateReloadStateIfNeed(extension) {
    const reloadRequire = await extensionManagerService.computeReloadState(extension.path);
    if (reloadRequire) {
      setReloadRequire(true);
    }
  }

  async function toggleActive() {
    if (currentExtension) {
      const enable = !currentExtension.enable;
      await extensionManagerService.toggleActiveExtension(currentExtension.extensionId, enable);
      if (!enable) {
        await extensionManagerService.onDisableExtension(currentExtension.path);
      } else {
        await extensionManagerService.onEnableExtension(currentExtension.path);
      }
      setCurrentExtension({
        ...currentExtension,
        enable,
      });
      await updateReloadStateIfNeed(currentExtension);
    }
  }

  async function install() {
    if (currentExtension && !isInstalling) {
      setIsInstalling(true);
      const path = await extensionManagerService.downloadExtension(currentExtension.extensionId);
      setIsInstalling(false);
      setCurrentExtension({
        ...currentExtension,
        path,
        installed: true,
      });
      // 更新插件进程信息
      await extensionManagerService.onInstallExtension(currentExtension.extensionId, path);
      // 标记为已安装
      await extensionManagerService.makeExtensionStatus(true, currentExtension.extensionId, path);
    }
  }

  async function uninstall() {
    if (currentExtension && !isUnInstalling) {
      setUnIsInstalling(true);
      const res = await extensionManagerService.uninstallExtension(currentExtension.path);
      await extensionManagerService.toggleActiveExtension(currentExtension.extensionId, true);

      if (res) {
        setUnIsInstalling(false);
        setCurrentExtension({
          ...currentExtension,
          installed: false,
        });
        await updateReloadStateIfNeed(currentExtension);
        // 标记为未安装
        await extensionManagerService.makeExtensionStatus(false, currentExtension.extensionId, '');
      } else {
        dialogService.info(localize('marketplace.extension.uninstall.failed', '卸载失败'));
      }
    }
  }

  async function update() {
    if (currentExtension && !isUpdating) {
      setIsUpdating(true);
      const oldExtensionPath = currentExtension.path;
      const newExtensionPath = await extensionManagerService.updateExtension(currentExtension.extensionId, latestExtension!.version, currentExtension.path);
      setIsUpdating(false);
      setCurrentExtension({
        ...currentExtension,
        path: newExtensionPath,
        installed: true,
        version: latestExtension!.version,
      });
      await extensionManagerService.onUpdateExtension(newExtensionPath, oldExtensionPath);
      await updateReloadStateIfNeed(currentExtension);
      setUpdated(true);
    }
  }

  const canUpdate = React.useMemo(() => {
    return currentExtension && latestExtension && compareVersions(currentExtension.version, latestExtension!.version);
  }, [currentExtension, latestExtension]);

  React.useEffect(() => {
    if (canUpdate) {
      messageService
      .info(localize('marketplace.extension.findUpdate', `发现插件有最新版本 ${latestExtension!.version}，是否要更新到最新版本？`), [delayUpdate, nowUpdate])
      .then((message) => {
        if (message === nowUpdate) {
          update();
        }
      });
    }
  }, [canUpdate]);
  return (
    <div className={styles.wrap}>
      {currentExtension && (
      <>
        <div className={styles.header}>
          <div>
            <img className={styles.icon} src={currentExtension.icon}></img>
          </div>
          <div className={styles.details}>
            <div className={styles.title}>
              <span className={styles.name}>{currentExtension.displayName}</span>
              <span className={styles.identifier}>{currentExtension.id}</span>
            </div>
            <div className={styles.subtitle}>
              <span className={styles.subtitle_item}>{currentExtension.publisher}</span>
              {currentExtension && currentExtension.downloadCount && currentExtension.downloadCount > 0 ? (
              <span className={styles.subtitle_item}><i className={getIcon('cloud-download')}></i> {currentExtension.downloadCount}</span>
              ) : null}
              {currentExtension.license && (
              <span className={styles.subtitle_item}>
                <a target='_blank' href={currentExtension.license}>{localize('marketplace.extension.license', '许可证')}</a>
              </span>
              )}
            </div>
            <div className={styles.description}>{currentExtension.description}{currentExtension.version}</div>
            <div className={styles.actions}>
              {canUpdate && !updated ? (
                <a className={styles.action} onClick={update}>{isUpdating ? localize('marketplace.extension.reloading', '更新中') : localize('marketplace.extension.reload', '更新')}</a>
              ) : null}
              {!currentExtension.installed ? (
                <a className={styles.action} onClick={install}>{isInstalling ? localize('marketplace.extension.installing', '安装中') : localize('marketplace.extension.install', '安装')}</a>
              ) : null}
              {reloadRequire && <a className={clx(styles.action)} onClick={() => clientApp.fireOnReload()}>{localize('marketplace.extension.reloadrequure', '需要重启')}</a>}
              {isLocal && currentExtension.installed ? (
                <a className={clx(styles.action, {
                  [styles.gray]: currentExtension.enable,
                })} onClick={toggleActive}>{currentExtension.enable ? localize('marketplace.extension.disable', '禁用') : localize('marketplace.extension.enable', '启用')}</a>
              ) : null}
              {currentExtension.installed && !currentExtension.isBuiltin  && (
                <a className={clx(styles.action, styles.gray)} onClick={uninstall}>{isUnInstalling ? localize('marketplace.extension.uninstalling', '卸载中') : localize('marketplace.extension.uninstall', '卸载')}</a>
              )}
            </div>
          </div>
        </div>
        <div className={styles.body}>
          <div className={styles.navbar}>
            <ul className={styles.actions_container}>
              {tabs.map((tab, index) => (
                <li key={tab.name} className={styles.action_item}>
                  <a className={clx(styles.action_label, {
                    [styles.action_label_show]: index === tabIndex,
                  })} onClick={() => setTabIndex(index)}>{tab.displayName}</a>
                </li>
              ))}
            </ul>
          </div>
          <div className={styles.content}>
            {tabs.map((tab, index) => (
              <div key={tab.name} className={clx(styles.content_item, {
                [styles.content_item_show]: index === tabIndex,
              })}>{getContent(tab.name, currentExtension)}</div>
            ))}
          </div>
        </div>
      </>
      )}
    </div>
  );
});
