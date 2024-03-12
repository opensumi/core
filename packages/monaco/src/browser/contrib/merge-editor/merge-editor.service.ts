import { Autowired, INJECTOR_TOKEN, Injectable, Injector } from '@opensumi/di';
import {
  CommandService,
  Disposable,
  EDITOR_COMMANDS,
  Emitter,
  Event,
  MonacoService,
  localize,
} from '@opensumi/ide-core-browser';
import { IOpenMergeEditorArgs } from '@opensumi/ide-core-browser/lib/monaco/merge-editor-widget';
import { URI } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IDialogService } from '@opensumi/ide-overlay';

import { DetailedLineRangeMapping } from '../../../common/diff';
import { ICodeEditor } from '../../monaco-api/editor';

import { MappingManagerService } from './mapping-manager.service';
import { IMergeEditorEditorConstructionOptions } from './merge-editor-widget';
import { ComputerDiffModel } from './model/computer-diff';
import { ACCEPT_CURRENT_ACTIONS, IEditorMountParameter } from './types';
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
  private readonly mappingManagerService: MappingManagerService;

  @Autowired(IFileServiceClient)
  private readonly fileServiceClient: IFileServiceClient;

  @Autowired(IDialogService)
  private readonly dialogService: IDialogService;

  @Autowired(CommandService)
  private readonly commandService: CommandService;

  private currentView: CurrentCodeEditor;
  private resultView: ResultCodeEditor;
  private incomingView: IncomingCodeEditor;

  private computerDiffModel: ComputerDiffModel;
  private actionsManager: ActionsManager;

  public scrollSynchronizer: ScrollSynchronizer;
  public stickinessConnectManager: StickinessConnectManager;

  private readonly _onDidInputNutrition = new Emitter<IOpenMergeEditorArgs>();
  public readonly onDidInputNutrition: Event<IOpenMergeEditorArgs> = this._onDidInputNutrition.event;

  private readonly _onDidMount = new Emitter<IEditorMountParameter>();
  public readonly onDidMount: Event<IEditorMountParameter> = this._onDidMount.event;

  private readonly _onRestoreState = new Emitter<URI>();
  public readonly onRestoreState: Event<URI> = this._onRestoreState.event;

  private nutrition: IOpenMergeEditorArgs | undefined;

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

  public setNutritionAndLaunch(data: IOpenMergeEditorArgs): void {
    this.nutrition = data;
    this._onDidInputNutrition.fire(data);
  }

  public getNutrition(): IOpenMergeEditorArgs | undefined {
    return this.nutrition;
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

    this._onDidMount.fire({
      currentView: this.currentView,
      resultView: this.resultView,
      incomingView: this.incomingView,
    });

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

  public async acceptLeft(): Promise<void> {
    const mappings = this.mappingManagerService.documentMappingTurnLeft;
    const lineRanges = mappings.getOriginalRange();
    lineRanges.forEach((range) => {
      this.currentView.launchConflictActionsEvent({
        range,
        action: ACCEPT_CURRENT_ACTIONS,
      });
    });
  }

  public async acceptRight(): Promise<void> {
    const mappings = this.mappingManagerService.documentMappingTurnRight;
    const lineRanges = mappings.getModifiedRange();
    lineRanges.forEach((range) => {
      this.incomingView.launchConflictActionsEvent({
        range,
        action: ACCEPT_CURRENT_ACTIONS,
      });
    });
  }

  public async accept(): Promise<void> {
    const continueText = localize('mergeEditor.conflict.action.apply.confirm.continue');
    const completeText = localize('mergeEditor.conflict.action.apply.confirm.complete');

    const saveApply = async () => {
      if (!this.nutrition) {
        return;
      }

      const { output } = this.nutrition;
      const { uri } = output;

      const stat = await this.fileServiceClient.getFileStat(uri.toString(), false);

      if (!stat) {
        return;
      }

      /**
       * 将 result view editor 的文本直接覆写 output uri 的磁盘文件
       */
      const resultValue = this.resultView.getEditor().getValue();
      await this.fileServiceClient.setContent(stat, resultValue);
      this.fireRestoreState(uri);

      await this.commandService.executeCommand(EDITOR_COMMANDS.CLOSE.id);
    };

    const { completeCount, shouldCount } = this.resultView.completeSituation();
    if (shouldCount !== completeCount) {
      const result = await this.dialogService.info(localize('mergeEditor.conflict.action.apply.confirm.title'), [
        continueText,
        completeText,
      ]);

      if (result === continueText) {
        return;
      }

      if (result === completeText) {
        await saveApply();
      }
      return;
    } else {
      await saveApply();
    }
  }

  public fireRestoreState(uri: URI): void {
    this._onRestoreState.fire(uri);
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

  public getTurnLeftRangeMapping(): DetailedLineRangeMapping[] {
    return this.mappingManagerService.documentMappingTurnLeft.getMetaLineRangeMapping();
  }

  public getTurnRightRangeMapping(): DetailedLineRangeMapping[] {
    return this.mappingManagerService.documentMappingTurnRight.getMetaLineRangeMapping();
  }

  public updateOptions(newOptions: IMergeEditorEditorConstructionOptions): void {
    this.currentView.updateOptions(newOptions);
    this.incomingView.updateOptions(newOptions);
    this.resultView.updateOptions(newOptions);
  }

  public async compare(
    memoryMapping1: DetailedLineRangeMapping[] = [],
    memoryMapping2: DetailedLineRangeMapping[] = [],
  ): Promise<void> {
    this.mappingManagerService.clearMapping();

    let turnLeftMapping: readonly DetailedLineRangeMapping[] = memoryMapping1;
    let turnRightMapping: readonly DetailedLineRangeMapping[] = memoryMapping2;

    if (memoryMapping1.length === 0 && memoryMapping2.length === 0) {
      this.resultView.reset();

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

    this.currentView.updateDecorations().updateActions();
    this.incomingView.updateDecorations().updateActions();
    this.resultView.updateDecorations().updateActions();
    // **** 以上顺序不能变 *****
  }
}
