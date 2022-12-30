import debounce from 'lodash/debounce';
import { observer } from 'mobx-react-lite';
import * as React from 'react';
import { useState, useCallback } from 'react';

import { Tabs } from '@opensumi/ide-components';
import { useInjectable } from '@opensumi/ide-core-browser';
import { Progress } from '@opensumi/ide-core-browser/lib/progress/progress-bar';
import { localize } from '@opensumi/ide-core-common';
import { AutoFocusedInput } from '@opensumi/ide-main-layout/lib/browser/input';

import { IVSXExtensionService, TabActiveKey, VSXExtension, VSXExtensionServiceToken, InstallState } from '../common';

import { OPEN_VSX_EXTENSION_MANAGER_CONTAINER_ID } from './const';
import { Extension, ExtensionViewType } from './extension';
import styles from './vsx-extension.module.less';

const tabMap = [TabActiveKey.MARKETPLACE, TabActiveKey.INSTALLED];

export const VSXExtensionView = observer(() => {
  const [activeKey, setActiveKey] = useState<TabActiveKey>(TabActiveKey.MARKETPLACE);
  const [loading, setLoading] = useState<boolean>(false);
  const vsxExtensionService = useInjectable<IVSXExtensionService>(VSXExtensionServiceToken);

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
          {vsxExtensionService.extensions.map((e) => (
            <Extension
              onClick={onClick}
              onInstall={onInstall}
              key={`${e.namespace}-${e.name}`}
              extension={e}
              type={ExtensionViewType.MARKETPLACE}
              installedExtensions={vsxExtensionService.installedExtensions}
              openVSXRegistry={vsxExtensionService.openVSXRegistry}
            />
          ))}
        </div>
      )}
      {activeKey === TabActiveKey.INSTALLED && (
        <div className={styles.extensions_view}>
          {vsxExtensionService.installedExtensions.map((e) => (
            <Extension
              onClick={onClick}
              onInstall={onInstall}
              key={`${e.namespace}-${e.name}`}
              extension={e}
              type={ExtensionViewType.INSTALLED}
              openVSXRegistry={vsxExtensionService.openVSXRegistry}
            />
          ))}
        </div>
      )}
    </div>
  );
});
