import * as React from 'react';
import { useState, useCallback } from 'react';
import { observer } from 'mobx-react-lite';
import { localize } from '@ide-framework/ide-core-common';
import { useInjectable } from '@ide-framework/ide-core-browser';
import { Tabs, Input } from '@ide-framework/ide-components';

import { IVSXExtensionService, TabActiveKey, VSXExtension, VSXExtensionServiceToken } from '../common';
import { Extension } from './extension';
import * as styles from './vsx-extension.module.less';

const tabMap = [
  TabActiveKey.MARKETPLACE,
  TabActiveKey.INSTALLED,
];

export const VSXExtensionView = observer(() => {
  const [activeKey, setActiveKey] = useState<TabActiveKey>(TabActiveKey.MARKETPLACE);
  const vsxExtensionService = useInjectable<IVSXExtensionService>(VSXExtensionServiceToken);

  const onChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const keyword = e.target.value;
    vsxExtensionService.search(keyword);
  }, []);

  const onInstall = useCallback((extension: VSXExtension) => {
    return vsxExtensionService.install(extension);
  }, []);

  const onClick = useCallback((extension) => {
    const id = extension?.namespace?.toLowerCase() + '.' + extension?.name?.toLowerCase();
    vsxExtensionService.openExtensionEditor(id);
  }, []);

  return (
    <div className={styles.panel}>
      <Tabs
        mini
        className={styles.tabs}
        value={tabMap.indexOf(activeKey)}
        onChange={(index: number) => {
          const activeKey = tabMap[index];
          if (activeKey) {
            setActiveKey(activeKey);
          }
        }}
        tabs={[localize('marketplace.panel.tab.marketplace'), localize('marketplace.tab.installed')]}
      />
      <div style={{ padding: '8px' }}>
        <Input
          placeholder={localize('marketplace.panel.tab.placeholder.search')}
          value={''}
          onChange={onChange}
        />
      </div>
      <div className={styles.extensions_view}>
        {vsxExtensionService.extensions.map((e) => (
          <Extension onClick={onClick} onInstall={onInstall} key={e.name} extension={e} />
        ))}
      </div>
    </div>
  );
});
