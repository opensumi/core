import * as React from 'react';
import * as ReactDom from 'react-dom';
import { App, AppProps, SlotLocation, SlotMap, BrowserModule } from '@ali/ide-core-browser';

export function renderApp(
  main: BrowserModule, 
  modules: BrowserModule[] = [], 
  props: Partial<AppProps> = {}
) {
  const { value: component } = main.slotMap.values().next();
  const slotMap: SlotMap = props.slotMap || new Map();
  slotMap.set(SlotLocation.main, component);

  ReactDom.render((
    <App
     { ...props }
      modules={[ main, ...modules ]}
      slotMap={slotMap}
    />
  ), document.getElementById('main'));
}
