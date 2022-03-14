import { isObject } from '@opensumi/ide-core-common';
import type {
  ResourceFileEdit,
  ResourceTextEdit,
} from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/bulkEditService';
import { Uri } from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

export function isResourceFileEdit(thing: any): thing is ResourceFileEdit {
  return isObject(thing) && (Boolean(thing.newResource) || Boolean(thing.oldResource));
}

export function isResourceTextEdit(thing: any): thing is ResourceTextEdit {
  // 重写的原因是因为直接用 monaco 存在 Uri.isUri 情况
  // 我们的 Uri 并未 monaco 的 Uri 的 instance
  return isObject(thing) && Uri.isUri(thing.resource) && isObject(thing.textEdit);
}
