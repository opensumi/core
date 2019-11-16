import * as React from 'react';
import { BoxPanel } from './box-panel';
import { SlotRenderer } from '../../react-providers';
import { SplitPanel } from './split-panel';

export function DefaultLayout() {
  return <BoxPanel direction='top-to-bottom'>
    <SlotRenderer slot='top' />
    <SplitPanel flex={1}>
      <SlotRenderer flex={1} slot='left' />
      <SplitPanel flex={3} direction='top-to-bottom'>
        <SlotRenderer flex={2} slot='main' />
        <SlotRenderer flex={1} slot='bottom' />
      </SplitPanel>
      <SlotRenderer flex={1} slot='right' />
    </SplitPanel>
    <SlotRenderer slot='statusBar' />
  </BoxPanel>;
}
