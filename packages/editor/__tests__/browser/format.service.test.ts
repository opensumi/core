import { PreferenceService } from '@opensumi/ide-core-browser';
import { ILogger, URI } from '@opensumi/ide-core-common';
import { IEditorDocumentModelService, WorkbenchEditorService } from '@opensumi/ide-editor/lib/browser';
import { DocumentFormatService } from '@opensumi/ide-editor/lib/browser/format/format.service';
import { languageFeaturesService } from '@opensumi/ide-monaco/lib/browser/monaco-api/languages';
import { IMessageService } from '@opensumi/ide-overlay';
import { QuickPickService } from '@opensumi/ide-quick-open/lib/common';
import { FormattingEdit } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/format/browser/formattingEdit';

import { MockInjector } from '../../../../tools/dev-tool/src/mock-injector';
import { FormattingSelector } from '../../src/browser/format/formatter-selector';

describe('FormatService', () => {
  const injector = new MockInjector();
  const executeEdit = jest.spyOn(FormattingEdit, 'execute');
  const mockEditor = {
    hasModel: () => true,
    pushUndoStop: jest.fn(),
    getModel: () => ({
      validateRange: () => true,
      getFullModelRange: () => ({
        startLineNumber: 0,
        startColumn: 10,
        endLineNumber: 10,
        endColumn: 10,
        equalsRange: () => true,
      }),
      getLineMaxColumn: () => 10,
      uri: new URI('file:///test/test.format.js').codeUri,
      getLanguageIdentifier: () => 'javascript',
      getLanguageId: () => 'javascript',
      getFormattingOptions: () => ({}),
    }),
    getSelection: () => ({
      isEmpty: () => false,
      startLineNumber: 0,
      startColumn: 10,
      endLineNumber: 10,
      endColumn: 10,
    }),
    executeEdits: jest.fn(),
  };

  const edits = [
    {
      range: {
        startLineNumber: 0,
        startColumn: 10,
        endLineNumber: 10,
        endColumn: 10,
      },
      text: '\r\n Hello World',
    },
  ];

  const provider = {
    provideDocumentFormattingEdits: () => Promise.resolve(edits),
    provideDocumentRangeFormattingEdits: () => Promise.resolve(edits),
  };

  const spyOnProvideDocumentFormattingEdits = jest.spyOn(provider, 'provideDocumentFormattingEdits');
  const spyOnProvideDocumentRangeFormattingEdits = jest.spyOn(provider, 'provideDocumentRangeFormattingEdits');

  const originalOrdered = languageFeaturesService.documentRangeFormattingEditProvider.ordered;

  beforeAll(() => {
    injector.mockService(IMessageService);
    injector.addProviders(
      {
        token: FormattingSelector,
        useValue: {
          pickFormatter() {
            return Promise.resolve(provider);
          },
        },
      },
      {
        token: QuickPickService,
        useValue: {
          show: (strings: any[]) => strings[0].value,
        },
      },
      {
        token: PreferenceService,
        useValue: {
          onPreferenceChanged: jest.fn(),
          get: jest.fn(() => true),
          set: jest.fn(() => true),
        },
      },
      {
        token: IEditorDocumentModelService,
        useValue: {
          getModelReference: () => ({
            instance: {
              languageId: 'javascript',
            },
            dispose: jest.fn(),
          }),
        },
      },
      {
        token: WorkbenchEditorService,
        override: true,
        useValue: {
          currentEditor: {
            monacoEditor: mockEditor,
          },
        },
      },
      {
        token: ILogger,
        useValue: {
          error: jest.fn(),
        },
      },
    );
    languageFeaturesService.documentRangeFormattingEditProvider.ordered = () => [provider];
  });
  afterAll(async () => {
    await injector.disposeAll();
    languageFeaturesService.documentRangeFormattingEditProvider.ordered = originalOrdered;
  });

  it('Format Document With...', async () => {
    const formatService = injector.get(DocumentFormatService);
    await formatService.formatDocumentWith();
    expect(executeEdit).toHaveBeenCalled();
    expect(executeEdit).toHaveBeenCalledWith(mockEditor, edits, true);
    expect(spyOnProvideDocumentFormattingEdits).toHaveBeenCalled();
  });

  it('Format Selection With...', async () => {
    const formatService = injector.get(DocumentFormatService);
    await formatService.formatSelectionWith();
    expect(executeEdit).toHaveBeenCalled();
    expect(executeEdit).toHaveBeenCalledWith(mockEditor, edits, true);
    expect(spyOnProvideDocumentRangeFormattingEdits).toHaveBeenCalled();
  });
});
