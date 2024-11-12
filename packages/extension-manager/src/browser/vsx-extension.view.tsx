import debounce from 'lodash/debounce';
import * as React from 'react';
import { useCallback, useState } from 'react';

import { Tabs } from '@opensumi/ide-components';
import { useAutorun, useInjectable } from '@opensumi/ide-core-browser';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';
import { localize } from '@opensumi/ide-core-common';
import { AutoFocusedInput } from '@opensumi/ide-main-layout/lib/browser/input';

import { IVSXExtensionService, InstallState, TabActiveKey, VSXExtension, VSXExtensionServiceToken } from '../common';

import { OPEN_VSX_EXTENSION_MANAGER_CONTAINER_ID } from './const';
import { Extension, ExtensionViewType } from './extension';
import styles from './vsx-extension.module.less';

const tabMap = [TabActiveKey.MARKETPLACE, TabActiveKey.INSTALLED];

export const VSXExtensionView = () => {
  const [activeKey, setActiveKey] = useState<TabActiveKey>(TabActiveKey.MARKETPLACE);
  const [loading, setLoading] = useState<boolean>(false);

  const vsxExtensionService = useInjectable<IVSXExtensionService>(VSXExtensionServiceToken);
  const extensions = useAutorun(vsxExtensionService.extensionsObservable);
  const installedExtensions = useAutorun(vsxExtensionService.installedExtensionsObservable);
  const openVSXRegistry = useAutorun(vsxExtensionService.openVSXRegistryObservable);

  const onChange = debounce((keyword: string) => {
    setLoading(true);
    let asPromise;
    if (activeKey === TabActiveKey.MARKETPLACE) {
      asPromise = vsxExtensionService.search(keyword);
    } else {
      asPromise = vsxExtensionService.searchInstalledExtensions(keyword);
    }
    if (typeof asPromise === 'object' && asPromise.then) {
      asPromise.then(() => {
        setLoading(false);
      });
    }
  }, 500);

  const onInstall = useCallback((extension: VSXExtension) => vsxExtensionService.install(extension), []);

  const onClick = useCallback((extension: VSXExtension, state: InstallState) => {
    const id = vsxExtensionService.getExtensionId(extension);
    vsxExtensionService.openExtensionEditor(id, state);
  }, []);

  const onChangeActiveKey = useCallback((index: number) => {
    const activeKey = tabMap[index];
    if (activeKey) {
      setActiveKey(activeKey);
    }
  }, []);

  return (
    <div className={styles.panel}>
      <Tabs
        mini
        className={styles.tabs}
        value={tabMap.indexOf(activeKey)}
        onChange={onChangeActiveKey}
        tabs={[localize('marketplace.panel.tab.marketplace'), localize('marketplace.tab.installed')]}
      />
      <div style={{ padding: '8px' }}>
        <AutoFocusedInput
          containerId={OPEN_VSX_EXTENSION_MANAGER_CONTAINER_ID}
          placeholder={localize('marketplace.panel.tab.placeholder.search')}
          value={''}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
      {activeKey === TabActiveKey.MARKETPLACE && (
        <div className={styles.extensions_view}>
          <Progress loading={loading} />
          {extensions.map((e: VSXExtension, index: number) => (
            <Extension
              key={`${index}:${e.namespace}-${e.name}`}
              onClick={onClick}
              onInstall={onInstall}
              extension={e}
              type={ExtensionViewType.MARKETPLACE}
              installedExtensions={installedExtensions}
              openVSXRegistry={openVSXRegistry}
            />
          ))}
        </div>
      )}
      {activeKey === TabActiveKey.INSTALLED && (
        <div className={styles.extensions_view}>
          {installedExtensions.map((e: VSXExtension, index: number) => (
            <Extension
              key={`${index}:${e.namespace}-${e.name}`}
              onClick={onClick}
              onInstall={onInstall}
              extension={e}
              type={ExtensionViewType.INSTALLED}
              openVSXRegistry={openVSXRegistry}
            />
          ))}
        </div>
      )}
    </div>
  );
};
