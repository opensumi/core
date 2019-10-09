import * as React from 'react';
import { useInjectable, localize } from '@ali/ide-core-browser';
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

  const handleKeyPress = React.useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.keyCode === 13) {
      extensionManagerService.search(query);
    }
  }, [ query ]);

  React.useEffect(() => {
    // 默认要调用一次，不使用layout状态
    handleChange('');
  }, []);

  return (
    <div className={styles.input}>
      <input
        placeholder={localize('marketplace.extension.search.placeholder', '在插件市场中搜索插件')}
        autoFocus={true}
        value={query}
        onKeyPress={handleKeyPress}
        onChange={(e) => handleChange(e.target.value)}
      />
    </div>
  );
};
