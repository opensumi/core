import React, { useCallback, useEffect, useState } from 'react';

import {
  AiNativeConfigService,
  CommandService,
  EDITOR_COMMANDS,
  URI,
  localize,
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
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { MergeEditorService } from '../merge-editor.service';
import { EditorViewType, IMergeEditorService } from '../types';

import styles from './merge-editor.module.less';
import { MiniMap } from './mini-map';
import { WithViewStickinessConnectComponent } from './stickiness-connect-manager';

const TitleHead: React.FC<{ contrastType: EditorViewType }> = ({ contrastType }) => {
  const menuService = useInjectable<AbstractMenuService>(AbstractMenuService);

  const mergeEditorService = useInjectable<MergeEditorService>(IMergeEditorService);
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

const MergeActions: React.FC = () => {
  const mergeEditorService = useInjectable<MergeEditorService>(IMergeEditorService);
  const aiNativeConfigService = useInjectable<AiNativeConfigService>(AiNativeConfigService);
  const commandService = useInjectable<CommandService>(CommandService);
  const [isAiResolving, setIsAiResolving] = useState(false);

  const isSupportAiResolve = useCallback(
    () => aiNativeConfigService.capabilities.supportsConflictResolve,
    [aiNativeConfigService],
  );

  useEffect(() => {
    const dispose = mergeEditorService.onHasIntelligentLoadingChange((isLoading) => {
      setIsAiResolving(isLoading);
    });

    return () => dispose.dispose();
  }, [mergeEditorService]);

  const handleApply = useCallback(() => {
    mergeEditorService.accept();
  }, [mergeEditorService]);

  const handleAcceptLeft = useCallback(() => {
    mergeEditorService.acceptLeft();
  }, [mergeEditorService]);

  const handleAcceptRight = useCallback(() => {
    mergeEditorService.acceptRight();
  }, [mergeEditorService]);

  const handleOpenTradition = useCallback(() => {
    // TODO
  }, [mergeEditorService]);

  const handleReset = useCallback(() => {
    commandService.executeCommand(EDITOR_COMMANDS.MERGEEDITOR_RESET.id);
  }, [mergeEditorService]);

  const handleAIResolve = useCallback(() => {
    if (isAiResolving) {
      mergeEditorService.stopAllAiResolveConflict();
    } else {
      mergeEditorService.handleAiResolveConflict();
    }
  }, [mergeEditorService, isAiResolving]);

  return (
    <div className={styles.merge_editor_float_container}>
      <div className={styles.container_box}>
        <div id='merge.editor.action.button.accept'>
          <Button className={styles.merge_conflict_bottom_btn} size='large' onClick={handleAcceptLeft}>
            <Icon icon={'left'} />
            <span>{localize('mergeEditor.action.button.accept.left')}</span>
          </Button>
          <Button className={styles.merge_conflict_bottom_btn} size='large' onClick={handleAcceptRight}>
            <span>{localize('mergeEditor.action.button.accept.right')}</span>
            <Icon icon={'right'} />
          </Button>
        </div>

        <span className={styles.line_vertical}></span>

        <Button
          id='merge.editor.open.tradition'
          className={styles.merge_conflict_bottom_btn}
          size='large'
          onClick={handleOpenTradition}
        >
          <Icon icon={'swap'} />
          <span>{localize('mergeEditor.open.tradition')}</span>
        </Button>
        <Button id='merge.editor.rest' className={styles.merge_conflict_bottom_btn} size='large' onClick={handleReset}>
          <Icon icon={'diuqi'} />
          <span>{localize('mergeEditor.reset')}</span>
        </Button>
        {isSupportAiResolve() && (
          <Button
            id='merge.editor.conflict.resolve.all'
            size='large'
            className={`${styles.merge_conflict_bottom_btn} ${styles.magic_btn}`}
            onClick={handleAIResolve}
          >
            {isAiResolving ? (
              <>
                <Icon icon={'circle-pause'} />
                <span>{localize('mergeEditor.conflict.resolve.all.stop')}</span>
              </>
            ) : (
              <>
                <Icon icon={'magic-wand'} />
                <span>{localize('mergeEditor.conflict.resolve.all')}</span>
              </>
            )}
          </Button>
        )}
        <span className={styles.line_vertical}></span>
        <Button
          id='merge.editor.action.button.apply'
          size='large'
          className={styles.merge_editor_apply_btn}
          onClick={handleApply}
        >
          {localize('mergeEditor.action.button.apply')}
        </Button>
      </div>
    </div>
  );
};

export const Grid = () => {
  const mergeEditorService = useInjectable<MergeEditorService>(IMergeEditorService);

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
            <WithViewStickinessConnectComponent
              contrastType={EditorViewType.CURRENT}
            ></WithViewStickinessConnectComponent>
            <div className={styles.editor_container} ref={resultEditorContainer}></div>
            <WithViewStickinessConnectComponent
              contrastType={EditorViewType.INCOMING}
            ></WithViewStickinessConnectComponent>
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
