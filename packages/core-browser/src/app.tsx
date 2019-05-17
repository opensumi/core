import * as React from 'react';
import { ConfigProvider, SlotLocation, SlotRenderer } from './react-providers';
import { Injector, Provider, Token } from '@ali/common-di';
import { BrowserModule, SlotMap } from './browser-module';
import { CommandService, CommandRegistry, CommandContribution } from '@ali/ide-core-common';

interface AppProps {
  modules: BrowserModule[];
  slotMap: SlotMap;
}

type Contribution = CommandContribution;

function handlerContribution(injector: Injector, contributionsCls: Set<Token>) {
  const instances: Contribution[] = [];

  for (const cls of contributionsCls) {
    const token = cls;
    instances.push(injector.get(token) as Contribution)
  }
  // 注册 CommandContribution
  const commandRegistry = injector.get(CommandService) as CommandRegistry;
  commandRegistry.onStart(instances);
}

export function App(props: AppProps) {
  const providers: Provider[] = [];
  const slotMap = props.slotMap;
  // Set 去重
  const contributionsCls = new Set<Token>();
  for (const item of props.modules) {
    if (item.providers) {
      providers.push(...item.providers);
    }
    
    if (Array.isArray(item.contributionsCls)) {
      for (const contributionCls of item.contributionsCls) {
        contributionsCls.add(contributionCls);
      }
    }

    for (const [key, value] of item.slotMap.entries()) {
      if (!slotMap.has(key)) {
        slotMap.set(key, value);
      }
    }
  }

  // 直接提供一个对象实例的 Provider
  providers.push({
    token: CommandService,
    useClass: CommandRegistry
  });

  const config = {
    injector: new Injector(providers),
    slotMap: props.slotMap,
  };

  handlerContribution(config.injector, contributionsCls);
  return (
    <ConfigProvider value={ config }>
      <SlotRenderer name={SlotLocation.main} />
    </ConfigProvider>
  );
}
