import * as React from 'react';
import { observer } from 'mobx-react-lite';
import { useInjectable } from '@ali/ide-core-browser';
import { ITerminalGroupViewService } from '../../common';
import TabItem, { ItemType } from './tab.item';
import { TerminalContextMenuService } from '../terminal.context-menu';
import { TerminalRenderProvider } from '../terminal.render';

import * as styles from './tab.module.less';

export default observer(() => {
  const view = useInjectable<ITerminalGroupViewService>(ITerminalGroupViewService);
  const menuService = useInjectable<TerminalContextMenuService>(TerminalContextMenuService);
  const provider = useInjectable<TerminalRenderProvider>(TerminalRenderProvider);

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
              onInputBlur={ () => group.unedit() }
              onInputEnter={ (_: string, name: string) => group.rename(name) }
              onClick={ () => view.selectGroup(index) }
              onClose={ () => view.removeGroup(index) }
              onContextMenu={ (event) => menuService.onTabContextMenu(event, index) }
              provider={ provider }
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
        provider={ provider }
      ></TabItem>
    </div>
  );
});
