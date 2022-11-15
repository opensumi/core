import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { Disposable, IContextKeyService, MonacoService, ServiceNames } from '@opensumi/ide-core-browser';
import { EditorCollectionService, getSimpleEditorOptions } from '@opensumi/ide-editor';
import { IDocumentDiff } from '@opensumi/monaco-editor-core/esm/vs/editor/common/diff/documentDiffProvider';

import { monaco } from '../../monaco-api';
import { ICodeEditor } from '../../monaco-api/editor';
import { ITextModel } from '../../monaco-api/types';
import { MonacoContextKeyService } from '../../monaco.context-key.service';

import { ComputerDiffModel } from './model/computer-diff';
import { MergeEditorDecorations } from './model/decorations';

@Injectable()
export class MergeEditorService extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(MonacoService)
  private readonly monacoService: MonacoService;

  @Autowired(MonacoContextKeyService)
  private readonly monacoContextKeyService: MonacoContextKeyService;

  private incomingView: ICodeEditor | undefined;
  private currentView: ICodeEditor | undefined;
  private resultView: ICodeEditor | undefined;

  private incomingDecorations: MergeEditorDecorations;
  private currentDecorations: MergeEditorDecorations;
  private resultDecorations: MergeEditorDecorations;

  private computerDiffModel: ComputerDiffModel;

  constructor() {
    super();
    this.computerDiffModel = new ComputerDiffModel();
  }

  private createEditorFactory(container: HTMLDivElement): ICodeEditor {
    const editor = this.monacoService.createCodeEditor(container, {
      automaticLayout: true,
      wordBasedSuggestions: true,
      renderLineHighlight: 'all',
      folding: false,
      lineNumbersMinChars: 2,
      minimap: {
        enabled: false,
      },
    });
    return editor;
  }

  public getCurrentEditor(): ICodeEditor | undefined {
    return this.currentView;
  }
  public getResultEditor(): ICodeEditor | undefined {
    return this.resultView;
  }
  public getIncomingEditor(): ICodeEditor | undefined {
    return this.incomingView;
  }

  public createIncomingEditor(container: HTMLDivElement): ICodeEditor {
    if (this.incomingView) {
      return this.incomingView;
    }

    this.incomingView = this.createEditorFactory(container);
    this.incomingDecorations = this.injector.get(MergeEditorDecorations, [this.incomingView]);
    return this.incomingView;
  }

  public createCurrentEditor(container: HTMLDivElement): ICodeEditor {
    if (this.currentView) {
      return this.currentView;
    }

    this.currentView = this.createEditorFactory(container);
    this.currentDecorations = this.injector.get(MergeEditorDecorations, [this.currentView]);
    return this.currentView;
  }

  public createResultEditor(container: HTMLDivElement): ICodeEditor {
    if (this.resultView) {
      return this.resultView;
    }

    this.resultView = this.createEditorFactory(container);
    this.resultDecorations = this.injector.get(MergeEditorDecorations, [this.resultView]);
    return this.resultView;
  }

  public async diffComputer(model1: ITextModel, model2: ITextModel): Promise<IDocumentDiff> {
    const result = await this.computerDiffModel.computeDiff(model1, model2);
    return result;
  }

  public async compare(): Promise<void> {
    const result = await this.diffComputer(this.currentView?.getModel()!, this.resultView?.getModel()!);
    const { changes } = result;

    this.currentDecorations.render(
      changes.map((r) => r.originalRange),
      changes
        .map((c) => c.innerChanges)
        .filter(Boolean)
        .flatMap((m) => m!.map((m) => m.originalRange)),
    );
    this.resultDecorations.render(
      changes.map((r) => r.modifiedRange),
      changes
        .map((c) => c.innerChanges)
        .filter(Boolean)
        .flatMap((m) => m!.map((m) => m.modifiedRange)),
    );

    this.diffComputer(this.resultView?.getModel()!, this.incomingView?.getModel()!).then((result) => {
      const { changes } = result;
      this.resultDecorations.render(
        changes.map((r) => r.originalRange),
        changes
          .map((c) => c.innerChanges)
          .filter(Boolean)
          .flatMap((m) => m!.map((m) => m.originalRange)),
      );
      this.incomingDecorations.render(
        changes.map((r) => r.modifiedRange),
        changes
          .map((c) => c.innerChanges)
          .filter(Boolean)
          .flatMap((m) => m!.map((m) => m.modifiedRange)),
      );
    });

    const dom = this.currentView!.getDomNode();
    if (dom) {
      const marginDom = dom.querySelector('.margin');
      const elementDom = dom.querySelector('.monaco-scrollable-element');

      if (marginDom) {
        marginDom.setAttribute('style', `${marginDom.getAttribute('style')} right: 0px;`);
      }

      if (elementDom) {
        elementDom.setAttribute('style', `${elementDom.getAttribute('style')} left: 0px;`);
      }
    }
  }
}
