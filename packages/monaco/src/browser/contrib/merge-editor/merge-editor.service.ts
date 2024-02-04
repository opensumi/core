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
import { MergeConflictReportService } from '@opensumi/ide-core-browser/lib/ai-native/conflict-report.service';
import { message } from '@opensumi/ide-core-browser/lib/components';
import { IOpenMergeEditorArgs } from '@opensumi/ide-core-browser/lib/monaco/merge-editor-widget';
import { URI, runWhenIdle } from '@opensumi/ide-core-common';
import { IFileServiceClient } from '@opensumi/ide-file-service';
import { IDialogService } from '@opensumi/ide-overlay';

import { ICodeEditor } from '../../monaco-api/editor';

import { MappingManagerService } from './mapping-manager.service';
import { IMergeEditorEditorConstructionOptions } from './merge-editor-widget';
import { ComputerDiffModel } from './model/computer-diff';
import { LineRangeMapping } from './model/line-range-mapping';
import { ACCEPT_CURRENT_ACTIONS, APPEND_ACTIONS, IEditorMountParameter, IMergeEditorService } from './types';
import { ActionsManager } from './view/actions-manager';
import { CurrentCodeEditor } from './view/editors/currentCodeEditor';
import { IncomingCodeEditor } from './view/editors/incomingCodeEditor';
import { ResultCodeEditor } from './view/editors/resultCodeEditor';
import { ScrollSynchronizer } from './view/scroll-synchronizer';
import { StickinessConnectManager } from './view/stickiness-connect-manager';

@Injectable()
export class MergeEditorService extends Disposable implements IMergeEditorService {
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

  @Autowired(MergeConflictReportService)
  private readonly mergeConflictReportService: MergeConflictReportService;

  private currentView: CurrentCodeEditor;
  private resultView: ResultCodeEditor;
  private incomingView: IncomingCodeEditor;

  private computerDiffModel: ComputerDiffModel;
  private actionsManager: ActionsManager;

  private isCancelAllAiResolveConflict = false;

  public scrollSynchronizer: ScrollSynchronizer;
  public stickinessConnectManager: StickinessConnectManager;

  private readonly _onDidInputNutrition = new Emitter<IOpenMergeEditorArgs>();
  public readonly onDidInputNutrition: Event<IOpenMergeEditorArgs> = this._onDidInputNutrition.event;

  private readonly _onDidMount = new Emitter<IEditorMountParameter>();
  public readonly onDidMount: Event<IEditorMountParameter> = this._onDidMount.event;

  private readonly _onRestoreState = new Emitter<URI>();
  public readonly onRestoreState: Event<URI> = this._onRestoreState.event;

  private loadingDispose = new Disposable();
  private readonly _onHasIntelligentLoadingChange = new Emitter<boolean>();
  public readonly onHasIntelligentLoadingChange: Event<boolean> = this._onHasIntelligentLoadingChange.event;

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

