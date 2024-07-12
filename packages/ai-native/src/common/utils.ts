import { IEditorDocumentModel } from '@opensumi/ide-editor';

export const isDocumentTooLarge = (document: IEditorDocumentModel) => {
  try {
    document.getText();
  } catch (e) {
    if (e instanceof RangeError) {
      return true;
    }
  }
  return false;
};

const MIN_PROMPT_CHARS = 10;

export const isDocumentTooShort = (document: IEditorDocumentModel) => document.getText().length < MIN_PROMPT_CHARS;

export const isDocumentValid = (document: IEditorDocumentModel) => {
  if (isDocumentTooLarge(document) || isDocumentTooShort(document)) {
    return false;
  }
  return true;
};
