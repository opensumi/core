import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  ClientAppContribution,
  CommandService,
  Domain,
  ILogger,
  IProgress,
  IProgressStep,
  MonacoOverrideServiceRegistry,
  OnEvent,
  PreferenceService,
  ProgressLocation,
  ServiceNames,
  WithEventBus,
  formatLocalize,
} from '@opensumi/ide-core-browser';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import * as monaco from '@opensumi/ide-monaco';
import {
  CodeActionItem,
  CodeActionKind,
  CodeActionTriggerSource,
} from '@opensumi/ide-monaco/lib/browser/contrib/codeAction';
import { ResourceEdit } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { languageFeaturesService } from '@opensumi/ide-monaco/lib/browser/monaco-api/languages';
import { ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import { Selection } from '@opensumi/monaco-editor-core';
import { IActiveCodeEditor } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/editorBrowser';
import { ICodeEditorService } from '@opensumi/monaco-editor-core/esm/vs/editor/browser/services/codeEditorService';
import { EditOperation } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/editOperation';
import { Range } from '@opensumi/monaco-editor-core/esm/vs/editor/common/core/range';
import * as languages from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';
import { CodeActionProvider } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';
import { getCodeActions } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/codeAction/browser/codeAction';

import { MonacoCodeService } from '../editor.override';
import { SaveReason } from '../types';

import { EditorDocumentModelWillSaveEvent, IEditorDocumentModelService } from './types';

function findEditor(model: ITextModel, codeEditorService: ICodeEditorService): IActiveCodeEditor | null {
  let candidate: IActiveCodeEditor | null = null;

  if (model.isAttachedToEditor()) {
    for (const editor of codeEditorService.listCodeEditors()) {
      if (editor.hasModel() && editor.getModel() === model) {
        if (editor.hasTextFocus()) {
          return editor; // favour focused editor if there are multiple
        }

        candidate = editor;
      }
    }
  }

  return candidate;
}

@Injectable()
export class CodeActionOnSaveParticipant extends WithEventBus {
  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(MonacoOverrideServiceRegistry)
  private readonly overrideServiceRegistry: MonacoOverrideServiceRegistry;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  @Autowired(IEditorDocumentModelService)
  private readonly docService: IEditorDocumentModelService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(IProgressService)
  private readonly progressService: IProgressService;

  get bulkEditService(): any {
    return this.overrideServiceRegistry.getRegisteredService(ServiceNames.BULK_EDIT_SERVICE);
  }

  activate() {
    // noop
  }

  @OnEvent(EditorDocumentModelWillSaveEvent)
  async onEditorDocumentModelWillSave(e: EditorDocumentModelWillSaveEvent) {
    // 自动保存不运行
    if (e.payload.reason !== SaveReason.Manual) {
      return;
    }

    const preferenceActions = this.preferenceService.get<
      | {
          [prop: string]: any;
        }
      | string[]
    >('editor.codeActionsOnSave', undefined, e.payload.uri.toString(), e.payload.language);
    if (!preferenceActions) {
      return undefined;
    }

    const preferenceSaveCodeActionsNotification = this.preferenceService.get<boolean>(
      'editor.codeActionsOnSaveNotification',
      true,
      e.payload.uri.toString(),
      e.payload.language,
    );

    const runActions = (progress) => {
      const codeActions = Array.isArray(preferenceActions) ? preferenceActions : Object.keys(preferenceActions);
      const codeActionsOnSave: CodeActionKind[] = codeActions.map((p) => new CodeActionKind(p));

      if (!Array.isArray(preferenceActions)) {
        codeActionsOnSave.sort((a, b) => {
          if (CodeActionKind.SourceFixAll.contains(a)) {
            if (CodeActionKind.SourceFixAll.contains(b)) {
              return 0;
            }
            return -1;
          }
          if (CodeActionKind.SourceFixAll.contains(b)) {
            return 1;
          }
          return 0;
        });
      }
      if (codeActionsOnSave.length === 0) {
        return;
      }

      const modelRef = this.docService.getModelReference(e.payload.uri, 'codeActionOnSave');
      if (!modelRef) {
        return;
      }

      const model = modelRef.instance.getMonacoModel();

      const tokenSource = new monaco.CancellationTokenSource();

      const timeout = this.preferenceService.get<number>(
        'editor.codeActionsOnSaveTimeout',
        undefined,
        e.payload.uri.toString(),
        e.payload.language,
      );

      const excludedActions = Array.isArray(preferenceActions)
        ? []
        : Object.keys(preferenceActions)
            .filter((x: string) => preferenceActions[x] === false)
            .map((x: string) => new CodeActionKind(x));

      return Promise.race([
        new Promise<void>((_resolve, reject) =>
          setTimeout(() => {
            tokenSource.cancel();
            reject('codeActionsOnSave timeout');
          }, timeout),
        ),
        this.applyOnSaveActions(model, codeActionsOnSave, excludedActions, progress, tokenSource.token),
      ]).finally(() => {
        tokenSource.cancel();
        modelRef.dispose();
      });
    };

    if (preferenceSaveCodeActionsNotification) {
      return this.progressService.withProgress(
        {
          title: formatLocalize('editor.saveCodeActions.saving', e.payload.uri.displayName),
          location: ProgressLocation.Notification,
          cancellable: true,
        },
        async (progress) => runActions(progress),
      );
    } else {
      return runActions(null);
    }
  }

  private async applyOnSaveActions(
    model: ITextModel,
    actions: CodeActionKind[],
    excludes: readonly CodeActionKind[],
    progress: IProgress<IProgressStep>,
    token: monaco.CancellationToken,
  ) {
    const getActionProgress = new (class implements IProgress<CodeActionProvider> {
      private _names = new Set<string>();
      private _report(): void {
        progress &&
          progress.report({
            message: formatLocalize(
              'editor.saveCodeActions.getting',
              [...this._names].map((name) => `'${name}'`).join(', '),
            ),
          });
      }
      report(provider: CodeActionProvider) {
        if (provider.displayName && !this._names.has(provider.displayName)) {
          this._names.add(provider.displayName);
          this._report();
        }
      }
    })();
    for (const codeActionKind of actions) {
      try {
        const actionsToRun = await this.getActionsToRun(model, codeActionKind, excludes, getActionProgress, token);

        await this.applyCodeActions(actionsToRun.validActions);
      } catch (e) {
        this.logger.error(e);
      }
    }
  }

  private async applyCodeActions(actionsToRun: readonly CodeActionItem[]) {
    for (const actionItem of actionsToRun) {
      if (actionItem.action.edit) {
        await this.bulkEditService?.apply(ResourceEdit.convert(actionItem.action.edit));
      }
      if (actionItem.action.command) {
        await this.commandService.executeCommand(
          actionItem.action.command.id,
          ...(actionItem.action.command.arguments || []),
        );
      }
    }
  }

  private async getActionsToRun(
    model: ITextModel,
    codeActionKind: CodeActionKind,
    excludes: readonly CodeActionKind[],
    progress: IProgress<CodeActionProvider>,
    token: monaco.CancellationToken,
  ) {
    return getCodeActions(
      languageFeaturesService.codeActionProvider,
      model,
      model.getFullModelRange(),
      {
        type: languages.CodeActionTriggerType.Auto,
        filter: { include: codeActionKind, excludes, includeSourceActions: true },
        triggerAction: CodeActionTriggerSource.OnSave,
      },
      progress,
      token,
    );
  }
}

@Injectable()
export class TrimFinalNewLinesParticipant extends WithEventBus {
  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  @Autowired(IEditorDocumentModelService)
  private readonly docService: IEditorDocumentModelService;

  @Autowired(ILogger)
  private readonly logger: ILogger;

  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  activate() {
    // noop
  }

  @OnEvent(EditorDocumentModelWillSaveEvent)
  async onEditorDocumentModelWillSave(e: EditorDocumentModelWillSaveEvent) {
    const isTrimFinalNewlines = this.preferenceService.get('files.trimFinalNewlines');

    if (isTrimFinalNewlines) {
      const modelRef = this.docService.getModelReference(e.payload.uri, 'trimFinalNewlines');

      if (!modelRef) {
        return;
      }

      const model = modelRef.instance.getMonacoModel();
      this.doTrimFinalNewLines(model, e.payload.reason !== SaveReason.Manual);
      modelRef.dispose();
    }
  }

  /**
   * returns 0 if the entire file is empty
   */
  private findLastNonEmptyLine(model: ITextModel): number {
    for (let lineNumber = model.getLineCount(); lineNumber >= 1; lineNumber--) {
      const lineContent = model.getLineContent(lineNumber);
      if (lineContent.length > 0) {
        // this line has content
        return lineNumber;
      }
    }
    // no line has content
    return 0;
  }

  private doTrimFinalNewLines(model: ITextModel, isAutoSaved: boolean): void {
    const lineCount = model.getLineCount();

    // Do not insert new line if file does not end with new line
    if (lineCount === 1) {
      return;
    }

    let prevSelection: Selection[] = [];
    let cannotTouchLineNumber = 0;

    const codeEditorService = this.injector.get(MonacoCodeService);
    const editor = findEditor(model, codeEditorService);
    if (editor) {
      prevSelection = editor.getSelections();
      if (isAutoSaved) {
        for (let i = 0, len = prevSelection.length; i < len; i++) {
          const positionLineNumber = prevSelection[i].positionLineNumber;
          if (positionLineNumber > cannotTouchLineNumber) {
            cannotTouchLineNumber = positionLineNumber;
          }
        }
      }
    }

    const lastNonEmptyLine = this.findLastNonEmptyLine(model);
    const deleteFromLineNumber = Math.max(lastNonEmptyLine + 1, cannotTouchLineNumber + 1);
    const deletionRange = model.validateRange(
      new Range(deleteFromLineNumber, 1, lineCount, model.getLineMaxColumn(lineCount)),
    );

    if (deletionRange.isEmpty()) {
      return;
    }

    model.pushEditOperations(prevSelection, [EditOperation.delete(deletionRange)], () => prevSelection);

    editor?.setSelections(prevSelection);
  }
}

@Domain(ClientAppContribution)
export class SaveParticipantsContribution implements ClientAppContribution {
  @Autowired()
  codeActionOnSaveParticipant: CodeActionOnSaveParticipant;

  @Autowired()
  trimFinalNewLinesParticipant: TrimFinalNewLinesParticipant;

  onStart() {
    this.codeActionOnSaveParticipant.activate();
    this.trimFinalNewLinesParticipant.activate();
  }
}
