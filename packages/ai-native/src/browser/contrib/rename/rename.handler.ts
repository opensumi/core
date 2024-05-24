import { Autowired, Injectable } from '@opensumi/di';
import { Disposable, IDisposable } from '@opensumi/ide-core-browser';
import { AISerivceType, CancellationToken, IAIReporter, Schemes, getErrorMessage } from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/ide-monaco';
import { monaco as monacoApi } from '@opensumi/ide-monaco/lib/browser/monaco-api';
import { MonacoTelemetryService } from '@opensumi/ide-monaco/lib/browser/telemetry.service';

import { RenameSuggestionsService } from './rename.service';

@Injectable()
export class RenameHandler extends Disposable {
  @Autowired(RenameSuggestionsService)
  private readonly renameSuggestionService: RenameSuggestionsService;

  @Autowired(IAIReporter)
  private readonly aiReporter: IAIReporter;

  @Autowired()
  private monacoTelemetryService: MonacoTelemetryService;

  private lastModelRequestRenameEndTime: number | undefined;
  private lastModelRequestRenameSessionId: string | undefined;

  private shouldAbortRequest(model: monaco.ITextModel) {
    if (model.uri.scheme !== Schemes.file) {
      return true;
    }

    return false;
  }

  public registerRenameFeature(languageId: string): IDisposable {
    const disposable = new Disposable();

    const provider = async (model: monaco.ITextModel, range: monaco.IRange, token: CancellationToken) => {
      if (this.shouldAbortRequest(model)) {
        return;
      }

      this.lastModelRequestRenameSessionId = undefined;

      const startTime = +new Date();
      const relationId = this.aiReporter.start('rename', {
        message: 'start',
        type: AISerivceType.Rename,
        modelRequestStartTime: startTime,
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
        });

        this.lastModelRequestRenameSessionId = undefined;
      });

      try {
        const result = await this.renameSuggestionService.provideRenameSuggestions(model, range, token);
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
        });
        throw error;
      }
    };

    disposable.addDispose([
      monacoApi.languages.registerNewSymbolNameProvider(languageId, {
        provideNewSymbolNames: provider,
      }),
      this.monacoTelemetryService.onEventLog('renameInvokedEvent', (event) => {
        if (this.lastModelRequestRenameSessionId) {
          this.aiReporter.end(this.lastModelRequestRenameSessionId, {
            message: 'done',
            success: true,
            modelRequestEndTime: this.lastModelRequestRenameEndTime,
            ...event,
          });
        }
      }),
    ]);

    return disposable;
  }
}
