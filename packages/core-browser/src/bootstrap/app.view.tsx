import * as React from 'react';
import { ConfigProvider, /*SlotLocation,*/SlotRenderer } from '../react-providers';
import { IClientApp } from '../browser-module';
import {SlotLocation} from '../react-providers/slot';

export interface AppProps {
  app: IClientApp;
  main: React.FunctionComponent;
  overlay?: React.FunctionComponent;
}

export function App(props: AppProps) {
  return (
    <ConfigProvider value={ props.app.config }>
      <SlotRenderer Component={props.main} />
      { props.overlay && <SlotRenderer Component={props.overlay} /> }
    </ConfigProvider>
  );
}
