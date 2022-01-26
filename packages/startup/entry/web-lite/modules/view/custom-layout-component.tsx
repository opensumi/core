import React from 'react';
import { SlotRenderer } from '@opensumi/ide-core-browser';
import { BoxPanel, SplitPanel } from '@opensumi/ide-core-browser/lib/components';

// 插槽的划分
export function LayoutComponent() {
  return (
    <BoxPanel direction='top-to-bottom'>
      <SlotRenderer slot='top' />
      <SplitPanel overflow='hidden' id='main-horizontal' flex={1}>
        <SlotRenderer slot='left' defaultSize={310} minResize={204} minSize={49} />
        <SlotRenderer flexGrow={1} minResize={300} slot='main' />
        <SlotRenderer slot='right' defaultSize={310} minResize={204} minSize={49} />
      </SplitPanel>
      <SlotRenderer slot='statusBar' />
    </BoxPanel>
  );
}
