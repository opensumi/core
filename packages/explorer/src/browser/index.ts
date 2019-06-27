import * as React from 'react';
import { Provider } from '@ali/common-di';
import { BrowserModule, EffectDomain} from '@ali/ide-core-browser';
import { Explorer } from './explorer.view';

const pkgName = require('../../package.json').name;
@EffectDomain(pkgName)
export class ExplorerModule extends BrowserModule {
  providers: Provider[] = [];

  component = Explorer;

  iconClass = 'volans_icon code_editor';

}
