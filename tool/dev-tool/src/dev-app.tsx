import * as React from 'react';
import * as ReactDom from 'react-dom';
import { App, RenderNameEnum, SlotMap, BrowserModule } from '@ali/ide-core-browser';

export function renderApp(main: BrowserModule, modules: BrowserModule[] = []) {
  const { value: component } = main.slotMap.values().next();
  const slotMap: SlotMap = new Map();
  slotMap.set(RenderNameEnum.mainLayout, component);

  ReactDom.render((
    <App
      modules={[ main, ...modules ]}
      slotMap={slotMap}
    />
  ), document.getElementById('main'));
}
