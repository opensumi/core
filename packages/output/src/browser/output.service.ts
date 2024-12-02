import { Autowired, Injectable } from '@opensumi/di';
import { AppConfig, PreferenceService } from '@opensumi/ide-core-browser';
import { Emitter, WithEventBus } from '@opensumi/ide-core-common';
import {
  EditorCollectionService,
  ICodeEditor,
  IEditorDocumentModelService,
  getSimpleEditorOptions,
} from '@opensumi/ide-editor/lib/browser';
import * as monaco from '@opensumi/ide-monaco';
import { derived, observableValue, transaction } from '@opensumi/ide-monaco/lib/common/observable';

import { OutputChannel } from './output.channel';

@Injectable()
export class OutputService extends WithEventBus {
  @Autowired(AppConfig)
  private config: AppConfig;

  @Autowired(EditorCollectionService)
  private readonly editorCollectionService: EditorCollectionService;

  @Autowired(IEditorDocumentModelService)
  protected readonly documentService: IEditorDocumentModelService;

  @Autowired(PreferenceService)
  private readonly preferenceService: PreferenceService;

  private outputEditor?: ICodeEditor;
  private onDidSelectedChannelChangeEmitter = new Emitter<OutputChannel>();
  private monacoDispose: monaco.IDisposable;
  private autoReveal = true;
  private enableSmartScroll = true;
  private readonly channels = observableValue<Map<string, OutputChannel>>(this, new Map());

  public selectedChannel: OutputChannel;

  get onDidSelectedChannelChange() {
    return this.onDidSelectedChannelChangeEmitter.event;
  }

  constructor() {
    super();
    this.enableSmartScroll = Boolean(this.preferenceService.get<boolean>('output.enableSmartScroll'));
    this.addDispose(
      this.preferenceService.onPreferenceChanged((e) => {
        if (e.preferenceName === 'output.enableSmartScroll' && e.newValue !== this.enableSmartScroll) {
          this.enableSmartScroll = e.newValue;
        }
      }),
    );
  }

  public updateSelectedChannel(channel: OutputChannel) {
    if (this.monacoDispose) {
      this.monacoDispose.dispose();
    }
    this.selectedChannel = channel;
    this.onDidSelectedChannelChangeEmitter.fire(channel);
    this.selectedChannel.modelReady.promise.then(() => {
      const model = this.selectedChannel.outputModel.instance.getMonacoModel();
      this.outputEditor?.open(this.selectedChannel.outputModel);
      if (this.enableSmartScroll) {
        this.outputEditor?.monacoEditor.revealLine(model.getLineCount());
        this.autoReveal = true;
      }

      this.monacoDispose = model.onDidChangeContent(() => {
        if (this.autoReveal && this.enableSmartScroll) {
          this.outputEditor?.monacoEditor.revealLine(model.getLineCount(), 0);
        }
      });
    });
  }

  private _viewHeight: string;

  set viewHeight(value: string) {
    this._viewHeight = value;
  }

  get viewHeight() {
    return this._viewHeight;
  }

  getChannel(name: string): OutputChannel {
    const channels = this.channels.get();
    const existing = channels.get(name);
    if (existing) {
      return existing;
    }

    const channel = this.config.injector.get(OutputChannel, [name]);
    channels.set(name, channel);
    if (channels.size === 1) {
      this.updateSelectedChannel(channel);
    }
    transaction((tx) => {
      this.channels.set(new Map(channels), tx);
    });
    return channel;
  }

  deleteChannel(name: string): void {
    transaction((tx) => {
      const channels = this.channels.get();
      channels.delete(name);
      this.channels.set(new Map(channels), tx);
    });
  }

  readonly getChannels = derived<OutputChannel[]>(this, (reader) => {
    const channels = this.channels.read(reader);
    return Array.from(channels.values());
  });

  public async initOutputMonacoInstance(container: HTMLDivElement) {
    if (this.outputEditor) {
      this.outputEditor.dispose();
    }

    this.outputEditor = this.editorCollectionService.createCodeEditor(container, {
      ...getSimpleEditorOptions(),
      lineDecorationsWidth: 20,
      automaticLayout: true,
      readOnly: true,
      domReadOnly: true,
      extraEditorClassName: 'kt-output-monaco',
      scrollbar: {
        useShadows: false,
      },
    });

    if (this.selectedChannel) {
      this.updateSelectedChannel(this.selectedChannel);
    }

    this.addDispose(
      this.outputEditor.monacoEditor.onMouseUp((e) => {
        /**
         * 这里的逻辑是
         * 当开启智能滚动后，如果鼠标事件点击所在行小于当前总行数，则停止自动滚动
         * 如果点击到最后一行，则启用自动滚动
         */
        if (this.enableSmartScroll) {
          const { range } = e.target;
          const maxLine = this.outputEditor?.currentDocumentModel?.getMonacoModel().getLineCount();
          if (range?.startLineNumber! < maxLine!) {
            this.autoReveal = false;
          }
          if (range?.startLineNumber! >= maxLine!) {
            this.autoReveal = true;
          }
        }
      }),
    );
  }
}
