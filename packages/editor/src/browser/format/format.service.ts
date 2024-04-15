import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { CancellationToken, ILogger } from '@opensumi/ide-core-common';
import { languageFeaturesService } from '@opensumi/ide-monaco/lib/browser/monaco-api/languages';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import {
  DocumentFormattingEditProvider,
  DocumentRangeFormattingEditProvider,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';
import { getRealAndSyntheticDocumentFormattersOrdered } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/format/browser/format';
import { FormattingEdit } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/format/browser/formattingEdit';

import { WorkbenchEditorService } from '../types';
import { WorkbenchEditorServiceImpl } from '../workbench-editor.service';

import { FormattingSelector } from './formatter-selector';

@Injectable()
export class DocumentFormatService {
  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  async formatDocumentWith() {
    const monacoEditor = this.workbenchEditorService.currentEditor?.monacoEditor;
    if (!monacoEditor) {
      return;
    }
    const model = monacoEditor.getModel();
    if (model) {
      const formatterProviders = getRealAndSyntheticDocumentFormattersOrdered(
        languageFeaturesService.documentFormattingEditProvider,
        languageFeaturesService.documentRangeFormattingEditProvider,
        model,
      );
      const selector = this.injector.get(FormattingSelector);
      const formatter = await selector.pickFormatter<DocumentFormattingEditProvider>(formatterProviders, model);
      if (formatter) {
        try {
          const edits = await formatter.provideDocumentFormattingEdits(
            model,
            model.getFormattingOptions(),
            CancellationToken.None,
          );
          if (edits) {
            FormattingEdit.execute(monacoEditor, edits, true);
          }
        } catch (err) {
          this.logger.error('execute format document with error', err);
        }
      }
    }
  }

  async formatSelectionWith() {
    if (!this.workbenchEditorService.currentEditor?.monacoEditor.hasModel()) {
      return;
    }

    const monacoEditor = this.workbenchEditorService.currentEditor.monacoEditor;

    const model = monacoEditor.getModel();
    if (model) {
      let range: Range | null | undefined = monacoEditor.getSelection();
      if (range?.isEmpty()) {
        range = new Range(
          range.startLineNumber,
          1,
          range.startLineNumber,
          model.getLineMaxColumn(range.startLineNumber),
        );
      }
      const formatterProviders = languageFeaturesService.documentRangeFormattingEditProvider.ordered(model);
      const selector = this.injector.get(FormattingSelector);
      const formatter = await selector.pickFormatter<DocumentRangeFormattingEditProvider>(formatterProviders, model);
      if (formatter) {
        try {
          const edits = await formatter.provideDocumentRangeFormattingEdits(
            model,
            range!,
            model.getFormattingOptions(),
            CancellationToken.None,
          );
          if (edits) {
            FormattingEdit.execute(monacoEditor, edits, true);
          }
        } catch (err) {
          this.logger.error('execute format document with error', err);
        }
      }
    }
  }
}
