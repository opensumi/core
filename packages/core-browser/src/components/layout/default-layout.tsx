import * as React from 'react';
import { BoxPanel } from './box-panel';
import { SlotRenderer } from '../../react-providers';
import { SplitPanel } from './split-panel';

export function DefaultLayout() {
  return <BoxPanel direction='top-to-bottom'>
    <SlotRenderer slot='top' />
    <SplitPanel overflow='hidden' id='main-horizontal' flex={1}>
      <SlotRenderer slot='left' defaultSize={310}  minResize={204} minSize={49} />
      <SplitPanel id='main-vertical' minResize={300} flexGrow={1} direction='top-to-bottom'>
        <SlotRenderer flex={2} flexGrow={1} minResize={200} slot='main' />
        <SlotRenderer flex={1} minResize={160} slot='bottom' />
      </SplitPanel>
      <SlotRenderer slot='right' defaultSize={310} minResize={200} minSize={41} />
    </SplitPanel>
    <SlotRenderer slot='statusBar' />
  </BoxPanel>;
}

export function ToolbarActionBasedLayout() {
  return <BoxPanel direction='top-to-bottom'>
    <BoxPanel direction='left-to-right' z-index={2}>
      <SlotRenderer slot='top'/>
      <SlotRenderer slot='action' flex={1} overflow={'initial'} />
    </BoxPanel>
    <SplitPanel overflow='hidden' id='main-horizontal' flex={1}>
      <SlotRenderer slot='left' defaultSize={310}  minResize={204} minSize={49} />
      <SplitPanel id='main-vertical' minResize={300} flexGrow={1} direction='top-to-bottom'>
        <SlotRenderer flex={2} flexGrow={1} minResize={200} slot='main' />
        <SlotRenderer flex={1} minResize={160} slot='bottom' />
      </SplitPanel>
      <SlotRenderer slot='right' defaultSize={310} minResize={200} minSize={41} />
    </SplitPanel>
    <SlotRenderer slot='statusBar' />
  </BoxPanel>;
}
