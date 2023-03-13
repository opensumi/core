import { ITree, ITreeNode } from '@opensumi/ide-components/lib/recycle-tree/types';
import { Event } from '@opensumi/ide-core-common';

export const IDebugConsoleModelService = Symbol('IDebugConsoleModelService');

export interface IDebugConsoleSession extends ITree {
  clear(): void;
  append(value: string): void;
  appendLine(value: string): void;
  onDidChange: Event<void>;
  execute(value: string): Promise<void>;
}

export interface IDebugConsoleModelService {
  debugConsoleSession?: IDebugConsoleSession;
  clear(): void;
  copyAll(): void;
  collapseAll(): void;
  copy(node: ITreeNode): void;
  execute(value: string): Promise<void>;
}
