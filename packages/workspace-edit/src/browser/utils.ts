import type { WorkspaceTextEdit, WorkspaceFileEdit } from '@ali/monaco-editor-core/esm/vs/editor/common/modes';
import { Uri, isObject } from '@ali/ide-core-common';

export function isWorkspaceFileEdit(thing: any): thing is WorkspaceFileEdit {
  return isObject(thing) && (Boolean(thing.newUri) || Boolean(thing.oldUri));
}

export function isWorkspaceTextEdit(thing: any): thing is WorkspaceTextEdit {
  // 重写的原因是因为直接用 monaco 存在 Uri.isUri 情况
  // 我们的 Uri 并未 monaco 的 Uri 的 instance
  return isObject(thing) && Uri.isUri(thing.resource) && isObject(thing.edit);
}
