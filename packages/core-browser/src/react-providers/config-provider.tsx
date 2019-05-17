import * as React from 'react';
import { Injector } from '@ali/common-di';

export type SlotMap = Map<string | symbol, React.FunctionComponent>;

export interface AppConfig {
  injector: Injector;
  slotMap: SlotMap;
}

export const ConfigContext = React.createContext<AppConfig>({
  injector: null as any,
  slotMap: null as any,
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
