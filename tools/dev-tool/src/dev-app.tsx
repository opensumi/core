import * as React from 'react';
import * as ReactDom from 'react-dom';
import { App, SlotLocation, SlotMap, BrowserModule } from '@ali/ide-core-browser';

export function renderApp(main: BrowserModule, modules: BrowserModule[] = []) {
  const { value: component } = main.slotMap.values().next();
  const slotMap: SlotMap = new Map();
  slotMap.set(SlotLocation.main, component);

  ReactDom.render((
    <App
      modules={[ main, ...modules ]}
      slotMap={slotMap}
    />
  ), document.body);
}
