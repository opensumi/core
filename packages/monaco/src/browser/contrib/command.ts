import { Command } from '@ali/ide-core-common';
import { ICommandService } from '@ali/monaco-editor-core/esm/vs/platform/commands/common/commands';
import { ICodeEditor } from '../monaco-api/types';

export type { ICommandEvent, ICommandService, ICommandRegistry } from '@ali/monaco-editor-core/esm/vs/platform/commands/common/commands';
export { CommandsRegistry } from '@ali/monaco-editor-core/esm/vs/platform/commands/common/commands';
export { EditorExtensionsRegistry } from '@ali/monaco-editor-core/esm/vs/editor/browser/editorExtensions';

export const ICommandServiceToken = Symbol('ICommandService');

export interface IMonacoCommandService extends ICommandService {
  setDelegate(delegate: ICommandService): void;
}

/**
 * monaco 处理函数
 */
export interface MonacoEditorCommandHandler {
  execute(editor: ICodeEditor, ...args: any[]): any;
  isEnabled?(editor: ICodeEditor, ...args: any[]): boolean;
}

export const IMonacoCommandsRegistry = Symbol('IMonacoCommandsRegistry');

export interface IMonacoCommandsRegistry {
  validate(command: string): string | undefined;
  registerCommand(command: Command, handler: MonacoEditorCommandHandler): void;
}

export const IMonacoActionRegistry = Symbol('IMonacoActionRegistry');

export interface IMonacoActionRegistry {
  registerMonacoActions(): void;
}
