import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import TabItem, { ItemType } from './item';
import { TabManager } from './manager';

import * as styles from './index.module.less';

export default observer(() => {
  const manager = useInjectable<TabManager>(TabManager);

  React.useEffect(() => {
    manager.firstInitialize();
  }, []);

  return (
    <div className={ styles.view_container }>
      {
        manager.items.map((item, index) => {
          return (
            <TabItem
              name={ item.name }
              key={ `tab-item-${index}` }
              selected={ manager.state.current === index }
              onClick={ () => manager.select(index) }
              onClose={ (e) => {
                e.stopPropagation();
                manager.remove(index);
              } }
            ></TabItem>
          );
        })
      }
      <TabItem
        type={ ItemType.add }
        onClick={ () => manager.create('default') }
      ></TabItem>
    </div>
  );
});
