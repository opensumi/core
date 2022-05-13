import { Disposable, Schemas } from '@opensumi/ide-core-common';

export const MockDebugConsoleInputDocumentProvider = {
  handlesScheme: (v) => v === Schemas.walkThroughSnippet,
  provideEditorDocumentModelContent: () => '123',
  isReadonly: false,
  onDidChangeContent: () => Disposable.create(() => {}),
  preferLanguageForUri() {
    return 'plaintext';
  },
};
