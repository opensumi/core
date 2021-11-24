import { ConstructorOf } from '@opensumi/ide-core-common';

export class EditorError extends Error {

  type: number;

}

export class EditorTabChangedError extends EditorError {

  static errorCode = 1001;

  type: number = EditorTabChangedError.errorCode;

  constructor() {
    super('editor current tab changed when opening resource');
  }

}

export type EditorErrorType = ConstructorOf<EditorError> & { errorCode: number };

export function isEditorError(e: any, type: EditorErrorType) {
  return e && ((e as EditorError).type === type.errorCode);
}
