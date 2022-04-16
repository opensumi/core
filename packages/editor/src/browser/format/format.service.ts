import { Injector, Injectable, Autowired, INJECTOR_TOKEN } from '@opensumi/di';
import { CancellationToken, ILogger } from '@opensumi/ide-core-common';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import {
  DocumentFormattingEditProvider,
  DocumentRangeFormattingEditProvider,
  DocumentRangeFormattingEditProviderRegistry,
} from '@opensumi/monaco-editor-core/esm/vs/editor/common/modes';
import { getRealAndSyntheticDocumentFormattersOrdered } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/format/format';
import { FormattingEdit } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/format/formattingEdit';

import { WorkbenchEditorService } from '../types';
import { WorkbenchEditorServiceImpl } from '../workbench-editor.service';

import { FormattingSelector } from './formatterSelect';

@Injectable()
export class DocumentFormatService {
  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(WorkbenchEditorService)
  private workbenchEditorService: WorkbenchEditorServiceImpl;

  @Autowired(INJECTOR_TOKEN)
  injector: Injector;

  async formatDocumentWith() {
    const model = this.workbenchEditorService.currentEditor?.monacoEditor.getModel();
    if (model) {
      const formatterProviders = getRealAndSyntheticDocumentFormattersOrdered(model);
      const selector = this.injector.get(FormattingSelector);
      const formatter = await selector.select(formatterProviders, model, true);
      if (formatter) {
        try {
          const edits = await (formatter as DocumentFormattingEditProvider).provideDocumentFormattingEdits(
            model,
            model.getFormattingOptions(),
            CancellationToken.None,
          );
          if (edits) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            FormattingEdit.execute(this.workbenchEditorService.currentEditor?.monacoEditor!, edits, true);
          }
        } catch (err) {
          this.logger.error('execute format document with error', err);
        }
      }
    }
  }

  async formatSelectionWith() {
    if (!this.workbenchEditorService.currentCodeEditor?.monacoEditor.hasModel()) {
      return;
    }
    const model = this.workbenchEditorService.currentEditor?.monacoEditor.getModel();
    if (model) {
      let range: Range | null | undefined = this.workbenchEditorService.currentEditor?.monacoEditor.getSelection();
      if (range?.isEmpty()) {
        range = new Range(
          range.startLineNumber,
          1,
          range.startLineNumber,
          model.getLineMaxColumn(range.startLineNumber),
        );
      }
      const formatterProviders = DocumentRangeFormattingEditProviderRegistry.ordered(model);
      const selector = this.injector.get(FormattingSelector);
      const formatter = await selector.select(formatterProviders, model, true);
      if (formatter) {
        try {
          const edits = await (formatter as DocumentRangeFormattingEditProvider).provideDocumentRangeFormattingEdits(
            model,
            range!,
            model.getFormattingOptions(),
            CancellationToken.None,
          );
          if (edits) {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            FormattingEdit.execute(this.workbenchEditorService.currentEditor?.monacoEditor!, edits, true);
          }
        } catch (err) {
          this.logger.error('execute format document with error', err);
        }
      }
    }
  }
}
