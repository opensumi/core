import { PreferenceService } from '@opensumi/ide-core-browser';
import {
  AINativeSettingSectionsId,
  ChatResponse,
  Disposable,
  DisposableCollection,
  Emitter,
  Event,
  IDisposable,
  ReplyResponse,
} from '@opensumi/ide-core-common';
import * as monaco from '@opensumi/ide-monaco';
import { ICodeEditor } from '@opensumi/ide-monaco';
import {
  IObservable,
  ISettableObservable,
  autorun,
  observableFromEvent,
  observableValue,
  transaction,
} from '@opensumi/ide-monaco/lib/common/observable';

import { BaseAIMonacoEditorController } from '../../contrib/base';
import { EInlineDiffPreviewMode } from '../../preferences/schema';
import { InlineChatController } from '../inline-chat/inline-chat-controller';
import { EResultKind } from '../inline-chat/inline-chat.service';
import { BaseInlineStreamDiffHandler } from '../inline-stream-diff/inline-stream-diff.handler';

import {
  BaseInlineDiffPreviewer,
  IDiffPreviewerOptions,
  LiveInlineDiffPreviewer,
  SideBySideInlineDiffWidget,
} from './inline-diff-previewer';
import { InlineDiffWidget } from './inline-diff-widget';

type IInlineDiffPreviewer = BaseInlineDiffPreviewer<InlineDiffWidget | BaseInlineStreamDiffHandler>;

export class InlineDiffController extends BaseAIMonacoEditorController {
  public static readonly ID = 'editor.contrib.ai.inline.diff';

  public static get(editor: ICodeEditor): InlineDiffController | null {
    return editor.getContribution<InlineDiffController>(InlineDiffController.ID);
  }

  private get preferenceService(): PreferenceService {
    return this.injector.get(PreferenceService);
  }

  private readonly _onMaxLineCount = new Emitter<number>();
  public readonly onMaxLineCount: Event<number> = this._onMaxLineCount.event;

  private previewerStore: Map<string, IInlineDiffPreviewer>;
  private currentPreviewer: ISettableObservable<IInlineDiffPreviewer | undefined>;
  private modelChangeObs: IObservable<monaco.editor.ITextModel>;

  mount(): IDisposable {
    this.previewerStore = new Map();
    this.currentPreviewer = observableValue(this, undefined);
    this.modelChangeObs = observableFromEvent<monaco.editor.ITextModel>(
      this,
      this.monacoEditor.onDidChangeModel,
      () => this.monacoEditor.getModel()!,
    );

    this.featureDisposable.addDispose(
      autorun((reader) => {
        const model = this.modelChangeObs.read(reader);
        if (!model) {
          return;
        }

        /**
         * 切换到其他 model 且 previewer 未卸载时
         * 保留 previewer 的实例，仅卸载 previewer 的渲染层
         */
        const id = model.id;
        const previewer = this.currentPreviewer.get();
        if (previewer && previewer.modelId !== id && !previewer.disposed) {
          previewer.hide();
        }

        const storedPreview = this.previewerStore.get(model.id);
        transaction((tx) => {
          if (storedPreview && storedPreview.modelId === id) {
            this.currentPreviewer.set(storedPreview, tx);
            storedPreview.resume();
          } else {
            this.currentPreviewer.set(undefined, tx);
          }
        });
      }),
    );

    return this.featureDisposable;
  }

  getPreviewer(): IInlineDiffPreviewer | undefined {
    return this.currentPreviewer.get();
  }

  private renderDiff(previewer: IInlineDiffPreviewer, data: ReplyResponse) {
    if (!previewer) {
      return;
    }

    previewer.onData(data);

    // 仅在当前 model 中进行流式渲染
    if (this.modelChangeObs.get()?.id === previewer.modelId) {
      previewer.render();
    }
  }

  showPreviewerByStream(
    monacoEditor: monaco.ICodeEditor,
    options: {
      crossSelection: monaco.Selection;
      chatResponse?: ChatResponse | InlineChatController;
      previewerOptions?: IDiffPreviewerOptions;
    },
  ): BaseInlineDiffPreviewer<InlineDiffWidget | BaseInlineStreamDiffHandler> {
    const { crossSelection, chatResponse } = options;

    const disposable = new Disposable();

    const previewer = this.createDiffPreviewer(monacoEditor, crossSelection, options.previewerOptions);

    const onFinish = () => {
      previewer.layout();
      disposable.dispose();
    };

    const previewerDisposable = new DisposableCollection();

    disposable.addDispose(
      previewer.onReady(() => {
        if (InlineChatController.is(chatResponse)) {
          const controller = chatResponse as InlineChatController;

          previewerDisposable.pushAll([
            controller.onData((data) => {
              if (ReplyResponse.is(data)) {
                this.renderDiff(previewer, data);
              }
            }),
            controller.onError((error) => {
              previewer.onError(error);
              onFinish();
            }),
            controller.onAbort(() => {
              previewer.onAbort();
              onFinish();
            }),
            controller.onEnd(() => {
              previewer.onEnd();
              onFinish();
            }),
          ]);

          controller.listen();
        } else {
          previewer.setValue((chatResponse as ReplyResponse).message);
          onFinish();
        }
      }),
    );

    previewer.onDispose(() => {
      previewerDisposable.dispose();
    });
    disposable.addDispose(previewerDisposable);
    previewer.layout();
    return previewer;
  }

  createDiffPreviewer(monacoEditor: monaco.ICodeEditor, selection: monaco.Selection, options?: IDiffPreviewerOptions) {
    const inlineDiffMode = this.preferenceService.getValid<EInlineDiffPreviewMode>(
      AINativeSettingSectionsId.InlineDiffPreviewMode,
      EInlineDiffPreviewMode.inlineLive,
    );

    let previewer: IInlineDiffPreviewer;

    if (inlineDiffMode === EInlineDiffPreviewMode.sideBySide) {
      previewer = this.injector.get(SideBySideInlineDiffWidget, [monacoEditor]);
    } else {
      previewer = this.injector.get(LiveInlineDiffPreviewer, [monacoEditor]);
    }

    previewer.create(selection, options);
    previewer.show(selection.startLineNumber - 1, selection.endLineNumber - selection.startLineNumber + 2);

    previewer.addDispose(previewer.onLineCount((lineCount) => this._onMaxLineCount.fire(lineCount)));

    previewer.addDispose(
      Disposable.create(() => {
        this.previewerStore.delete(previewer.modelId);
      }),
    );

    transaction((tx) => {
      this.currentPreviewer.set(previewer, tx);
      this.previewerStore.set(previewer.modelId, previewer);
    });

    return previewer;
  }

  handleAction(action: EResultKind): void {
    const previewer = this.getPreviewer();
    if (!previewer) {
      return;
    }

    previewer.handleAction(action);
  }

  getModifyContent() {
    const previewer = this.getPreviewer();
    if (!previewer) {
      return;
    }

    return previewer.getValue();
  }

  getOriginContent() {
    const previewer = this.getPreviewer();
    if (!previewer) {
      return;
    }

    return previewer.getOriginValue();
  }

  revealFirstDiff() {
    const previewer = this.getPreviewer();
    if (!previewer) {
      return;
    }

    previewer.revealFirstDiff();
  }
}
