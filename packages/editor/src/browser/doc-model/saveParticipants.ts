import { Injectable, Autowired } from '@opensumi/di';
import {
  ClientAppContribution,
  WithEventBus,
  Domain,
  OnEvent,
  PreferenceService,
  CommandService,
  MonacoService,
  ServiceNames,
  ILogger,
  MonacoOverrideServiceRegistry,
  Progress,
} from '@opensumi/ide-core-browser';
import { ResourceEdit } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { languageFeaturesService } from '@opensumi/ide-monaco/lib/browser/monaco-api/languages';
import { ITextModel } from '@opensumi/ide-monaco/lib/browser/monaco-api/types';
import * as languages from '@opensumi/monaco-editor-core/esm/vs/editor/common/languages';
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
  preferenceService: PreferenceService;

  @Autowired(MonacoService)
  monacoService: MonacoService;

  @Autowired(MonacoOverrideServiceRegistry)
  private readonly overrideServiceRegistry: MonacoOverrideServiceRegistry;

  get bulkEditService(): any {
    return this.overrideServiceRegistry.getRegisteredService(ServiceNames.BULK_EDIT_SERVICE);
  }

  @Autowired(CommandService)
  commandService: CommandService;

  @Autowired(IEditorDocumentModelService)
  docService: IEditorDocumentModelService;

  @Autowired(ILogger)
  logger: ILogger;

  activate() {
    // noop
  }

  @OnEvent(EditorDocumentModelWillSaveEvent)
  async onEditorDocumentModelWillSave(e: EditorDocumentModelWillSaveEvent) {
    // 自动保存不运行
    if (e.payload.reason !== SaveReason.Manual) {
      return;
    }

    const preferenceActions = this.preferenceService.get<{
      [prop: string]: any;
    }>('editor.codeActionsOnSave', undefined, e.payload.uri.toString(), e.payload.language);
    if (!preferenceActions) {
      return undefined;
    }
    const codeActionsOnSave: CodeActionKind[] = [];

    for (const k of Object.keys(preferenceActions).map((p) => new CodeActionKind(p))) {
      // source.fixAll
      // source.fixAll.eslint
      // source.fixAll.stylelint
      if (CodeActionKind.SourceFixAll.equals(k) || CodeActionKind.SourceFixAll.contains(k)) {
        codeActionsOnSave.push(CodeActionKind.SourceFixAll);
      }

      // source.organizeImports
      if (CodeActionKind.SourceOrganizeImports.equals(k)) {
        codeActionsOnSave.push(CodeActionKind.SourceOrganizeImports);
      }
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

    return Promise.race([
      new Promise<void>((_resolve, reject) =>
        setTimeout(() => {
          tokenSource.cancel();
          reject('codeActionsOnSave timeout');
        }, timeout),
      ),
      this.applyOnSaveActions(model, codeActionsOnSave, tokenSource.token),
    ]).finally(() => {
      tokenSource.cancel();
      modelRef.dispose();
    });
  }

  private async applyOnSaveActions(model: ITextModel, actions: CodeActionKind[], token: monaco.CancellationToken) {
    for (const codeActionKind of actions) {
      try {
        const actionsToRun = await this.getActionsToRun(model, codeActionKind, token);

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

  private async getActionsToRun(model: ITextModel, codeActionKind: CodeActionKind, token: monaco.CancellationToken) {
    return getCodeActions(
      languageFeaturesService.codeActionProvider,
      model,
      model.getFullModelRange(),
      {
        type: languages.CodeActionTriggerType.Auto,
        filter: { include: codeActionKind, includeSourceActions: true },
        triggerAction: CodeActionTriggerSource.OnSave,
      },
      Progress.None,
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
