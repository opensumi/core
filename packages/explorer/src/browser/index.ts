import * as React from 'react';
import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule} from '@ali/ide-core-browser';
import { Explorer } from './explorer.view';
import { ExplorerContribution } from './explorer-contribution';

@Injectable()
export class ExplorerModule extends BrowserModule {
  providers: Provider[] = [
    ExplorerContribution,
  ];

  component = Explorer;

  iconClass = 'volans_icon code_editor';

}
