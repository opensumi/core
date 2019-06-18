import {
  URI,
  ConstructorOf,
  RawContextKey,
  ContextKeyExpr,
  InputFocusedContextKey,
} from '@ali/ide-core-browser';

// 用于资源管理器及编辑器界面使用的ContextKeys
// 对照 https://code.visualstudio.com/docs/getstarted/keybindings#_when-clause-contexts
export const FilesExplorerFocusedContext = new RawContextKey<boolean>('filesExplorerFocus', true);
