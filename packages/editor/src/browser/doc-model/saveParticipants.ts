import { ClientAppContribution, WithEventBus, Domain, OnEvent, PreferenceService, CommandService, CancellationToken, CancellationTokenSource, MonacoService, ServiceNames, ILogger } from '@ali/ide-core-browser';
import { Injectable, Autowired } from '@ali/common-di';
import { EditorDocumentModelWillSaveEvent, IEditorDocumentModelService } from './types';
import { SaveReason } from '../types';

@Injectable()
export class CodeActionOnSaveParticipant extends WithEventBus {

  @Autowired(PreferenceService)
  preferenceService: PreferenceService;

  @Autowired(MonacoService)
  monacoService: MonacoService;

  get bulkEditService(): any {
    return this.monacoService.getOverride(ServiceNames.BULK_EDIT_SERVICE);
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

    const preferenceActions = this.preferenceService.get<any>('editor.codeActionsOnSave', undefined, e.payload.uri.toString(), e.payload.language);

    const codeActionsOnSave: monaco.codeAction.codeActionTrigger.CodeActionKind[] = [];

    if (preferenceActions['source.fixAll']) {
      codeActionsOnSave.push(monaco.codeAction.codeActionTrigger.CodeActionKind.SourceFixAll);
    }
    if (preferenceActions['source.organizeImports']) {
      codeActionsOnSave.push(monaco.codeAction.codeActionTrigger.CodeActionKind.SourceOrganizeImports);
    }
    if (codeActionsOnSave.length === 0) {
      return;
    }

    const modelRef = this.docService.getModelReference(e.payload.uri, 'codeActionOnSave');
    if (!modelRef) {
      return;
    }

    const model = modelRef.instance.getMonacoModel();

    const tokenSource = new CancellationTokenSource();

    const timeout = this.preferenceService.get<number>('editor.codeActionsOnSaveTimeout', undefined, e.payload.uri.toString(), e.payload.language);

    return Promise.race([
      new Promise<void>((_resolve, reject) =>
        setTimeout(() => {
          tokenSource.cancel();
          reject('codeActionsOnSave timeout');
        }, timeout)),
      this.applyOnSaveActions(model, codeActionsOnSave, tokenSource.token),
    ]).finally(() => {
      tokenSource.cancel();
      modelRef.dispose();
    });
  }

  private async applyOnSaveActions(model: monaco.editor.ITextModel, actions: monaco.codeAction.codeActionTrigger.CodeActionKind[], token: CancellationToken) {
    for (const codeActionKind of actions) {
      try {
        const actionsToRun = await this.getActionsToRun(model, codeActionKind, token);
        await this.applyCodeActions(actionsToRun.actions);
      } catch (e) {
        this.logger.error(e);
      }
    }
  }

  private async applyCodeActions(actionsToRun: any[]) {
    for (const action of actionsToRun) {
      if (action.edit) {
        await this.bulkEditService.apply(action.edit);
      }
      if (action.command) {
        await this.commandService.executeCommand(action.command.id, ...(action.command.arguments || []));
      }
    }
  }

  private async getActionsToRun(model: monaco.editor.ITextModel, codeActionKind: monaco.codeAction.codeActionTrigger.CodeActionKind, token: CancellationToken) {
    return monaco.codeAction.getCodeActions(model, model.getFullModelRange(), {
      type: 'auto',
      filter: { kind: codeActionKind, includeSourceActions: true },
    }, token);
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
