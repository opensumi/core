import { ILogger, useInjectable, IClientApp, localize } from '@ali/ide-core-browser';
import { ReactEditorComponent } from '@ali/ide-editor/lib/browser';
import { Markdown } from '@ali/ide-markdown';
import { observer } from 'mobx-react-lite';
import * as React from 'react';
import { ExtensionDetail, IExtensionManagerService, EnableScope } from '../common';
import * as clx from 'classnames';
import * as styles from './extension-detail.module.less';
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
  const [reloadRequire, setReloadRequire] = React.useState(false);
  const [updated, setUpdated] = React.useState(false);

  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const dialogService = useInjectable<IDialogService>(IDialogService);
  const messageService = useInjectable<IMessageService>(IMessageService);
  const logger = useInjectable<ILogger>(ILogger);
  const clientApp = useInjectable<IClientApp>(IClientApp);
  const delayUpdate = localize('marketplace.extension.update.delay', '稍后我自己更新');
  const nowUpdate = localize('marketplace.extension.update.now', '是，现在更新');

  // 判断插件操作是否需要重启
  React.useEffect(() => {
    if (currentExtension && (!currentExtension.enable || !currentExtension.installed)) {
      updateReloadStateIfNeed(currentExtension);
    }
  }, [currentExtension]);

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
   * 检查是否需要强制重启插件
   * @param extension
   */
  async function updateReloadStateIfNeed(extension: ExtensionDetail) {
    const reloadRequire = await extensionManagerService.computeReloadState(extension.path);
    if (reloadRequire) {
      setReloadRequire(true);
    }
  }

  /**
   * 禁用/启用工作区间
   * @param scope
   */
  async function toggleActive(scope: EnableScope) {
    if (currentExtension) {
      const enable = !currentExtension.enable;
      await extensionManagerService.toggleActiveExtension(currentExtension.extensionId, enable, scope);
      if (!enable) {
        await extensionManagerService.onDisableExtension(currentExtension.path);
      } else {
        await extensionManagerService.onEnableExtension(currentExtension.path);
      }
      setCurrentExtension({
        ...currentExtension,
        enable,
        enableScope: scope,
      });
      // await updateReloadStateIfNeed(currentExtension);
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
        // 默认安装后就启用
        enable: true,
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
      const res = await extensionManagerService.uninstallExtension(currentExtension.extensionId, currentExtension.path);
      // TODO 卸载后为什么要设置启用？
      await extensionManagerService.toggleActiveExtension(currentExtension.extensionId, true, EnableScope.GLOBAL);

      if (res) {
        setUnIsInstalling(false);
        setCurrentExtension({
          ...currentExtension,
          enable: false,
          installed: false,
        });
        // await updateReloadStateIfNeed(currentExtension);
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
      // await updateReloadStateIfNeed(currentExtension);
      setUpdated(true);
    }
  }

  const canUpdate = React.useMemo(() => {
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
      .info(localize('marketplace.extension.findUpdate', `发现插件 ${latestExtension.name} 有最新版本 ${latestExtension.version}，是否要更新到最新版本？`), [delayUpdate, nowUpdate])
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
              {currentExtension.isBuiltin ? (<span className={styles.tag}>{localize('marketplace.extension.builtin', '内置')}</span>) : null}
              {canUpdate ? (<span className={clx(styles.tag, styles.green)}>{localize('marketplace.extension.canupdate', '有新版本')}</span>) : null}
            </div>
            <div className={styles.subtitle}>
              {downloadCount > 0 ? (
              <span className={styles.subtitle_item}><i className={clx(styles.icon, getIcon('download'))}></i> {downloadCount}</span>
              ) : null}
              <span className={styles.subtitle_item}>{currentExtension.publisher}</span>
              <span className={styles.subtitle_item}>V{currentExtension.version}</span>
            </div>
            <div className={styles.description}>{currentExtension.description}</div>
            <div className={styles.actions}>
              {canUpdate && !updated ? (
                <Button className={styles.action} onClick={update} loading={isUpdating}>{isUpdating ? localize('marketplace.extension.reloading', '更新中') : localize('marketplace.extension.reload', '更新')}</Button>
              ) : null}
              {!currentExtension.installed ? (
                <Button className={styles.action} onClick={install} loading={isInstalling}>{isInstalling ? localize('marketplace.extension.installing', '安装中') : localize('marketplace.extension.install', '安装')}</Button>
              ) : null}
              {reloadRequire && <Button className={styles.action} onClick={() => clientApp.fireOnReload()}>{localize('marketplace.extension.reloadrequure', '需要重启')}</Button>}
              {currentExtension.installed ? (
                <Dropdown overlay={menu} trigger={['click']}>
                  <Button className={styles.action}>{currentExtension.enable ? localize('marketplace.extension.disable', '禁用') : localize('marketplace.extension.enable', '启用')}</Button>
                </Dropdown>) : null}
              {currentExtension.installed && !currentExtension.isBuiltin  && (
                <Button type='danger' className={styles.action} onClick={uninstall} loading={isUnInstalling}>{isUnInstalling ? localize('marketplace.extension.uninstalling', '卸载中') : localize('marketplace.extension.uninstall', '卸载')}</Button>
              )}
            </div>
          </div>
        </div>
        <div className={styles.body}>
          <Tabs tabBarStyle={{margin: 0}} tabBarGutter={0}>
            <TabPane className={styles.content} tab={localize('marketplace.extension.readme', '简介')} key='readme'>
              <Markdown content={currentExtension.readme}/>
            </TabPane>
            <TabPane tab={localize('marketplace.extension.changelog', '更改日志')} key='changelog'>
              <Markdown content={currentExtension.changelog}/>
            </TabPane>
          </Tabs>
        </div>
      </>
      )}
    </div>
  );
});
