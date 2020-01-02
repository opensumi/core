import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import TabItem, { ItemType } from './item';
import { TabManager } from './manager';
import { TerminalContextMenuService } from '../../terminal.menu';
import { ITerminalController } from '../../../common';

import * as styles from './index.module.less';

export default observer(() => {
  const manager = useInjectable<TabManager>(TabManager);
  const controller = useInjectable<ITerminalController>(ITerminalController);
  const menuService = useInjectable<TerminalContextMenuService>(TerminalContextMenuService);

  return (
    <div className={ styles.view_container }>
      {
        manager.items.map((item, index) => {
          const group = controller.groups[index];
          return (
            <TabItem
              id={ group && group.id }
              editable={ manager.editable.has(group && group.id) }
              name={ (item.name || (group && group.snapshot)) || 'init...' }
              key={ `tab-item-${index}` }
              selected={ manager.state.current === index }
              onInputBlur={ (id: string) => manager.delEditable(id) }
              onInputEnter = { (id: string, name: string) => manager.rename(id, index, name) }
              onClick={ () => manager.select(index) }
              onClose={ () => manager.remove(index) }
              onContextMenu={ (event) => menuService.onTabContextMenu(event, index) }
            ></TabItem>
          );
        })
      }
      <TabItem
        type={ ItemType.add }
        onClick={ () => manager.create() }
      ></TabItem>
    </div>
  );
});
