/**
 * 前端提供一套 Slot 的注册和渲染的机制
 */

import * as React from 'react';
import { ConfigContext } from './config-provider';

export type SlotLocation = symbol | string;
export const SlotLocation = {
  main: Symbol('main'),
};

export function SlotRenderer({ name }: { name: SlotLocation }) {
  const { slotMap } = React.useContext(ConfigContext);

  const Component = slotMap.get(name);
  console.log('name', name, 'Component', Component);
  return Component && <Component /> || null;
}
