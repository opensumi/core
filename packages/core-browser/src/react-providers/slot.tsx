import * as React from 'react';
import { ConfigContext } from './config-provider';

export enum RenderNameEnum {
  mainLayout = 'core.mainLayout',
  menuBar = 'core.menuBar',
  activatorBar = 'core.activatorBar',
  sideBarMain = 'core.sideBarMain',
  sideBarSub = 'core.sideBarSub',
  editor = 'core.editor',
  panel = 'core.panel',
  statusBar = 'core.statusBar',
  commandBar = 'core.commandBar',

}

export function SlotRenderer({ name }: { name: string }) {
  const { slotMap } = React.useContext(ConfigContext);

  const Component = slotMap.get(name);
  return Component && <Component /> || null;
}
