import { observer } from 'mobx-react-lite';
import React, { useCallback, useEffect, useState } from 'react';

import {
  AINativeConfigService,
  CommandService,
  EDITOR_COMMANDS,
  ILogger,
  URI,
  localize,
  runWhenIdle,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { Button, Icon, SplitPanel } from '@opensumi/ide-core-browser/lib/components';
import { InlineActionBar } from '@opensumi/ide-core-browser/lib/components/actions';
import { AbstractMenuService, MenuId } from '@opensumi/ide-core-browser/lib/menu/next';
import {
  IMergeEditorInputData,
  IOpenMergeEditorArgs,
  MergeEditorInputData,
} from '@opensumi/ide-core-browser/lib/monaco/merge-editor-widget';
import { MergeConflictCommands } from '@opensumi/ide-core-common/lib/commands/git';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { MappingManagerDataStore } from '../mapping-manager.store';
import { MergeEditorService } from '../merge-editor.service';
import { ECompleteReason, EditorViewType } from '../types';

import styles from './merge-editor.module.less';
import { MiniMap } from './mini-map';
import { WithViewStickinessConnectComponent } from './stickiness-connect-manager';

const TitleHead: React.FC<{ contrastType: EditorViewType }> = ({ contrastType }) => {
  const menuService = useInjectable<AbstractMenuService>(AbstractMenuService);

  const mergeEditorService = useInjectable<MergeEditorService>(MergeEditorService);
  const workspaceService = useInjectable<IWorkspaceService>(IWorkspaceService);
  const [head, setHead] = useState<IMergeEditorInputData>();

  const toRelativePath = useCallback((uri: URI) => {
    // 获取相对路径
    if (workspaceService.workspace) {
      const rootUri = new URI(workspaceService.workspace.uri);
      const rootRelative = rootUri.relative(uri);
      if (rootRelative) {
        return rootRelative.toString();
      }

      return uri.toString();
    }

    return uri.toString();
  }, []);

  React.useEffect(() => {
    const disposable = mergeEditorService.onDidInputNutrition((nutrition: IOpenMergeEditorArgs) => {
      /**
       * input1: current
       * input2: incoming
       * output: result
       */
      const { input1, input2, output } = nutrition;
      if (contrastType === EditorViewType.CURRENT) {
        setHead(input1.getRaw());
      } else if (contrastType === EditorViewType.INCOMING) {
        setHead(input2.getRaw());
      } else if (contrastType === EditorViewType.RESULT) {
        setHead(new MergeEditorInputData(output.uri, 'Result', toRelativePath(output.uri), '').getRaw());
      }
    });

    return () => {
      disposable.dispose();
    };
  }, [mergeEditorService]);

  const renderMoreActions = useCallback(() => {
    if (contrastType !== EditorViewType.RESULT) {
      return null;
    }

    const menus = menuService.createMenu(MenuId.MergeEditorResultTitleContext);

    return <InlineActionBar menus={menus} className={styles.menubar_action} />;
  }, [contrastType]);

  return (
    <div className={styles.title_head_container}>
      {head && (
        <div className={styles.content}>
          <span className={styles.title} title={head.title}>
            {head.title}
          </span>
          <span className={styles.description} title={head.description}>
            {head.description}
          </span>
          <span className={styles.detail} title={head.detail}>
            {head.detail}
          </span>
        </div>
      )}
      <div className={styles.actions_container}>{renderMoreActions()}</div>
    </div>
  );
};

const MergeActions: React.FC = observer(() => {
  const aiNativeConfigService = useInjectable<AINativeConfigService>(AINativeConfigService);
  const mergeEditorService = useInjectable<MergeEditorService>(MergeEditorService);
  const commandService = useInjectable<CommandService>(CommandService);
  const logger = useInjectable<ILogger>(ILogger);
  const dataStore = useInjectable<MappingManagerDataStore>(MappingManagerDataStore);
  const [isAIResolving, setIsAIResolving] = useState(false);

  const isSupportAIResolve = useCallback(
    () => aiNativeConfigService.capabilities.supportsConflictResolve,
    [aiNativeConfigService],
  );

  useEffect(() => {
    const dispose = mergeEditorService.onHasIntelligentLoadingChange((isLoading) => {
      setIsAIResolving(isLoading);
    });

    return () => dispose.dispose();
  }, [mergeEditorService]);

  const [applyLoading, setApplyLoading] = useState(false);

  const handleApply = useCallback(async () => {
    setApplyLoading(true);
    try {
      const result = await mergeEditorService.accept();
      if (result) {
      }
    } catch (e) {
      logger.error(e);
    } finally {
      setApplyLoading(false);
    }
  }, [mergeEditorService]);

  const handleAcceptLeft = useCallback(() => {
    mergeEditorService.acceptLeft(false, ECompleteReason.UserManual);
  }, [mergeEditorService]);

  const handleAcceptRight = useCallback(() => {
    mergeEditorService.acceptRight(false, ECompleteReason.UserManual);
  }, [mergeEditorService]);

  const handleOpenTradition = useCallback(() => {
    let uri = mergeEditorService.getCurrentEditor()?.getModel()?.uri;
    if (!uri) {
      return;
    }

    if (uri.scheme === 'git') {
      // replace git:// with file://
      uri = uri.with({
        scheme: 'file',
        path: uri.path,
        query: '',
      });
    }

    if (uri.scheme !== 'file') {
      // ignore other scheme
      logger.warn('Unsupported scheme', uri.scheme);
      return;
    }

    commandService.executeCommand(EDITOR_COMMANDS.API_OPEN_EDITOR_COMMAND_ID, uri);
  }, [mergeEditorService]);

  const handleReset = useCallback(async () => {
    await mergeEditorService.stopAllAIResolveConflict();
    runWhenIdle(() => {
      commandService.executeCommand(EDITOR_COMMANDS.MERGEEDITOR_RESET.id);
    });
  }, [mergeEditorService]);

  const handleAIResolve = useCallback(() => {
    if (isAIResolving) {
      mergeEditorService.stopAllAIResolveConflict();
    } else {
      mergeEditorService.handleAIResolveConflict();
    }
  }, [mergeEditorService, isAIResolving]);

  const handlePrev = useCallback(() => {
    commandService.tryExecuteCommand(MergeConflictCommands.Previous);
  }, []);

  const handleNext = useCallback(() => {
    commandService.tryExecuteCommand(MergeConflictCommands.Next);
  }, []);

  const conflictsCount = dataStore.conflictsCount;
  const nonConflictingChangesResolvedCount = dataStore.nonConflictingChangesResolvedCount;

  const conflictsAllResolved = conflictsCount.lefted === 0 && conflictsCount.resolved === conflictsCount.total;
  const conflictsProgressHint = conflictsAllResolved
    ? '已全部解决'
    : `已解决 ${conflictsCount.resolved} 处，剩余 ${conflictsCount.lefted} 处`;

  let nonConflictHint = '自动合并';
  if (nonConflictingChangesResolvedCount.userManualResolveNonConflicts) {
    nonConflictHint = '合并';
  }
  const nonConflictHintInfos = [] as string[];
  if (nonConflictingChangesResolvedCount.total > 0) {
    nonConflictHintInfos.push(`${nonConflictingChangesResolvedCount.total} 处非冲突变更已${nonConflictHint}`);

    const branchInfos = [] as string[];

    if (nonConflictingChangesResolvedCount.left > 0) {
      branchInfos.push(`目标分支：${nonConflictingChangesResolvedCount.left} 处`);
    }
    if (nonConflictingChangesResolvedCount.right > 0) {
      branchInfos.push(`来源分支：${nonConflictingChangesResolvedCount.right} 处`);
    }
    if (nonConflictingChangesResolvedCount.both > 0) {
      branchInfos.push(`两者：${nonConflictingChangesResolvedCount.both} 处`);
    }

    if (branchInfos.length > 0) {
      const branchInfoString = branchInfos.join('；');
      nonConflictHintInfos.push(`（${branchInfoString}）`);
    }
  }

  const nonConflictHintString = nonConflictHintInfos.join('');

  const mergeInfo = [
    `冲突变更共 ${conflictsCount.total} 处 (${conflictsProgressHint})`,
    conflictsCount.nonConflicts > 0 ? `非冲突变更共 ${conflictsCount.nonConflicts} 处` : '',
    nonConflictHintString,
  ]
    .filter(Boolean)
    .join('｜');

  return (
    <div className={styles.merge_editor_float_container}>
      <div className={styles.merge_info}>{mergeInfo}</div>
      <div className={styles.container_box}>
        <div id='merge.editor.action.button.accept' className={styles.action_category}>
          <Button className={styles.merge_conflict_bottom_btn} size='default' onClick={handleAcceptLeft}>
            <Icon icon={'left'} />
            <span>{localize('mergeEditor.action.button.accept.left')}</span>
          </Button>
          <Button className={styles.merge_conflict_bottom_btn} size='default' onClick={handleAcceptRight}>
            <span>{localize('mergeEditor.action.button.accept.right')}</span>
            <Icon icon={'right'} />
          </Button>
        </div>

        <span className={styles.line_vertical}></span>

        <div id='merge.editor.action.button.nav' className={styles.action_category}>
          <Button className={styles.merge_conflict_bottom_btn} size='default' onClick={handlePrev}>
            <Icon icon={'left'} />
            <span>{localize('mergeEditor.conflict.prev')}</span>
          </Button>
          <Button className={styles.merge_conflict_bottom_btn} size='default' onClick={handleNext}>
            <span>{localize('mergeEditor.conflict.next')}</span>
            <Icon icon={'right'} />
          </Button>
        </div>

        <span className={styles.line_vertical}></span>

        <Button
          id='merge.editor.open.tradition'
          className={styles.merge_conflict_bottom_btn}
          size='default'
          onClick={handleOpenTradition}
        >
          <Icon icon={'swap'} />
          <span>{localize('mergeEditor.open.tradition')}</span>
        </Button>
        <Button
          id='merge.editor.rest'
          className={styles.merge_conflict_bottom_btn}
          size='default'
          onClick={handleReset}
        >
          <Icon icon={'discard'} />
          <span>{localize('mergeEditor.reset')}</span>
        </Button>
        {isSupportAIResolve() && (
          <Button
            id='merge.editor.conflict.resolve.all'
            size='default'
            className={`${styles.merge_conflict_bottom_btn} ${styles.magic_btn}`}
            onClick={handleAIResolve}
          >
            {isAIResolving ? (
              <>
                <Icon icon={'circle-pause'} />
                <span>{localize('mergeEditor.conflict.ai.resolve.all.stop')}</span>
              </>
            ) : (
              <>
                <Icon icon={'magic-wand'} />
                <span>{localize('mergeEditor.conflict.ai.resolve.all')}</span>
              </>
            )}
          </Button>
        )}
        <span className={styles.line_vertical}></span>
        <Button
          loading={applyLoading}
          id='merge.editor.action.button.apply'
          size='default'
          className={styles.merge_editor_apply_btn}
          onClick={handleApply}
        >
          {localize('mergeEditor.action.button.apply-and-stash')}
        </Button>
      </div>
    </div>
  );
});

export const Grid = () => {
  const mergeEditorService = useInjectable<MergeEditorService>(MergeEditorService);

  const incomingEditorContainer = React.useRef<HTMLDivElement | null>(null);
  const currentEditorContainer = React.useRef<HTMLDivElement | null>(null);
  const resultEditorContainer = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const [current, result, incoming] = [
      currentEditorContainer.current,
      resultEditorContainer.current,
      incomingEditorContainer.current,
    ];

    if (current && result && incoming) {
      mergeEditorService.instantiationCodeEditor(current, result, incoming);
    }

    return () => {
      mergeEditorService.dispose();
    };
  }, [
    incomingEditorContainer.current,
    currentEditorContainer.current,
    resultEditorContainer.current,
    mergeEditorService,
  ]);

  return (
    <div className={styles.merge_editor_container}>
      <SplitPanel overflow='hidden' id='merge_editor_container' flex={2}>
        <div className={styles.editor_container_arrange}>
          <TitleHead contrastType={EditorViewType.CURRENT}></TitleHead>
          <div className={styles.content}>
            <div className={styles.minimap_container}>
              <MiniMap contrastType={EditorViewType.CURRENT} />
            </div>
            <div className={styles.editor_container} ref={currentEditorContainer}></div>
          </div>
        </div>
        <div className={styles.editor_container_arrange}>
          <TitleHead contrastType={EditorViewType.RESULT}></TitleHead>
          <div className={styles.editor_container}>
            <WithViewStickinessConnectComponent contrastType={EditorViewType.CURRENT} />
            <div className={styles.editor_container} ref={resultEditorContainer}></div>
            <WithViewStickinessConnectComponent contrastType={EditorViewType.INCOMING} />
          </div>
        </div>
        <div className={styles.editor_container_arrange}>
          <TitleHead contrastType={EditorViewType.INCOMING}></TitleHead>
          <div className={styles.content}>
            <div className={styles.editor_container} ref={incomingEditorContainer}></div>
            <div className={styles.minimap_container}>
              <MiniMap contrastType={EditorViewType.INCOMING} />
            </div>
          </div>
        </div>
      </SplitPanel>
      <MergeActions />
    </div>
  );
};
