import * as React from 'react';
import { ConfigProvider, RenderNameEnum, SlotRenderer } from './react-providers';
import { Injector, Provider } from '@ali/common-di';
import { Requester, createRequesterProvider } from '../common';
import { BrowserModule, SlotMap } from './browser-module';

interface AppProps {
  modules: BrowserModule[];
  requester: Requester;
  slotMap: SlotMap;
}

export function App(props: AppProps) {
  const providers: Provider[] = [
    createRequesterProvider(props.requester),
  ];

  for (const item of props.modules) {
    if (item.providers) {
      providers.push(...item.providers);
    }

    for (const [key, value] of item.slotMap.entries()) {
      props.slotMap.set(key, value);
    }
  }

  const config = {
    injector: new Injector(providers),
    slotMap: props.slotMap,
  };

  return (
    <ConfigProvider value={ config }>
      <SlotRenderer name={RenderNameEnum.main} />
    </ConfigProvider>
  );
}
