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
  const [extension, setExtension] = React.useState<ExtensionDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isInstalling, setIsInstalling] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isUnInstalling, setUnIsInstalling] = React.useState(false);
  const [tabIndex, setTabIndex] = React.useState(0);
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

  React.useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const extension = isLocal
                    ? await extensionManagerService.getDetailById(extensionId)
                    : await extensionManagerService.getDetailFromMarketplace(extensionId);
        if (extension) {
          setExtension(extension);
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

  async function toggleActive() {
    if (extension) {
      const enable = !extension.enable;
      await extensionManagerService.toggleActiveExtension(extension.extensionId, enable);
      setExtension({
        ...extension,
        enable,
      });
      const message = await dialogService.info(localize('marketplace.extension.enable.message', '启用/禁用插件需要重启 IDE，你要现在重启吗？'), [delayReload, nowReload]);
      if (message === nowReload) {
        clientApp.fireOnReload();
      }
    }
  }

  async function install() {
    if (extension && !isInstalling) {
      setIsInstalling(true);
      const path = await extensionManagerService.downloadExtension(extension.extensionId);
      setIsInstalling(false);
      setExtension({
        ...extension,
        path,
        installed: true,
      });
      const message = await dialogService.info(localize('marketplace.extension.install.message', '下载插件后需要重启 IDE 才能生效，你要现在重启吗？'), [delayReload, nowReload]);
      if (message === nowReload) {
        clientApp.fireOnReload();
      }
    }
  }

  async function uninstall() {
    if (extension && !isUnInstalling) {
      setUnIsInstalling(true);
      const res = await extensionManagerService.uninstallExtension(extension.path);

      if (res) {
        setUnIsInstalling(false);
        setExtension({
          ...extension,
          installed: false,
        });
        const message = await dialogService.info(localize('marketplace.extension.uninstall.message', '卸载插件后需要重启 IDE 才能生效，你要现在重启吗？'), [delayReload, nowReload]);
        if (message === nowReload) {
          clientApp.fireOnReload();
        }
      } else {
        dialogService.info(localize('marketplace.extension.uninstall.failed', '卸载失败'));
      }
    }
  }

  async function update() {
    if (extension && !isUpdating) {
      setIsUpdating(true);
      await extensionManagerService.updateExtension(extension.extensionId, version, extension.path);

      setIsUpdating(false);
      setExtension({
        ...extension,
        installed: true,
      });
      const message = await dialogService.info(localize('marketplace.extension.update.message', '更新插件后需要重启 IDE 才能生效，你要现在重启吗？'), [delayReload, nowReload]);
      if (message === nowReload) {
        clientApp.fireOnReload();
      }

    }
  }

  const canUpdate = React.useMemo(() => {
    return version && extension && compareVersions(version, extension.version);
  }, [version, extension]);

  React.useEffect(() => {
    if (canUpdate) {
      messageService
      .info(localize('marketplace.extension.findUpdate', `发现插件有最新版本 ${version}，是否要更新到最新版本？`), [delayReload, nowReload])
      .then((message) => {
        if (message === nowReload) {
          update();
        }
      });
    }
  }, [canUpdate]);
  return (
    <div className={styles.wrap}>
      {extension && (
      <>
        <div className={styles.header}>
          <div>
            <img className={styles.icon} src={extension.icon}></img>
          </div>
          <div className={styles.details}>
            <div className={styles.title}>
              <span className={styles.name}>{extension.displayName}</span>
              <span className={styles.identifier}>{extension.id}</span>
            </div>
            <div className={styles.subtitle}>
              <span className={styles.subtitle_item}>{extension.publisher}</span>
              {extension && extension.downloadCount && extension.downloadCount > 0 ? (
              <span className={styles.subtitle_item}><i className={getIcon('cloud-download')}></i> {extension.downloadCount}</span>
              ) : null}
              {extension.license && (
              <span className={styles.subtitle_item}>
                <a target='_blank' href={extension.license}>{localize('marketplace.extension.license', '许可证')}</a>
              </span>
              )}
            </div>
            <div className={styles.description}>{extension.description}</div>
            <div className={styles.actions}>
              {canUpdate ? (
                <a className={styles.action} onClick={update}>{isUpdating ? localize('marketplace.extension.reloading', '更新中') : localize('marketplace.extension.reload', '更新中')}</a>
              ) : null}
              {!extension.installed ? (
                <a className={styles.action} onClick={install}>{isInstalling ? localize('marketplace.extension.installing', '安装中') : localize('marketplace.extension.install', '安装')}</a>
              ) : null}
              {isLocal && extension.installed ? (
                <a className={clx(styles.action, {
                  [styles.gray]: extension.enable,
                })} onClick={toggleActive}>{extension.enable ? localize('marketplace.extension.disable', '禁用') : localize('marketplace.extension.enable', '启用')}</a>
              ) : null}
              {extension.installed && !extension.isBuiltin  && (
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
              })}>{getContent(tab.name, extension)}</div>
            ))}
          </div>
        </div>
      </>
      )}
    </div>
  );
});
