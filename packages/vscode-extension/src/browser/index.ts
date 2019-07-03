import { Provider, Injectable } from '@ali/common-di';
import { BrowserModule, EffectDomain} from '@ali/ide-core-browser';
import { VsodeExtensionContribution } from './contribution';
import {VSCodeExtensionNodeServiceServerPath} from '../common';

@Injectable()
@EffectDomain('@ali/ide-vscode-extension')
export class VscodeExtensionModule extends BrowserModule {
  providers: Provider[] = [
    VsodeExtensionContribution,
  ];
  backServices = [
    {
      servicePath: VSCodeExtensionNodeServiceServerPath,
    },
  ];
}
