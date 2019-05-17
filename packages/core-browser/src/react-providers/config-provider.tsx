import * as React from 'react';
import { Injector } from '@ali/common-di';
import { SlotMap } from '../browser-module';

interface InitConfig {
  injector: Injector;
  slotMap: SlotMap;
}

export const ConfigContext = React.createContext<InitConfig>({
  injector: null as any,
  slotMap: null as any,
});

export function ConfigProvider(props: React.PropsWithChildren<{ value: InitConfig }>) {
  return (
    <ConfigContext.Provider value={ props.value }>
      <ConfigContext.Consumer>
        { (value) => props.value === value ? props.children : null }
      </ConfigContext.Consumer>
    </ConfigContext.Provider>
  );
}