  private listenIntelligentLoadingChange(): void {
    this.loadingDispose.dispose();

    let flag = false;

    this.loadingDispose.addDispose(
      this.resultView.onChangeRangeIntelligentState((range) => {
        const intelligentState = range.getIntelligentStateModel();

        if (intelligentState.isLoading) {
          this._onHasIntelligentLoadingChange.fire(true);
          flag = true;
          return;
        }

        runWhenIdle(() => {
          const conflictPointRanges = this.resultView.getAllDiffRanges().filter((range) => range.isAiConflictPoint);
          if (flag && conflictPointRanges.every((r) => !!r.getIntelligentStateModel().isLoading === false)) {
            this._onHasIntelligentLoadingChange.fire(false);
            this.loadingDispose.dispose();
          }
        }, 1);
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
    this.loadingDispose.dispose();
    this.mergeConflictReportService.dispose();
  }

  public async acceptLeft(isIgnoreAi = false): Promise<void> {
    const mappings = this.mappingManagerService.documentMappingTurnLeft;
    const lineRanges = mappings.getOriginalRange();
    lineRanges
      .filter((range) => range.isComplete === false)
      .filter((range) => (isIgnoreAi && range.isAiConflictPoint ? null : range))
      .forEach((range) => {
        if (range.isMerge) {
          const oppositeRange = this.mappingManagerService.documentMappingTurnLeft.adjacentComputeRangeMap.get(
            range.id,
          );
          if (oppositeRange && oppositeRange.isComplete) {
            this.currentView.launchConflictActionsEvent({
              range,
              action: APPEND_ACTIONS,
            });
            return;
          }
        }

        this.currentView.launchConflictActionsEvent({
          range,
          action: ACCEPT_CURRENT_ACTIONS,
        });
      });
  }

  public async acceptRight(isIgnoreAi = false): Promise<void> {
    const mappings = this.mappingManagerService.documentMappingTurnRight;
    const lineRanges = mappings.getModifiedRange();
    lineRanges
      .filter((range) => range.isComplete === false)
      .filter((range) => (isIgnoreAi && range.isAiConflictPoint ? null : range))
      .forEach((range) => {
        if (range.isMerge) {
          const oppositeRange = this.mappingManagerService.documentMappingTurnRight.adjacentComputeRangeMap.get(
            range.id,
          );
          if (oppositeRange && oppositeRange.isComplete) {
            this.currentView.launchConflictActionsEvent({
              range,
              action: APPEND_ACTIONS,
            });
            return;
          }
        }

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

      const model = this.resultView.getModel();

      const allRanges = this.resultView.getAllDiffRanges();
      // 使用了 ai 冲突点的数量
      const useAiConflictPointNum = allRanges.filter(
        (range) => range.getIntelligentStateModel().isComplete === true,
      ).length;
      let receiveNum = 0;

      // 生成之后没有做二次修改才算采纳
      allRanges
        .filter((range) => range.isAiConflictPoint && range.getIntelligentStateModel().isComplete)
        .forEach((range) => {
          const intelligentStateModel = range.getIntelligentStateModel();
          const preAnswerCode = intelligentStateModel.answerCode;
          const currentCode = model!.getValueInRange(range.toRange()) || '';

          if (preAnswerCode.trim() === currentCode.trim()) {
            receiveNum += 1;
          }
        });

      this.mergeConflictReportService.report(this.resultView.getUri(), {
        useAiConflictPointNum,
        receiveNum,
      });

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

  public async stopAllAiResolveConflict(): Promise<void> {
    this.isCancelAllAiResolveConflict = true;
    this.resultView.cancelRequestToken();
    this.resultView.hideStopWidget();
  }

  public async handleAiResolveConflict(): Promise<void> {
    this.mergeConflictReportService.reportClickNum(this.resultView.getUri(), 'clickAllNum');

    this.listenIntelligentLoadingChange();

    runWhenIdle(() => {
      this.acceptLeft(true);
    }, 0);

    runWhenIdle(() => {
      this.acceptRight(true);
    }, 1);

    runWhenIdle(async () => {
      this.isCancelAllAiResolveConflict = false;

      const allRanges = this.resultView.getAllDiffRanges();
      const conflictPointRanges = allRanges.filter(
        (range) => range.isAiConflictPoint && !!range.getIntelligentStateModel().isLoading === false,
      );

      let resolveLen = 0;
      let pointLen = conflictPointRanges.length;

      // 错误码列表，如果出现以下错误码，AI 将停止处理
      const errorCodesToStop = [20, 42, 46, 51, 53, 54, 999];
      for await (const range of conflictPointRanges) {
        const flushRange = this.resultView.getFlushRange(range) || range;
        const result = await this.actionsManager.handleAiConflictResolve(flushRange, false, true);
        if (this.isCancelAllAiResolveConflict) {
          this.isCancelAllAiResolveConflict = false;
          return;
        }

        if (!result) {
          continue;
        }

        if (result.isCancel) {
          pointLen -= 1;
        }

        if (result.isSuccess) {
          resolveLen += 1;
        }

        if (result.errorCode !== 0) {
          this.actionsManager.debounceMessageWraning(result.errorCode);
        }

        if (errorCodesToStop.includes(result.errorCode)) {
          break;
        }
      }

      if (resolveLen !== pointLen) {
        message.warning(
          `AI 已处理 ${resolveLen} 处冲突，${pointLen - resolveLen} 处冲突暂未处理（仍标记为黄色部分），需人工处理`,
        );
      }
    }, 2);
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
