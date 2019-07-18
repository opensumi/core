import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule, Domain } from '@ali/ide-core-browser';
import { ToolBarContribution, IToolBarViewService, ToolBarPosition } from '@ali/ide-toolbar';
import { NavigationBar } from './editor.navigation';

@Injectable()
export class NavigationBarModule extends BrowserModule {
  providers: Provider[] = [
    NavigationBarModuleContribution,
  ];
}

@Domain(ToolBarContribution)
export class NavigationBarModuleContribution implements ToolBarContribution {

  registerToolBarElement(registry: IToolBarViewService): void {
    registry.registerToolBarElement({
      type: 'component',
      position: ToolBarPosition.LEFT,
      component: NavigationBar,
    });
  }

}
