import * as React from 'react';
import { BoxPanel } from './box-panel';
import { SlotRenderer } from '../../react-providers';
import { SplitPanel } from './split-panel';

export function DefaultLayout() {
  return <BoxPanel direction='top-to-bottom'>
    <SlotRenderer size={54} slot='top' />
    <SplitPanel flex={1}>
      <SlotRenderer flex={4} slot='main' />
      <SlotRenderer flex={1} slot='right' />
    </SplitPanel>
    <SlotRenderer size={28} slot='statusBar' />
  </BoxPanel>;
}
