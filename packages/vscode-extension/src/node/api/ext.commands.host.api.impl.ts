import * as vscode from 'vscode';
import { IExtHostCommandsRegistry } from '../../common';
import { Disposable } from '../../common/ext-types';

export function createCommandsApiFactory(extHostCommandsRegistry: IExtHostCommandsRegistry) {
  const commands: typeof vscode.commands = {
    registerCommand(id: string, command: <T>(...args: any[]) => T | Promise<T>, thisArgs?: any): Disposable {
      return extHostCommandsRegistry.registerCommand(true, id, command, thisArgs);
    },
    executeCommand<T>(id: string, ...args: any[]): Thenable<T | undefined> {
      return extHostCommandsRegistry.executeCommand<T>(id, ...args);
    },
    getCommands(filterInternal: boolean = false): Thenable<string[]> {
      return extHostCommandsRegistry.getCommands(filterInternal);
    },
    registerTextEditorCommand() {
      throw new Error('Method not implemented.');
    },
  };

  return commands;
}
