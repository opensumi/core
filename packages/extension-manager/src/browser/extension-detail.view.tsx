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
import { getIcon } from '@ali/ide-core-browser';
import { Button } from '@ali/ide-components';
import { Menu } from '@ali/ide-components/lib/menu';
import { Tabs } from '@ali/ide-components';
import { ExtensionList } from './components/extension-list';
import { ExtensionPack } from './components/extension-pack';

const tabMap = [
  {
    key: 'readme',
    label: localize('marketplace.extension.readme'),
  },
  {
    key: 'changelog',
    label: localize('marketplace.extension.changelog'),
  },
  {
    key: 'dependencies',
    label: localize('marketplace.extension.dependencies'),
  },
];

export const ExtensionDetailView: ReactEditorComponent<null> = observer((props) => {
  const isLocal = props.resource.uri.authority === 'local';
  const { extensionId, version } = props.resource.uri.getParsedQuery();
  const [tabIndex, setTabIndex] = React.useState(0);
  const [currentExtension, setCurrentExtension] = React.useState<ExtensionDetail | null>(null);
  const [latestExtension, setLatestExtension] = React.useState<ExtensionDetail | null>(null);
  const [dependencies, setDependencies] = React.useState<ExtensionDetail[]>([]);
  const [extensionPack, setExtensionPack] = React.useState<ExtensionDetail[]>([]);
  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const dialogService = useInjectable<IDialogService>(IDialogService);
  const messageService = useInjectable<IMessageService>(IMessageService);
  const logger = useInjectable<ILogger>(ILogger);
  const clientApp = useInjectable<IClientApp>(IClientApp);
  const delayUpdate = localize('marketplace.extension.update.delay');
  const nowUpdate = localize('marketplace.extension.update.now');
  const rawExtension = extensionManagerService.getRawExtensionById(extensionId);
  const extensionMomentState = extensionManagerService.extensionMomentState.get(extensionId);
  const isInstalling = extensionMomentState?.isInstalling;
  const isUpdating = extensionMomentState?.isUpdating;
  const isUnInstalling = extensionMomentState?.isUnInstalling;

  const extension = rawExtension || currentExtension;
  const installed = rawExtension && rawExtension.installed;

  React.useEffect(() => {
    const fetchData = async () => {
      let remote;
      try {

        if (
          // 当打开处于调试模式中的插件详情页时，不向插件市场请求，避免没有上架的 404
          !(isLocal && (await extensionManagerService.getDetailById(extensionId))?.isDevelopment)
        ) {
          // 获取最新的插件信息，用来做更新提示
          remote = await extensionManagerService.getDetailFromMarketplace(extensionId, isLocal ? '' : version);
          if (remote) {
            setLatestExtension(remote);
          }
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
    if (extension) {
      const enable = !extension.enable;
      await extensionManagerService.toggleActiveExtension(extension, enable, scope);
    }
  }

  async function install() {
    if (extension) {
      await extensionManagerService.installExtension(extension);
    }
  }

  async function uninstall() {
    if (extension) {
      const res = await extensionManagerService.uninstallExtension(extension);
      if (res) {
      } else {
        dialogService.info(localize('marketplace.extension.uninstall.failed'));
      }
    }
  }

  async function update() {
    if (extension) {
      await extensionManagerService.updateExtension(extension, latestExtension!.version);
      setCurrentExtension(latestExtension);
    }
  }

  async function getExtDetail(id: string, version?: string): Promise<ExtensionDetail | void> {
    // 已安装的读本地
    return getInstalledIds().includes(id) ? await extensionManagerService.getDetailById(id) : await extensionManagerService.getDetailFromMarketplace(id, version);
  }

  const getUseEnabledIds = React.useCallback(() => extensionManagerService.useEnabledIds, []);
  const getInstalledIds = React.useCallback(() => extensionManagerService.installedIds, []);

  const canUpdate = React.useMemo(() => {
    // 内置插件不应该升级
    if (extension && extension.isBuiltin) {
      return false;
    }
    return extension && extension.newVersion && compareVersions(extension.version, extension.newVersion) === -1;
  }, [extension]);

  const downloadCount = React.useMemo(() => {
    return currentExtension && currentExtension.downloadCount
      || latestExtension && latestExtension.downloadCount
      || 0;
  }, [currentExtension, latestExtension]);

  // 是否弹出要更新提示
  React.useEffect(() => {
    if (canUpdate && latestExtension) {
      messageService
        .info(formatLocalize('marketplace.extension.findUpdate', latestExtension.displayName || latestExtension.name, latestExtension.version), [delayUpdate, nowUpdate])
        .then((message) => {
          if (message === nowUpdate) {
            update();
          }
        });
    }
  }, [canUpdate, latestExtension]);

  const saveDependencies = React.useCallback(async () => {

    if (!currentExtension) {
      setDependencies([]);
      setExtensionPack([]);
      return;
    }

    const hasPackageJSON = !!currentExtension?.packageJSON;

    // 已安装的插件本地有 package.json 优先从本地读取依赖，未安装的插件从 marketplace 读取依赖
    const rawDependencies = (
      hasPackageJSON
        ? currentExtension?.packageJSON?.extensionDependencies
        : await extensionManagerService.getExtDeps(currentExtension?.extensionId as string, currentExtension?.version)
    ) || [];

    const rawExtensionPack = (
      hasPackageJSON
        ? currentExtension?.packageJSON?.extensionPack
        : await extensionManagerService.getExtensionsInPack(currentExtension?.extensionId, currentExtension?.version)
      );

    const depsResult: ExtensionDetail[] = await Promise.all(rawDependencies?.map((dep) => {
      const { id, version } = extensionManagerService.transformDepsDeclaration(dep);
      return getExtDetail(id, version);
    }) || []);

    const packResult: ExtensionDetail[] = await Promise.all(rawExtensionPack?.map((id) => {
        return getExtDetail(id);
    }) || []);

    setDependencies(depsResult || []);
    setExtensionPack(packResult || []);
  }, [currentExtension]);

  React.useEffect(() => {
    saveDependencies();
  }, [currentExtension, getUseEnabledIds().length, getInstalledIds().length]);

  const tabs = React.useMemo(() => {
    const hasDeps = dependencies.length > 0;

    const filterTabs = hasDeps ? [] : ['dependencies'];

    return tabMap.filter((tab) => !filterTabs.includes(tab.key));
  }, [dependencies]);
  // https://yuque.antfin-inc.com/cloud-ide/za8zpk/kpwylo#RvfMV
  const menu = (
    extension && (<Menu className='kt-menu'>
      <Menu.Item onClick={() => toggleActive(EnableScope.GLOBAL)} disabled={extension.enableScope === EnableScope.WORKSPACE && extension.enable}>
        {extension.enable ? localize('marketplace.extension.disable') : localize('marketplace.extension.enable')}
      </Menu.Item>
      <Menu.Item onClick={() => toggleActive(EnableScope.WORKSPACE)}>
        {extension.enable ? localize('marketplace.extension.disable.workspace') : localize('marketplace.extension.enable.workspace')}
      </Menu.Item>
    </Menu>)
  );
  return (
    <div className={styles.wrap}>
      {extension && (
        <div className={styles.header}>
          <div>
            <img className={styles.icon} src={extension.icon}></img>
          </div>
          <div className={styles.details}>
            <div className={styles.title}>
              <span className={styles.name}>{extension.displayName || extension.name}</span>
              {extension.isBuiltin ? (<span className={commonStyles.tag}>{localize('marketplace.extension.builtin')}</span>) : null}
              {extension.isDevelopment ? (<span className={clx(commonStyles.tag, commonStyles.developmentMode)}>{localize('marketplace.extension.development')}</span>) : null}
              {canUpdate ? (<span className={clx(commonStyles.tag, styles.green)}>{localize('marketplace.extension.canupdate')}</span>) : null}
            </div>
            <div className={styles.subtitle}>
              <span className={styles.subtitle_item}>{extension.displayGroupName || extension.publisher}</span>
              {downloadCount > 0 ? (
                <span className={styles.subtitle_item}><i className={clx(commonStyles.icon, getIcon('download'))}></i>{downloadCount}</span>
              ) : null}
              <span className={styles.subtitle_item}>v{extension.version}</span>
            </div>
            <div className={styles.description}>{extension.description}</div>
            <div className={styles.actions}>
              {extension.reloadRequire && <Button className={styles.action} onClick={() => clientApp.fireOnReload()}>{localize('marketplace.extension.reloadrequire')}</Button>}
              {canUpdate ? (
                <Button className={styles.action} onClick={update} loading={isUpdating}>{isUpdating ? localize('marketplace.extension.updating') : localize('marketplace.extension.update')}</Button>
              ) : null}
              {!installed ? (
                <Button className={styles.action} onClick={install} loading={isInstalling}>{isInstalling ? localize('marketplace.extension.installing') : localize('marketplace.extension.install')}</Button>
              ) : null}
              {installed &&
                <Button menu={menu} type='secondary' more className={styles.action}>{extension.enable ? localize('marketplace.extension.disable') : localize('marketplace.extension.enable')}</Button>}
              {installed && !extension.isDevelopment && !extension.isBuiltin && (
                <Button ghost={true} type='danger' className={styles.action} onClick={uninstall} loading={isUnInstalling}>{isUnInstalling ? localize('marketplace.extension.uninstalling') : localize('marketplace.extension.uninstall')}</Button>
              )}
            </div>
          </div>
        </div>)}
      {currentExtension && (<div className={styles.body}>
        <Tabs
          className={styles.tabs}
          value={tabIndex}
          onChange={(index: number) => setTabIndex(index)}
          tabs={tabs.map((tab) => tab.label)}
        />
        <div className={styles.content}>
          {tabs[tabIndex].key === 'readme' && (
            <>
            { extensionPack.length > 0 && (
              <ExtensionPack
                showExtraAction={false}
                list={extensionPack}
              />
            ) }
            <Markdown content={currentExtension.readme ? currentExtension.readme : `# ${currentExtension.displayName}\n${currentExtension.description}`} />
            </>
          )}
          {tabs[tabIndex].key === 'changelog' && (
            <Markdown content={currentExtension.changelog ? currentExtension.changelog : 'no changelog'} />
          )}
          {tabs[tabIndex].key === 'dependencies' && (
            <ExtensionList
              showExtraAction={false}
              list={dependencies}
              height={500}
            />
          )}
        </div>
      </div>)}
    </div>
  );
});
