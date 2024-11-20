import { Injector } from '@opensumi/di';
import { AppConfig } from '@opensumi/ide-core-browser';
import { InlineChatIsVisible } from '@opensumi/ide-core-browser/lib/contextkey/ai-native';
import {
  AIServiceType,
  ActionSourceEnum,
  ActionTypeEnum,
  Disposable,
  IAIReporter,
  IDisposable,
  ProblemFixRegistryToken,
} from '@opensumi/ide-core-common';
import { ICodeEditor, Range } from '@opensumi/ide-monaco';
import { ContentHoverController } from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/hover/browser/contentHoverController';
import {
  HoverParticipantRegistry,
  IEditorHoverRenderContext,
} from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/hover/browser/hoverTypes';
import {
  MarkerHover,
  MarkerHoverParticipant,
} from '@opensumi/monaco-editor-core/esm/vs/editor/contrib/hover/browser/markerHoverParticipant';

import { AINativeContextKey } from '../../ai-core.contextkeys';
import { IHoverFixHandler } from '../../types';
import { InlineChatEditorController } from '../../widget/inline-chat/inline-chat-editor.controller';
import { BaseAIMonacoEditorController } from '../base';

import { MarkerHoverParticipantComponent } from './problem-fix.component';
import { ProblemFixProviderRegistry } from './problem-fix.feature.registry';
import { ProblemFixService } from './problem-fix.service';

class AIMonacoHoverParticipant extends MarkerHoverParticipant {
  static injector: Injector;

  override renderHoverParts(context: IEditorHoverRenderContext, hoverParts: MarkerHover[]) {
    const disposable = super.renderHoverParts(context, hoverParts);

    const { fragment } = context;
    MarkerHoverParticipantComponent.mount(fragment, hoverParts, AIMonacoHoverParticipant.injector.get(AppConfig));

    return disposable;
  }
}

export class ProblemFixController extends BaseAIMonacoEditorController {
  public static readonly ID = 'editor.contrib.ai.problem.fix';

  public static get(editor: ICodeEditor): ProblemFixController | null {
    return editor.getContribution(ProblemFixController.ID);
  }

  private get problemFixService(): ProblemFixService {
    return this.injector.get(ProblemFixService);
  }

  private get problemFixProviderRegistry(): ProblemFixProviderRegistry {
    return this.injector.get(ProblemFixRegistryToken);
  }

  private get aiReporter(): IAIReporter {
    return this.injector.get(IAIReporter);
  }

  private aiNativeContextKey: AINativeContextKey;

  mount(): IDisposable {
    this.aiNativeContextKey = this.injector.get(AINativeContextKey, [this.monacoEditor.contextKeyService]);

    const provider = this.problemFixProviderRegistry.getHoverFixProvider();
    if (!provider) {
      return Disposable.NULL;
    }

    // 先去掉 monaco 默认的 MarkerHoverParticipant，以及之前注册的 AIMonacoHoverParticipant
    HoverParticipantRegistry._participants = HoverParticipantRegistry._participants.filter(
      (participant) => participant !== MarkerHoverParticipant && participant !== AIMonacoHoverParticipant,
    );

    AIMonacoHoverParticipant.injector = this.injector;
    HoverParticipantRegistry.register(AIMonacoHoverParticipant);

    this.featureDisposable.addDispose(
      this.problemFixService.onHoverFixTrigger((part) => {
        const hoverController = this.monacoEditor?.getContribution<ContentHoverController>(ContentHoverController.ID);
        if (hoverController) {
          hoverController.hideContentHover();
        }

        this.handleHoverFix(part, provider);
      }),
    );

    return this.featureDisposable;
  }

  private async handleHoverFix(part: MarkerHover, provider: IHoverFixHandler) {
    const monacoEditor = this.monacoEditor;

    if (!monacoEditor || !monacoEditor.hasTextFocus()) {
      return;
    }

    const model = monacoEditor.getModel();

    // 以 marker 的 range 为中心，向上取 2 行，向下取 3 行
    const endLineNumber = Math.min(part.range.endLineNumber + 3, model!.getLineCount());
    const editRange = new Range(
      Math.max(part.range.startLineNumber - 2, 0),
      1,
      endLineNumber,
      model!.getLineMaxColumn(endLineNumber),
    );

    const context = {
      marker: part.marker,
      editRange,
    };

    monacoEditor.setSelection(editRange);

    const contextKeyDisposed = new Disposable();
    const inlineChatIsVisible = new Set([InlineChatIsVisible.raw]);

    contextKeyDisposed.addDispose(
      this.aiNativeContextKey.contextKeyService!.onDidChangeContext((e) => {
        if (e.payload.affectsSome(inlineChatIsVisible)) {
          const isVisible = this.aiNativeContextKey.inlineChatIsVisible.get();
          if (isVisible) {
            const inlineChatEditorController = InlineChatEditorController.get(monacoEditor);

            inlineChatEditorController?.runAction({
              monacoEditor,
              reporterFn: (): string => {
                const relationId = this.aiReporter.start(AIServiceType.ProblemFix, {
                  message: ActionTypeEnum.HoverFix,
                  type: AIServiceType.InlineChat,
                  source: ActionTypeEnum.HoverFix,
                  actionSource: ActionSourceEnum.Hover,
                  actionType: ActionTypeEnum.HoverFix,
                });
                return relationId;
              },
              crossSelection: monacoEditor.getSelection()!,
              providerPreview: () => provider.provideFix(monacoEditor, context, inlineChatEditorController.token),
              extraData: {
                actionSource: ActionSourceEnum.Hover,
                actionType: ActionTypeEnum.HoverFix,
              },
            });
          }

          contextKeyDisposed.dispose();
        }
      }),
    );

    this.addDispose(contextKeyDisposed);
  }
}
