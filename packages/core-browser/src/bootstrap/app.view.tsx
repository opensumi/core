import * as React from 'react';
import { ConfigProvider } from '../react-providers';
import { IClientApp } from '../browser-module';
import * as ReactDom from 'react-dom';
import { DefaultLayout } from '../components/layout/default-layout';

export interface AppProps {
  app: IClientApp;
  main: React.FunctionComponent;
  overlays?: React.FunctionComponent[];
}

export function App(props: AppProps) {
  return (
    <ConfigProvider value={ props.app.config }>
      {<props.main />}
      {props.overlays && props.overlays.map((Component, index) => <Component key={index} />)}
    </ConfigProvider>
  );
}

export function renderClientApp(app: IClientApp, dom: HTMLElement) {
  const Layout = app.config.layoutComponent || DefaultLayout;
  const overlayComponents = app.browserModules.filter((module) => module.isOverlay).map((module) => {
    if (!module.component) {
      console.warn('检测到空的overlay模块', module);
      return () => <></>;
    }
    return module.component;
  });

  return new Promise((resolve) => {
    ReactDom.render((
      <App app={app} main={Layout} overlays={overlayComponents} />
    ), dom, async () => {
      resolve();
    });
  });

}
