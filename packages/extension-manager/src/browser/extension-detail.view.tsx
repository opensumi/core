import { ILogger, useInjectable } from '@ali/ide-core-browser';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { Markdown } from '@ali/ide-markdown';
import { observer } from 'mobx-react-lite';
import * as React from 'react';
import { ExtensionDetail, IExtensionManagerService } from '../common';
import * as clx from 'classnames';
import * as styles from './extension-detail.module.less';
import { IDialogService, IMessageService } from '@ali/ide-overlay';
import * as compareVersions from 'compare-versions';

export const ExtensionDetailView: ReactEditorComponent<null> = observer((props) => {
  const isLocal = props.resource.uri.authority === 'local';
  const { id: extensionId, version } = props.resource.uri.getParsedQuery();
  const [extension, setExtension] = React.useState<ExtensionDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isInstalling, setIsInstalling] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isUnInstalling, setUnIsInstalling] = React.useState(false);
  const [tabIndex, setTabIndex] = React.useState(0);
  const tabs = [{
    name: 'readme',
    displayName: 'Details',
  }, {
    name: 'changelog',
    displayName: 'Changelog',
  }];

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const dialogService = useInjectable<IDialogService>(IDialogService);
  const messageService = useInjectable<IMessageService>(IMessageService);
  const logger = useInjectable<ILogger>(ILogger);

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
      await extensionManagerService.toggleActiveExtension(extension.id, enable);
      setExtension({
        ...extension,
        enable,
      });
      const message = await dialogService.info('启用/禁用插件需要重启 IDE，你要现在重启吗？', ['稍后我自己重启', '是，现在重启']);
      if (message === '是，现在重启') {
        location.reload();
      }
    }
  }

  async function install() {
    if (extension && !isInstalling) {
      setIsInstalling(true);
      const path = await extensionManagerService.downloadExtension(extension.id);
      setIsInstalling(false);
      setExtension({
        ...extension,
        path,
        installed: true,
      });
      const message = await dialogService.info('下载插件后需要重启 IDE 才能生效，你要现在重启吗？', ['稍后我自己重启', '是，现在重启']);
      if (message === '是，现在重启') {
        location.reload();
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
        const message = await dialogService.info('删除插件后需要重启 IDE 才能生效，你要现在重启吗？', ['稍后我自己重启', '是，现在重启']);
        if (message === '是，现在重启') {
          location.reload();
        }
      } else {
        dialogService.info('删除失败');
      }

    }
  }

  async function update() {
    if (extension && !isUpdating) {
      setIsUpdating(true);
      await extensionManagerService.updateExtension(extension.id, version, extension.path);

      setIsUpdating(false);
      setExtension({
        ...extension,
        installed: true,
      });
      const message = await dialogService.info('更新插件插件后需要重启 IDE 才能生效，你要现在重启吗？', ['稍后我自己重启', '是，现在重启']);
      if (message === '是，现在重启') {
        location.reload();
      }

    }
  }

  const canUpdate = React.useMemo(() => {
    return version && extension && compareVersions(version, extension.version);
  }, [version, extension]);

  React.useEffect(() => {
    if (canUpdate) {
      messageService
      .info(`发现插件有最新版本 ${version}，是否要更新到最新版本？`, ['稍后我自己更新', '是，现在更新'])
      .then((message) => {
        if (message === '是，现在更新') {
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
              <span className={styles.identifier}>{extension.showId}</span>
            </div>
            <div className={styles.subtitle}>
              <span className={styles.subtitle_item}>{extension.publisher}</span>
              {extension && extension.downloadCount && extension.downloadCount > 0 ? (
              <span className={styles.subtitle_item}><i className='fa fa-cloud-download'></i> {extension.downloadCount}</span>
              ) : null}
              {extension.license && (
              <span className={styles.subtitle_item}>
                <a target='_blank' href={extension.license}>LICENSE</a>
              </span>
              )}
            </div>
            <div className={styles.description}>{extension.description}</div>
            <div className={styles.actions}>
              {canUpdate && (
                <a className={styles.action} onClick={update}>{isUpdating ? '更新中' : `更新`}</a>
              )}
              {!extension.installed && (
                <a className={styles.action} onClick={install}>{isInstalling ? '安装中' : '安装'}</a>
              )}
              {isLocal && extension.installed ? (
                <a className={clx(styles.action, {
                  [styles.gray]: extension.enable,
                })} onClick={toggleActive}>{extension.enable ? '禁用' : '启用'}</a>
              ) : null}
              {extension.installed && !extension.isBuiltin  && (
                <a className={clx(styles.action, styles.gray)} onClick={uninstall}>{isUnInstalling ? '卸载中' : '卸载'}</a>
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
