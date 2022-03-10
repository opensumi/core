import { localize } from '@opensumi/ide-core-browser';
import { MessageType, URI } from '@opensumi/ide-core-common';
import { IDialogService, IMessageService } from '@opensumi/ide-overlay';
import { IWorkspaceEditService } from '@opensumi/ide-workspace-edit';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { ContentSearchResult, ResultTotal } from '../common/';

export async function replaceAll(
  workspaceEditService: IWorkspaceEditService,
  resultMap: Map<string, ContentSearchResult[]>,
  replaceText: string,
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
    const selection = await dialogService!.open(
      localize('search.removeAll.occurrences.files.confirmation.message')
        .replace('{1}', String(resultTotal!.fileNum))
        .replace('{0}', String(resultTotal!.resultNum))
        .replace('{2}', String(replaceText)),
      MessageType.Warning,
      Object.keys(buttons),
    );
    if (!buttons[selection!]) {
      return buttons[selection!];
    }
  }
  for (const resultArray of resultMap) {
    const results = resultArray[1];
    await replace(workspaceEditService, results, replaceText);
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

export async function replace(
  workspaceEditService: IWorkspaceEditService,
  results: ContentSearchResult[],
  replaceText: string,
) {
  await workspaceEditService.apply({
    edits: results.map((result) => ({
      options: {
        dirtyIfInEditor: true,
      },
      resource: new URI(result.fileUri),
      textEdit: {
        range: new monaco.Range(result.line, result.matchStart, result.line, result.matchStart + result.matchLength),
        text: replaceText,
      },
    })),
  });
}
