import * as React from 'react';
import { BoxPanel } from '@ali/ide-core-browser/lib/components';
import { SlotRenderer } from '@ali/ide-core-browser/lib/react-providers';

export function DefaultLayout() {
  return <BoxPanel direction='top-to-bottom'>
    <SlotRenderer flex={1} slot='terminal' />
  </BoxPanel>;
}
