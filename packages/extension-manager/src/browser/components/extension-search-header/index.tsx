import * as React from 'react';
import { useInjectable } from '@ali/ide-core-browser';
import Hotkeys from '@ali/ide-core-browser/lib/components/hotkeys';
import { FilterEvent } from 'hotkeys-js';
import * as styles from './index.module.less';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { enableExtensionsTarbarHandlerId, searchExtensionsTarbarHandlerId, enableExtensionsContainerId, IExtensionManagerService } from '../../../common';

export const ExtensionSearchHeader: React.FC<any> = () => {

  const [ query, setQuery ] = React.useState('');
  const mainLayoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const handler = mainLayoutService.getTabbarHandler(enableExtensionsContainerId);

  function handleChange(value) {
    if (value) {

      // handler.toggleViews([searchExtensionsTarbarHandlerId], true);
      // handler.toggleViews([enableExtensionsTarbarHandlerId], false);

      extensionManagerService.search(value);
    } else {
      // handler.toggleViews([searchExtensionsTarbarHandlerId], false);
      // handler.toggleViews([enableExtensionsTarbarHandlerId], true);
    }
    setQuery(value);
  }

  const handleSearch = React.useCallback(() => {
    extensionManagerService.search(query);
  }, [ query ]);

  return (
    <Hotkeys
      keyName='enter'
      filter={(event: FilterEvent) => {
        const target = (event.target as HTMLElement) || event.srcElement;
        const tagName = target.tagName;
        return tagName === 'TEXTAREA';
      }}
      onKeyUp={handleSearch}>
      <div className={styles.input}>
        <input
          placeholder='在应用市场中搜索扩展'
          autoFocus={true}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
        />
      </div>
    </Hotkeys>
  );
};
