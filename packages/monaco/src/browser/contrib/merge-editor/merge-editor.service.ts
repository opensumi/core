import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { Disposable, MonacoService } from '@opensumi/ide-core-browser';

import { ICodeEditor } from '../../monaco-api/editor';

import { ComputerDiffModel } from './model/computer-diff';
import { ActionsManager } from './view/actions-manager';
import { CurrentCodeEditor } from './view/editors/currentCodeEditor';
import { IncomingCodeEditor } from './view/editors/incomingCodeEditor';
import { ResultCodeEditor } from './view/editors/resultCodeEditor';
import { MappingManager } from './view/mapping-manager';
import { ScrollSynchronizer } from './view/scroll-synchronizer';
import { StickinessConnectManager } from './view/stickiness-connect-manager';

@Injectable()
export class MergeEditorService extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(MonacoService)
  private readonly monacoService: MonacoService;

  private currentView: CurrentCodeEditor;
  private resultView: ResultCodeEditor;
  private incomingView: IncomingCodeEditor;

  private computerDiffModel: ComputerDiffModel;
  private actionsManager: ActionsManager;
  private mappingManager: MappingManager;

  public scrollSynchronizer: ScrollSynchronizer;
  public stickinessConnectManager: StickinessConnectManager;

  constructor() {
    super();
    this.computerDiffModel = new ComputerDiffModel();
    this.scrollSynchronizer = new ScrollSynchronizer();
    this.stickinessConnectManager = new StickinessConnectManager();
    this.actionsManager = new ActionsManager();
    this.mappingManager = new MappingManager();
  }

  public instantiationCodeEditor(current: HTMLDivElement, result: HTMLDivElement, incoming: HTMLDivElement): void {
    if (this.currentView && this.resultView && this.incomingView) {
      return;
    }

    this.currentView = this.injector.get(CurrentCodeEditor, [current, this.monacoService, this.injector]);
    this.resultView = this.injector.get(ResultCodeEditor, [result, this.monacoService, this.injector]);
    this.incomingView = this.injector.get(IncomingCodeEditor, [incoming, this.monacoService, this.injector]);

    this.scrollSynchronizer.mount(this.currentView, this.resultView, this.incomingView);
    this.stickinessConnectManager.mount(this.currentView, this.resultView, this.incomingView);
    this.actionsManager.mount(this.currentView, this.resultView, this.incomingView);
    this.mappingManager.mount(this.currentView, this.resultView, this.incomingView);
  }

  public override dispose(): void {
    super.dispose();
    this.currentView.dispose();
    this.resultView.dispose();
    this.incomingView.dispose();
    this.scrollSynchronizer.dispose();
    this.stickinessConnectManager.dispose();
    this.actionsManager.dispose();
    this.mappingManager.dispose();
  }

  public getCurrentEditor(): ICodeEditor {
    return this.currentView.getEditor();
  }
  public getResultEditor(): ICodeEditor {
    return this.resultView.getEditor();
  }
  public getIncomingEditor(): ICodeEditor {
    return this.incomingView.getEditor();
  }

  public async compare(): Promise<void> {
    this.resultView.clearDecorations();

    const result = await this.computerDiffModel.computeDiff(this.currentView.getModel()!, this.resultView.getModel()!);
    const { changes } = result;
    this.currentView.inputDiffComputingResult(changes);
    this.resultView.inputDiffComputingResult(changes, 1);

    const result2 = await this.computerDiffModel.computeDiff(
      this.resultView.getModel()!,
      this.incomingView.getModel()!,
    );
    const { changes: changes2 } = result2;
    this.resultView.inputDiffComputingResult(changes2, 0);
    this.incomingView.inputDiffComputingResult(changes2);
  }
}
