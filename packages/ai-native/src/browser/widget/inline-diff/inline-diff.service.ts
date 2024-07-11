import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import { PreferenceService } from '@opensumi/ide-core-browser';
import { AINativeSettingSectionsId, ChatResponse, Disposable, ReplyResponse } from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/ide-monaco';

import { EInlineDiffPreviewMode } from '../../preferences/schema';
import { InlineChatController } from '../inline-chat/inline-chat-controller';
import {
  BaseInlineDiffPreviewer,
  LiveInlineDiffPreviewer,
  SideBySideInlineDiffWidget,
} from '../inline-diff/inline-diff-previewer';
import { InlineDiffWidget } from '../inline-diff/inline-diff-widget';
import { InlineStreamDiffHandler } from '../inline-stream-diff/inline-stream-diff.handler';


@Injectable()
export class InlineDiffService extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  private formatAnswer(answer: string, crossCode: string): string {
    const leadingWhitespaceMatch = crossCode.match(/^\s*/);
    const indent = leadingWhitespaceMatch ? leadingWhitespaceMatch[0] : '  ';
    return answer
      .split('\n')
      .map((line) => `${indent}${line}`)
      .join('\n');
  }

  createDiffPreviewer(
    monacoEditor: monaco.ICodeEditor,
    options: {
      crossSelection: monaco.Selection;
      chatResponse?: ChatResponse | InlineChatController;
    },
  ): BaseInlineDiffPreviewer<InlineDiffWidget | InlineStreamDiffHandler> {
    const { crossSelection, chatResponse } = options;

    const inlineDiffMode = this.preferenceService.getValid<EInlineDiffPreviewMode>(
      AINativeSettingSectionsId.InlineDiffPreviewMode,
      EInlineDiffPreviewMode.inlineLive,
    );

    const disposable = new Disposable();

    let diffPreviewer: BaseInlineDiffPreviewer<InlineDiffWidget | InlineStreamDiffHandler>;

    if (inlineDiffMode === EInlineDiffPreviewMode.sideBySide) {
      diffPreviewer = this.injector.get(SideBySideInlineDiffWidget, [monacoEditor, crossSelection]);
    } else {
      diffPreviewer = this.injector.get(LiveInlineDiffPreviewer, [monacoEditor, crossSelection]);
    }

    diffPreviewer.show(
      crossSelection.startLineNumber - 1,
      crossSelection.endLineNumber - crossSelection.startLineNumber + 2,
    );

    const onFinish = () => {
      diffPreviewer.layout();
      disposable.dispose();
    };

    if (InlineChatController.is(chatResponse)) {
      const controller = chatResponse as InlineChatController;

      disposable.addDispose(
        diffPreviewer.onReady(() => {
          controller.deferred.resolve();

          disposable.addDispose([
            controller.onData((data) => {
              if (ReplyResponse.is(data)) {
                diffPreviewer.onData(data);
              }
            }),
            controller.onError((error) => {
              diffPreviewer.onError(error);
              onFinish();
            }),
            controller.onAbort(() => {
              diffPreviewer.onAbort();
              onFinish();
            }),
            controller.onEnd(() => {
              diffPreviewer.onEnd();
              onFinish();
            }),
          ]);
        }),
      );
    } else {
      const model = monacoEditor.getModel();
      const crossCode = model!.getValueInRange(crossSelection);

      const answer = this.formatAnswer((chatResponse as ReplyResponse).message, crossCode);

      disposable.addDispose(
        diffPreviewer.onReady(() => {
          diffPreviewer.setValue(answer);
          onFinish();
        }),
      );
    }

    diffPreviewer.layout();
    return diffPreviewer;
  }
}
