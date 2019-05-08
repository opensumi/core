import * as React from 'react';
import { ConfigContext } from './config-provider';

export enum RenderNameEnum {
  main = 'core.main',
}

export function SlotRenderer({ name }: { name: string }) {
  const { slotMap } = React.useContext(ConfigContext);

  const Component = slotMap.get(name);
  return Component && <Component /> || null;
}
