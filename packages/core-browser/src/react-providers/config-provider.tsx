import * as React from 'react';
import { Injector } from '@ali/common-di';
import { LayoutConfig } from '../bootstrap';

export const AppConfig = Symbol('AppConfig');
export interface AppConfig {
  workspaceDir: string;
  coreExtensionDir?: string;
  injector: Injector;
  wsPath: string;
  layoutConfig: LayoutConfig;
}

export const ConfigContext = React.createContext<AppConfig>({
  workspaceDir: '',
  injector: null as any,
  wsPath: '',
  layoutConfig: {},
});

export function ConfigProvider(props: React.PropsWithChildren<{ value: AppConfig }>) {
  return (
    <ConfigContext.Provider value={ props.value }>
      <ConfigContext.Consumer>
        { (value) => props.value === value ? props.children : null }
      </ConfigContext.Consumer>
    </ConfigContext.Provider>
  );
}
