import * as React from 'react';
import { ConfigProvider, RenderNameEnum, SlotRenderer } from './react-providers';
import { Injector, Provider } from '@ali/common-di';
import { BrowserModule, SlotMap } from './browser-module';

interface AppProps {
  modules: BrowserModule[];
  slotMap: SlotMap;
}

export function App(props: AppProps) {
  const providers: Provider[] = [];
  const slotMap = props.slotMap;

  for (const item of props.modules) {
    if (item.providers) {
      providers.push(...item.providers);
    }

    for (const [key, value] of item.slotMap.entries()) {
      if (!slotMap.has(key)) {
        slotMap.set(key, value);
      }
    }
  }

  const config = {
    injector: new Injector(providers),
    slotMap: props.slotMap,
  };

  return (
    <ConfigProvider value={ config }>
      <SlotRenderer name={RenderNameEnum.mainLayout} />
    </ConfigProvider>
  );
}
