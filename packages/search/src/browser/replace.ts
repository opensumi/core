import { IDialogService, IMessageService } from '@ali/ide-overlay';
import { MessageType, URI } from '@ali/ide-core-common';
import { localize } from '@ali/ide-core-browser';
import {
  ContentSearchResult,
  ResultTotal,
} from '../common/';
import { IEditorDocumentModelService, IEditorDocumentModel } from '@ali/ide-editor/lib/browser';

export async function replaceAll(
  documentModelManager: IEditorDocumentModelService,
  resultMap: Map<string, ContentSearchResult[]>,
  replaceText: string,
  dialogService?: IDialogService,
  messageService?: IMessageService,
  resultTotal?: ResultTotal,
): Promise<boolean> {
  if (resultMap.size < 1) {
    return false;
  }
  if (dialogService && resultTotal) {
    const buttons = {
      [localize('ButtonCancel')]: false,
      [localize('ButtonOK')]: true,
    };
    const selection = await dialogService!.open(
        localize('removeAll.occurrences.files.confirmation.message')
          .replace('{1}', String(resultTotal!.fileNum))
          .replace('{0}', String(resultTotal!.resultNum))
          .replace('{2}', String(replaceText)),
        MessageType.Info,
        Object.keys(buttons),
      );
    if (!buttons[selection!]) {
      return buttons[selection!];
    }
  }
  for (const resultArray of resultMap) {
    const results = resultArray[1];
    const fileUri = results[0].fileUri;
    const _uri = new URI(fileUri);

    const docModel = await documentModelManager.createModelReference(new URI(fileUri), 'replace');
    replace(docModel.instance, results, replaceText);
    docModel.dispose();
  }
  if (messageService && resultTotal) {
    messageService.info(
      localize('replaceAll.occurrences.files.message')
        .replace('{1}', String(resultTotal.fileNum))
        .replace('{0}', String(resultTotal.resultNum))
        .replace('{2}', String(replaceText)),
    );
  }
  return true;
}

export function getSelection(result: ContentSearchResult) {
  const selection = new monaco.Selection(
    result.line,
    result.matchStart,
    result.line,
    result.matchStart + result.matchLength,
  );
  return [selection];
}

export function replace(
  docModel: IEditorDocumentModel,
  results: ContentSearchResult[],
  replaceText: string,
) {
  const model = docModel.getMonacoModel();
  const isKeepDirty = docModel.dirty;

  model.pushEditOperations(
    getSelection(results[0]),
    results.map((result) => {
      return {
        range: new monaco.Range(
           result.line,
          result.matchStart,
          result.line,
          result.matchStart + result.matchLength,
        ),
        text: replaceText,
      };
    }),
    (edits) => {
      // TODO 更正确的位置
      return getSelection(results[results.length - 1]);
    },
  );
  model.pushStackElement();
  if (!isKeepDirty) {
    docModel.save();
  }
}
