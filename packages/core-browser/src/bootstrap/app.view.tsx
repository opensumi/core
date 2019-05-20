import * as React from 'react';
import { ConfigProvider, SlotLocation, SlotRenderer } from '../react-providers';
import { IRootApp } from '../browser-module';

export interface AppProps {
  app: IRootApp;
}

export function App(props: AppProps) {
  return (
    <ConfigProvider value={ props.app.config }>
      <SlotRenderer name={SlotLocation.main} />
    </ConfigProvider>
  );
}
