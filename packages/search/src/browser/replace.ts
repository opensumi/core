import { localize } from '@opensumi/ide-core-browser';
import { MessageType, URI, formatLocalize } from '@opensumi/ide-core-common';
import { IEditorDocumentModelService } from '@opensumi/ide-editor/lib/browser';
import * as monaco from '@opensumi/ide-monaco';
import { IDialogService, IMessageService } from '@opensumi/ide-overlay';
import { IResourceFileEdit, IResourceTextEdit, IWorkspaceEditService } from '@opensumi/ide-workspace-edit';

import { ContentSearchResult, ResultTotal } from '../common/';

export async function replaceAll(
  documentModelManager: IEditorDocumentModelService,
  workspaceEditService: IWorkspaceEditService,
  resultMap: Map<string, ContentSearchResult[]>,
  replaceText: string,
  searchText: string,
  isUseRegexp?: boolean,
  dialogService?: IDialogService,
  messageService?: IMessageService,
  insertResultTotal?: ResultTotal,
): Promise<boolean> {
  if (resultMap.size < 1) {
    return false;
  }
  const resultTotal = Object.assign({}, insertResultTotal);
  if (dialogService && resultTotal) {
    const buttons = {
      [localize('search.replace.buttonCancel')]: false,
      [localize('search.replace.buttonOK')]: true,
    };
    const selection = await dialogService!.open({
      message: formatLocalize(
        'search.removeAll.occurrences.files.confirmation.message',
        String(resultTotal.resultNum),
        String(resultTotal.fileNum),
        replaceText,
      ),
      type: MessageType.Warning,
      buttons: Object.keys(buttons),
    });
    if (!buttons[selection!]) {
      return buttons[selection!];
    }
  }
  for (const resultArray of resultMap) {
    const results = resultArray[1];
    await replace(documentModelManager, workspaceEditService, results, replaceText, searchText, isUseRegexp);
  }
  if (messageService && resultTotal) {
    messageService.info(
      formatLocalize(
        'search.replaceAll.occurrencesMessage',
        String(resultTotal.resultNum),
        String(resultTotal.fileNum),
        replaceText,
      ),
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

export async function replace(
  documentModelManager: IEditorDocumentModelService,
  workspaceEditService: IWorkspaceEditService,
  results: ContentSearchResult[],
  replaceText: string,
  searchText: string,
  isUseRegexp?: boolean,
) {
  const autoSavedDocs = results
    .map((result) => documentModelManager.getModelReference(new URI(result.fileUri)))
    .filter((doc) => doc?.instance && !doc.instance.dirty);

  const edits: Array<IResourceFileEdit | IResourceTextEdit> = [];
  for (const result of results) {
    let replaceResult = replaceText;
    if (isUseRegexp && replaceText) {
      let regexp;
      try {
        regexp = new RegExp(searchText);
      } catch (e) {
        continue;
      }
      const matchLineText = result.renderLineText?.slice(
        result.matchStart - 1,
        result.matchStart + result.matchLength - 1,
      );
      if (matchLineText) {
        replaceResult = matchLineText.replace(regexp, replaceText);
      }
    }
    edits.push({
      options: {
        dirtyIfInEditor: true,
      },
      resource: new URI(result.fileUri),
      textEdit: {
        range: new monaco.Range(result.line, result.matchStart, result.line, result.matchStart + result.matchLength),
        text: replaceResult,
      },
    });
  }
  await workspaceEditService.apply({
    edits,
  });

  await Promise.all(
    autoSavedDocs.map(async (doc) => {
      await doc?.instance.save();
      doc?.dispose();
    }),
  );
}
