import { Disposable, Schemes } from '@opensumi/ide-core-common';

export const MockDebugConsoleInputDocumentProvider = {
  handlesScheme: (v) => v === Schemes.walkThroughSnippet,
  provideEditorDocumentModelContent: () => '123',
  isReadonly: false,
  onDidChangeContent: () => Disposable.create(() => {}),
  preferLanguageForUri() {
    return 'plaintext';
  },
};
