import * as React from 'react';
import { useInjectable, localize } from '@ali/ide-core-browser';
import Hotkeys from '@ali/ide-core-browser/lib/components/hotkeys';
import { FilterEvent } from 'hotkeys-js';
import * as styles from './index.module.less';
import { IMainLayoutService } from '@ali/ide-main-layout';
import { enableExtensionsTarbarHandlerId, disableExtensionsTarbarHandlerId, searchExtensionsTarbarHandlerId, enableExtensionsContainerId, IExtensionManagerService } from '../../../common';

export const ExtensionSearchHeader: React.FC<any> = () => {

  const [ query, setQuery ] = React.useState('');
  const mainLayoutService = useInjectable<IMainLayoutService>(IMainLayoutService);
  const extensionManagerService = useInjectable<IExtensionManagerService>(IExtensionManagerService);
  const handler = mainLayoutService.getTabbarHandler(enableExtensionsContainerId);

  function handleChange(value) {
    if (value) {

      handler.toggleViews([searchExtensionsTarbarHandlerId], true);
      handler.toggleViews([enableExtensionsTarbarHandlerId, disableExtensionsTarbarHandlerId], false);

      extensionManagerService.search(value);
    } else {
      handler.toggleViews([searchExtensionsTarbarHandlerId], false);
      handler.toggleViews([enableExtensionsTarbarHandlerId, disableExtensionsTarbarHandlerId], true);
    }
    setQuery(value);
  }

  const handleSearch = React.useCallback(() => {
    extensionManagerService.search(query);
  }, [ query ]);

  React.useEffect(() => {
    // 默认要调用一次，不使用layout状态
    handleChange('');
  }, []);

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
          placeholder={localize('searchExtensions', '在插件市场中搜索插件')}
          autoFocus={true}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
        />
      </div>
    </Hotkeys>
  );
};
