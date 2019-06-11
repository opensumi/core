import * as React from 'react';
import { Injector } from '@ali/common-di';

export type SlotMap = Map<string | symbol, React.FunctionComponent>;

export const AppConfig = Symbol('AppConfig');
export interface AppConfig {
  workspaceDir: string;
  injector: Injector;
  slotMap: SlotMap;
  terminalHost: string;
}

export const ConfigContext = React.createContext<AppConfig>({
  workspaceDir: '',
  injector: null as any,
  slotMap: null as any,
  terminalHost: '',
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
