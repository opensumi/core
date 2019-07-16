import { IRPCProtocol } from '@ali/ide-connection';
import { IExtensionProcessService, ExtHostAPIIdentifier } from '../../common';
import { ExtHostCommands } from './extHostCommand';
import { ExtHostLanguage } from './extHostLanguage';
import { DocumentSelector, HoverProvider, Disposable } from 'vscode';

export function createApiFactory(
  rpcProtocol: IRPCProtocol,
  extensionService: IExtensionProcessService,
) {
  rpcProtocol.set(ExtHostAPIIdentifier.ExtHostExtensionService, extensionService);
  const extHostCommands = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostCommands, new ExtHostCommands(rpcProtocol));
  const extHostLanguages = rpcProtocol.set(ExtHostAPIIdentifier.ExtHostLanguages, new ExtHostLanguage(rpcProtocol));

  return (extension) => {
    const commands = {
      registerCommand(id: string, command: <T>(...args: any[]) => T | Promise<T>, thisArgs?: any) {
        return extHostCommands.registerCommand(true, id, command, thisArgs);
      },
    };
    const languages = {
      registerHoverProvider(selector: DocumentSelector, provider: HoverProvider): Disposable {
        return extHostLanguages.registerHoverProvider(selector, provider);
      },
    };
    return {
      commands,
      languages,
    };
  };
}
