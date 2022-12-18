import { Injectable, Autowired, Injector, INJECTOR_TOKEN } from '@opensumi/di';
import { Disposable, Emitter, Event, MonacoService } from '@opensumi/ide-core-browser';
import { IOpenMergeEditorArgs } from '@opensumi/ide-core-browser/lib/monaco/merge-editor-widget';

import { ICodeEditor } from '../../monaco-api/editor';

import { MappingManagerService } from './mapping-manager.service';
import { IMergeEditorEditorConstructionOptions } from './merge-editor-widget';
import { ComputerDiffModel } from './model/computer-diff';
import { LineRangeMapping } from './model/line-range-mapping';
import { EDiffRangeTurn } from './types';
import { ActionsManager } from './view/actions-manager';
import { CurrentCodeEditor } from './view/editors/currentCodeEditor';
import { IncomingCodeEditor } from './view/editors/incomingCodeEditor';
import { ResultCodeEditor } from './view/editors/resultCodeEditor';
import { ScrollSynchronizer } from './view/scroll-synchronizer';
import { StickinessConnectManager } from './view/stickiness-connect-manager';

@Injectable()
export class MergeEditorService extends Disposable {
  @Autowired(INJECTOR_TOKEN)
  private readonly injector: Injector;

  @Autowired(MonacoService)
  private readonly monacoService: MonacoService;

  @Autowired(MappingManagerService)
  protected readonly mappingManagerService: MappingManagerService;

  private currentView: CurrentCodeEditor;
  private resultView: ResultCodeEditor;
  private incomingView: IncomingCodeEditor;

  private computerDiffModel: ComputerDiffModel;
  private actionsManager: ActionsManager;

  public scrollSynchronizer: ScrollSynchronizer;
  public stickinessConnectManager: StickinessConnectManager;

  private readonly _onDidInputNutrition = new Emitter<IOpenMergeEditorArgs>();
  public readonly onDidInputNutrition: Event<IOpenMergeEditorArgs> = this._onDidInputNutrition.event;

  constructor() {
    super();
    this.computerDiffModel = new ComputerDiffModel();
    this.scrollSynchronizer = new ScrollSynchronizer();
    this.stickinessConnectManager = new StickinessConnectManager();
    this.actionsManager = this.injector.get(ActionsManager, [this.mappingManagerService]);
  }

  private initListenEvent(): void {
    this.addDispose(
      this.resultView.onDidChangeContent(() => {
        this.resultView.updateDecorations().updateActions();
        this.currentView.launchChange();
        this.incomingView.launchChange();
      }),
    );
  }

  public launchNutrition(data: IOpenMergeEditorArgs): void {
    this._onDidInputNutrition.fire(data);
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

    this.initListenEvent();
  }

  public override dispose(): void {
    super.dispose();
    this.currentView.dispose();
    this.resultView.dispose();
    this.incomingView.dispose();
    this.scrollSynchronizer.dispose();
    this.stickinessConnectManager.dispose();
    this.actionsManager.dispose();
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

  public getTurnLeftRangeMapping(): LineRangeMapping[] {
    return this.mappingManagerService.documentMappingTurnLeft.getMetaLineRangeMapping();
  }

  public getTurnRightRangeMapping(): LineRangeMapping[] {
    return this.mappingManagerService.documentMappingTurnRight.getMetaLineRangeMapping();
  }

  public updateOptions(newOptions: IMergeEditorEditorConstructionOptions): void {
    this.currentView.updateOptions(newOptions);
    this.incomingView.updateOptions(newOptions);
    this.resultView.updateOptions(newOptions);
  }

  public async compare(
    memoryMapping1: LineRangeMapping[] = [],
    memoryMapping2: LineRangeMapping[] = [],
  ): Promise<void> {
    this.mappingManagerService.clearMapping();

    let turnLeftMapping: LineRangeMapping[] = memoryMapping1;
    let turnRightMapping: LineRangeMapping[] = memoryMapping2;

    if (memoryMapping1.length === 0 && memoryMapping2.length === 0) {
      const [result1, result2] = await Promise.all([
        this.computerDiffModel.computeDiff(this.currentView.getModel()!, this.resultView.getModel()!),
        this.computerDiffModel.computeDiff(this.resultView.getModel()!, this.incomingView.getModel()!),
      ]);

      turnLeftMapping = result1.changes;
      turnRightMapping = result2.changes;
    }

    // **** 以下顺序不能变 *****
    this.currentView.inputDiffComputingResult(turnLeftMapping);
    this.incomingView.inputDiffComputingResult(turnRightMapping);
    this.resultView.inputDiffComputingResult();
    // **** 以上顺序不能变 *****

    this.currentView.updateDecorations().updateActions();
    this.incomingView.updateDecorations().updateActions();
  }
}
