import * as React from 'react';
import { SidePanelRegistry } from './side-panel-registry';

export const RegistryContext = React.createContext<SidePanelRegistry>(null as any);

interface RegistryProviderProps {
  value: SidePanelRegistry;
}

export function RegistryProvider(props: React.PropsWithChildren<RegistryProviderProps>) {
  return (
    <RegistryContext.Provider value={ props.value }>
      <RegistryContext.Consumer>
        {(value) => value === props.value ? props.children : null}
      </RegistryContext.Consumer>
    </RegistryContext.Provider>
  );
}
