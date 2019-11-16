import * as React from 'react';
import { ConfigProvider } from '../react-providers';
import { IClientApp } from '../browser-module';
import * as ReactDom from 'react-dom';
import {SlotLocation} from '../react-providers/slot';
import { DefaultLayout } from '../components/layout/default-layout';

export interface AppProps {
  app: IClientApp;
  main: React.FunctionComponent;
  overlay?: React.FunctionComponent;
}

export function App(props: AppProps) {
  return (
    <ConfigProvider value={ props.app.config }>
      {<props.main />}
      {props.overlay && <props.overlay />}
    </ConfigProvider>
  );
}

export function renderClientApp(app: IClientApp, dom: HTMLElement) {
  // 默认的第一个 Module 的 Slot 必须是 main
  const firstModule = app.browserModules[0];
  // 默认的第二个Module为overlay（临时方案）
  const secondModule = app.browserModules[1];

  // 支持自定义的Layout视图
  return new Promise((resolve) => {
    ReactDom.render((
      <App app={app} main={DefaultLayout} overlay={secondModule.component as React.FunctionComponent} />
    ), dom , async () => {
      // TODO 先实现加的 Loading，待状态接入后基于 stateService 来管理加载流程
      resolve();
    });
  });

}
