import { Injectable, Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  WithEventBus,
  Domain,
  OnEvent,
  PreferenceService,
  CommandService,
  ServiceNames,
  ILogger,
  MonacoOverrideServiceRegistry,
  IProgress,
  ProgressLocation,
  IProgressStep,
  formatLocalize,
} from '@opensumi/ide-core-browser';
import { IProgressService } from '@opensumi/ide-core-browser/lib/progress';
import { ResourceEdit } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { languageFeaturesService } from '@opensumi/ide-monaco/lib/browser/monaco-api/languages';
import { ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import * as languages from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';
import { CodeActionProvider } from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';
import {
  getCodeActions,
  CodeActionItem,
} from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/codeAction/browser/codeAction';
import {
  CodeActionKind,
  CodeActionTriggerSource,
} from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/codeAction/browser/types';
import * as monaco from '@opensumi/monaco-editor-core/esm/vs/editor/editor.api';

import { SaveReason } from '../types';

import { EditorDocumentModelWillSaveEvent, IEditorDocumentModelService } from './types';

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

    return this.progressService.withProgress(
      {
        title: formatLocalize('editor.saveActions.saveing', e.payload.uri.displayName),
        location: ProgressLocation.Notification,
        cancellable: true,
      },
      async (progress) => {
        const preferenceActions = this.preferenceService.get<
          | {
              [prop: string]: any;
            }
          | string[]
        >('editor.codeActionsOnSave', undefined, e.payload.uri.toString(), e.payload.language);
        if (!preferenceActions) {
          return undefined;
        }

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
      },
    );
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
        progress.report({
          message: formatLocalize(
            'editor.saveActions.gettingCodeAction',
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

@Domain(ClientAppContribution)
export class SaveParticipantsContribution implements ClientAppContribution {
  @Autowired()
  codeActionOnSaveParticipant: CodeActionOnSaveParticipant;

  onStart() {
    this.codeActionOnSaveParticipant.activate();
  }
}
