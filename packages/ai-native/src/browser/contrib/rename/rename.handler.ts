import { Autowired, Injectable } from '@opensumi/di';
import {
  AIServiceType,
  ActionSourceEnum,
  ActionTypeEnum,
  CancellationToken,
  Disposable,
  IAIReporter,
  getErrorMessage,
} from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/ide-monaco';
import { monaco as monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { MonacoTelemetryService } from '@opensumi/ide-monaco/lib/browser/telemetry.service';

import { BaseAIMonacoContribHandler } from '../base';

import { RenameSuggestionsService } from './rename.service';

@Injectable()
export class RenameSingleHandler extends BaseAIMonacoContribHandler {
  @Autowired(RenameSuggestionsService)
  private readonly renameSuggestionService: RenameSuggestionsService;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  @Autowired()
  private monacoTelemetryService: MonacoTelemetryService;

  private lastModelRequestRenameEndTime: number | undefined;
  private lastModelRequestRenameSessionId: string | undefined;

  doContribute() {
    const disposable = new Disposable();

    const provider = async (
      model: monaco.ITextModel,
      range: monaco.IRange,
      triggerKind: monaco.NewSymbolNameTriggerKind,
      token: CancellationToken,
    ) => {
      if (!this.shouldHandle(model.uri)) {
        return;
      }

      this.lastModelRequestRenameSessionId = undefined;

      const startTime = +new Date();
      const relationId = this.aiReporter.start(AIServiceType.Rename, {
        message: 'start',
        type: AIServiceType.Rename,
        modelRequestStartTime: startTime,
        code: model.getValueInRange(range),
        actionSource: ActionSourceEnum.CodeAction,
        actionType: ActionTypeEnum.Rename,
      });
      this.lastModelRequestRenameSessionId = relationId;

      const toDispose = token.onCancellationRequested(() => {
        const endTime = +new Date();

        this.aiReporter.end(relationId, {
          message: 'cancel',
          success: false,
          isCancel: true,
          modelRequestStartTime: startTime,
          modelRequestEndTime: endTime,
          actionSource: ActionSourceEnum.CodeAction,
          actionType: ActionTypeEnum.Rename,
        });

        this.lastModelRequestRenameSessionId = undefined;
      });

      try {
        const result = await this.renameSuggestionService.provideRenameSuggestions(model, range, triggerKind, token);
        toDispose.dispose();
        this.lastModelRequestRenameEndTime = +new Date();
        return result;
      } catch (error) {
        const endTime = +new Date();
        this.aiReporter.end(relationId, {
          message: 'error:' + getErrorMessage(error),
          success: false,
          modelRequestStartTime: startTime,
          modelRequestEndTime: endTime,
          actionSource: ActionSourceEnum.CodeAction,
          actionType: ActionTypeEnum.Rename,
        });
        throw error;
      }
    };

    disposable.addDispose(
      this.monacoTelemetryService.onEventLog('renameInvokedEvent', (event) => {
        if (this.lastModelRequestRenameSessionId) {
          this.aiReporter.end(this.lastModelRequestRenameSessionId, {
            message: 'done',
            success: true,
            actionSource: ActionSourceEnum.CodeAction,
            actionType: ActionTypeEnum.Rename,
            modelRequestEndTime: this.lastModelRequestRenameEndTime,
            ...event,
          });
        }
      }),
    );
    disposable.addDispose(
      monacoApi.languages.registerNewSymbolNameProvider('*', {
        supportsAutomaticNewSymbolNamesTriggerKind: Promise.resolve(true),
        provideNewSymbolNames: provider,
      }),
    );

    return disposable;
  }
}
