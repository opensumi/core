import { ILogger, useInjectable, IClientApp, localize, formatLocalize } from '@ali/ide-core-browser';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { Markdown } from '@ali/ide-markdown';
import { observer } from 'mobx-react-lite';
import * as React from 'react';
import { ExtensionDetail, IExtensionManagerService, EnableScope } from '../common';
import * as clx from 'classnames';
import * as styles from './extension-detail.module.less';
import * as commonStyles from './extension-manager.common.module.less';
import { IDialogService, IMessageService } from '@ali/ide-overlay';
import * as compareVersions from 'compare-versions';
import { getIcon } from '@ali/ide-core-browser/lib/icon';
import { Button } from '@ali/ide-core-browser/lib/components';
import { Dropdown, Menu } from 'antd';
import Tabs from 'antd/lib/tabs';
import 'antd/lib/tabs/style/index.less';

const { TabPane } = Tabs;

export const ExtensionDetailView: ReactEditorComponent<null> = observer((props) => {
  const isLocal = props.resource.uri.authority === 'local';
  const { extensionId } = props.resource.uri.getParsedQuery();
  const [currentExtension, setCurrentExtension] = React.useState<ExtensionDetail | null>(null);
  const [latestExtension, setLatestExtension] = React.useState<ExtensionDetail | null>(null);
  const [isInstalling, setIsInstalling] = React.useState(false);
  const [isUpdating, setIsUpdating] = React.useState(false);
  const [isUnInstalling, setUnIsInstalling] = React.useState(false);
  const [updated, setUpdated] = React.useState(false);

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const dialogService = useInjectable<IDialogService>(IDialogService);
  const messageService = useInjectable<IMessageService>(IMessageService);
  const logger = useInjectable<ILogger>(ILogger);
  const clientApp = useInjectable<IClientApp>(IClientApp);
  const delayUpdate = localize('marketplace.extension.update.delay');
  const nowUpdate = localize('marketplace.extension.update.now');
  React.useEffect(() => {
    const fetchData = async () => {
      let remote;
      try {
        // 获取最新的插件信息，用来做更新提示
        remote = await extensionManagerService.getDetailFromMarketplace(extensionId);
        if (remote) {
          setLatestExtension(remote);
        }
      } catch (err) {
        logger.error(err);
      }

      // 打开本地
      if (isLocal) {
        const local = await extensionManagerService.getDetailById(extensionId);
        if (local) {
          setCurrentExtension(local);
        }
      } else if (remote) {
        // 打开远程
        setCurrentExtension(remote);
      }
    };

    fetchData();
  }, [extensionId]);

  /**
   * 禁用/启用工作区间
   * @param scope
   */
  async function toggleActive(scope: EnableScope) {
    if (currentExtension) {
      const enable = !currentExtension.enable;
      await extensionManagerService.toggleActiveExtension(currentExtension, enable, scope);
      const reloadRequire = await extensionManagerService.computeReloadState(currentExtension.path);
      setCurrentExtension({
        ...currentExtension,
        enable,
        enableScope: scope,
        reloadRequire,
      });
    }
  }

  async function install() {
    if (currentExtension && !isInstalling) {
      setIsInstalling(true);
      const path = await extensionManagerService.installExtension(currentExtension);
      setIsInstalling(false);
      setCurrentExtension({
        ...currentExtension,
        path,
        // 默认安装后就启用
        enable: true,
        installed: true,
      });
    }
  }

  async function uninstall() {
    if (currentExtension && !isUnInstalling) {
      setUnIsInstalling(true);
      const res = await extensionManagerService.uninstallExtension(currentExtension);
      const reloadRequire = await extensionManagerService.computeReloadState(currentExtension.path);
      if (res) {
        setUnIsInstalling(false);
        setCurrentExtension({
          ...currentExtension,
          enable: false,
          installed: false,
          reloadRequire,
        });
      } else {
        dialogService.info(localize('marketplace.extension.uninstall.failed'));
      }
    }
  }

  async function update() {
    if (currentExtension && !isUpdating) {
      setIsUpdating(true);
      const oldExtensionPath = currentExtension.path;
      const newExtensionPath = await extensionManagerService.updateExtension(currentExtension, latestExtension!.version);
      setIsUpdating(false);
      setCurrentExtension({
        ...currentExtension,
        path: newExtensionPath,
        installed: true,
        version: latestExtension!.version,
        reloadRequire: await extensionManagerService.computeReloadState(oldExtensionPath),
      });
      await extensionManagerService.onUpdateExtension(newExtensionPath, oldExtensionPath);
      setUpdated(true);
    }
  }

  const canUpdate = React.useMemo(() => {
    // 内置插件不应该升级
    if (currentExtension && currentExtension.isBuiltin) {
      return false;
    }
    return currentExtension && latestExtension && compareVersions(currentExtension.version, latestExtension.version) === -1;
  }, [currentExtension, latestExtension]);

  const downloadCount = React.useMemo(() => {
    return currentExtension && currentExtension.downloadCount
    || latestExtension && latestExtension.downloadCount
    || 0;
  }, [currentExtension, latestExtension]);

  // 是否弹出要更新提示
  React.useEffect(() => {
    if (canUpdate && latestExtension) {
      messageService
      .info(formatLocalize('marketplace.extension.findUpdate', latestExtension.name, latestExtension.version), [delayUpdate, nowUpdate])
      .then((message) => {
        if (message === nowUpdate) {
          update();
        }
      });
    }
  }, [canUpdate, latestExtension]);

  // https://yuque.antfin-inc.com/cloud-ide/za8zpk/kpwylo#RvfMV
  const menu = (
    currentExtension && (<Menu>
      <Menu.Item onClick={() => toggleActive(EnableScope.GLOBAL)} disabled={currentExtension.enableScope === EnableScope.WORKSPACE && currentExtension.enable}>
      {currentExtension.enable ? localize('marketplace.extension.disable') : localize('marketplace.extension.enable')}
      </Menu.Item>
      <Menu.Item onClick={() => toggleActive(EnableScope.WORKSPACE)}>
      {currentExtension.enable ? localize('marketplace.extension.disable.workspace') : localize('marketplace.extension.enable.workspace')}
      </Menu.Item>
    </Menu>)
  );
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
              {currentExtension.isBuiltin ? (<span className={commonStyles.tag}>{localize('marketplace.extension.builtin')}</span>) : null}
              {canUpdate ? (<span className={clx(commonStyles.tag, styles.green)}>{localize('marketplace.extension.canupdate')}</span>) : null}
            </div>
            <div className={styles.subtitle}>
              {downloadCount > 0 ? (
              <span className={styles.subtitle_item}><i className={clx(commonStyles.icon, getIcon('download'))}></i>{downloadCount}</span>
              ) : null}
              <span className={styles.subtitle_item}>{currentExtension.publisher}</span>
              <span className={styles.subtitle_item}>V{currentExtension.version}</span>
            </div>
            <div className={styles.description}>{currentExtension.description}</div>
            <div className={styles.actions}>
              {canUpdate && !updated ? (
                <Button className={styles.action} onClick={update} loading={isUpdating}>{isUpdating ? localize('marketplace.extension.updating') : localize('marketplace.extension.update')}</Button>
              ) : null}
              {!currentExtension.installed ? (
                <Button className={styles.action} onClick={install} loading={isInstalling}>{isInstalling ? localize('marketplace.extension.installing') : localize('marketplace.extension.install')}</Button>
              ) : null}
              {currentExtension.reloadRequire && <Button className={styles.action} onClick={() => clientApp.fireOnReload()}>{localize('marketplace.extension.reloadrequure')}</Button>}
              {currentExtension.installed ? (
                <Dropdown overlay={menu} trigger={['click']}>
                  <Button ghost={true} className={styles.action}>{currentExtension.enable ? localize('marketplace.extension.disable') : localize('marketplace.extension.enable')}</Button>
                </Dropdown>) : null}
              {currentExtension.installed && !currentExtension.isBuiltin  && (
                <Button ghost={true} type='danger' className={styles.action} onClick={uninstall} loading={isUnInstalling}>{isUnInstalling ? localize('marketplace.extension.uninstalling') : localize('marketplace.extension.uninstall')}</Button>
              )}
            </div>
          </div>
        </div>
        <div className={styles.body}>
          <Tabs tabBarStyle={{marginBottom: 0}}>
            <TabPane className={styles.content} tab={localize('marketplace.extension.readme')} key='readme'>
              <Markdown content={currentExtension.readme ? currentExtension.readme : `# ${currentExtension.displayName}\n${currentExtension.description}`}/>
            </TabPane>
            <TabPane tab={localize('marketplace.extension.changelog')} key='changelog'>
              <Markdown content={currentExtension.changelog ? currentExtension.changelog : 'no changelog'}/>
            </TabPane>
          </Tabs>
        </div>
      </>
      )}
    </div>
  );
});
