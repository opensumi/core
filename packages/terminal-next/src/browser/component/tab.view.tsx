import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import TabItem, { ItemType } from './tab.item';
import { TerminalContextMenuService } from '../terminal.menu';
import { ITerminalGroupViewService } from '../../common';

import * as styles from './tab.module.less';

export default observer(() => {
  const view = useInjectable<ITerminalGroupViewService>(ITerminalGroupViewService);
  const menuService = useInjectable<TerminalContextMenuService>(TerminalContextMenuService);

  return (
    <div className={ styles.view_container }>
      {
        view.groups.map((group, index) => {
          if (!group) {
            return;
          }
          return (
            <TabItem
              key={ group.id }
              id={ group.id }
              editable={ group.editable }
              name={ group.snapshot || 'init...' }
              selected={ view.currentGroup && view.currentGroup.id === group.id }
              onInputBlur={ () => group.edit() }
              onInputEnter={ (id: string, name: string) => group.rename(name) }
              onClick={ () => view.selectGroup(index) }
              onClose={ () => view.removeGroup(index) }
              onContextMenu={ (event) => menuService.onTabContextMenu(event, index) }
            ></TabItem>
          );
        })
      }
      <TabItem
        type={ ItemType.add }
        onClick={ () => {
          const index = view.createGroup();
          const group = view.getGroup(index);
          view.createWidget(group);
          view.selectGroup(index);
        } }
      ></TabItem>
    </div>
  );
});
