import debounce from 'lodash/debounce';
import React, { useCallback, useEffect, useReducer, useState } from 'react';

import {
  CommandService,
  EDITOR_COMMANDS,
  ILogger,
  URI,
  localize,
  runWhenIdle,
  useDisposable,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { Button, Icon, SplitPanel } from '@opensumi/ide-core-browser/lib/components';
import { InlineActionWidget } from '@opensumi/ide-core-browser/lib/components/actions';
import {
  AbstractMenuService,
  MenuId,
  MenuItemNode,
  generateMergedInlineActions,
} from '@opensumi/ide-core-browser/lib/menu/next';
import {
  IMergeEditorInputData,
  IOpenMergeEditorArgs,
  MergeEditorInputData,
} from '@opensumi/ide-core-browser/lib/monaco/merge-editor-widget';
import { CommandRegistry, FRAME_THREE } from '@opensumi/ide-core-common';
import { IWorkspaceService } from '@opensumi/ide-workspace';

import { MergeActions } from '../components/merge-actions';
import { MappingManagerDataStore } from '../mapping-manager.store';
import { MergeEditorService } from '../merge-editor.service';
import { ECompleteReason, EditorViewType } from '../types';

import styles from './merge-editor.module.less';
import { MiniMap } from './mini-map';
import { WithViewStickinessConnectComponent } from './stickiness-connect-manager';

interface ITitleHeadProps {
  contrastType: EditorViewType;
}

const TitleHead: React.FC<ITitleHeadProps> = ({ contrastType }) => {
  const menuService = useInjectable<AbstractMenuService>(AbstractMenuService);

  const [state, update] = useReducer((num) => (num + 1) % 1_000_000, 0);
  const mergeEditorService = useInjectable<MergeEditorService>(MergeEditorService);
  const workspaceService = useInjectable<IWorkspaceService>(IWorkspaceService);
  const commandService = useInjectable<CommandService>(CommandService);
  const commandRegistry = useInjectable<CommandRegistry>(CommandRegistry);

  const [head, setHead] = useState<IMergeEditorInputData>();
  const [encoding, setEncoding] = useState<string>('');
  const [currentURI, setCurrentURI] = useState<URI>();

  useDisposable(
    () =>
      commandRegistry.afterExecuteCommand(EDITOR_COMMANDS.CHANGE_ENCODING.id, () => {
        update();
        setTimeout(() => {
          mergeEditorService.compare();
        }, FRAME_THREE);
      }),
    [commandRegistry, mergeEditorService],
  );

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
      const { input1, input2, output, ancestor } = nutrition;
      if (contrastType === EditorViewType.CURRENT) {
        setHead(input1.getRaw());
        setCurrentURI(input1.uri);
      } else if (contrastType === EditorViewType.INCOMING) {
        setHead(input2.getRaw());
        setCurrentURI(input2.uri);
      } else if (contrastType === EditorViewType.RESULT) {
        setHead(new MergeEditorInputData(output.uri, 'Result', toRelativePath(output.uri), '').getRaw());
        setCurrentURI(ancestor.uri);
      }
    });

    return () => {
      disposable.dispose();
    };
  }, [mergeEditorService]);

  React.useEffect(() => {
    if (currentURI) {
      commandService.executeCommand<string>(EDITOR_COMMANDS.GET_ENCODING.id, currentURI).then((encoding) => {
        setEncoding(encoding || '');
      });
    }
  }, [currentURI, state]);

  const renderMoreActions = useCallback(() => {
    const menus = menuService.createMenu(MenuId.MergeEditorResultTitleContext);
    const inlineActions = generateMergedInlineActions({ menus });

    return inlineActions
      .filter((action) =>
        contrastType === EditorViewType.RESULT ? true : action.id !== EDITOR_COMMANDS.MERGEEDITOR_RESET.id,
      )
      .map((data: MenuItemNode) => {
        if (data.id === EDITOR_COMMANDS.CHANGE_ENCODING.id && currentURI && encoding) {
          data.updateLabel(encoding.toLocaleUpperCase());
          data.argsTransformer = () => [currentURI];
        }

        return <InlineActionWidget key={data.id} data={data} />;
      });
  }, [contrastType, currentURI, encoding]);

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

const BottomBar: React.FC = () => {
  const mergeEditorService = useInjectable<MergeEditorService>(MergeEditorService);

  const commandService = useInjectable<CommandService>(CommandService);
  const [applyLoading, setApplyLoading] = useState(false);

  const [isAIResolving, setIsAIResolving] = useState(false);
  const logger = useInjectable<ILogger>(ILogger);

  useEffect(() => {
    const dispose = mergeEditorService.onHasIntelligentLoadingChange((isLoading) => {
      setIsAIResolving(isLoading);
    });

    return () => dispose.dispose();
  }, [mergeEditorService]);

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

  const handleAIResolve = useCallback(() => {
    if (isAIResolving) {
      mergeEditorService.stopAllAIResolveConflict();
    } else {
      mergeEditorService.handleAIResolveConflict();
    }
  }, [mergeEditorService, isAIResolving]);

  const dataStore = useInjectable<MappingManagerDataStore>(MappingManagerDataStore);

  const [summary, setSummary] = useState<string>('');
  const [canNavigate, setCanNavigate] = useState<boolean>(false);
  useEffect(() => {
    const debounced = debounce(
      () => {
        setSummary(dataStore.summary());
        setCanNavigate(dataStore.canNavigate());
      },
      16 * 5,
      {
        leading: true,
      },
    );

    const dispose = dataStore.onDataChange(() => {
      debounced();
    });

    debounced();
    return () => dispose.dispose();
  }, [dataStore]);

  const handleReset = useCallback(async () => {
    await mergeEditorService.stopAllAIResolveConflict();
    runWhenIdle(() => {
      commandService.executeCommand(EDITOR_COMMANDS.MERGEEDITOR_RESET.id);
    });
  }, [mergeEditorService]);

  return (
    <MergeActions
      containerClassName={styles.merge_editor_float_container}
      editorType='3way'
      summary={summary}
      onReset={handleReset}
      onSwitchEditor={() => {
        let uri = mergeEditorService.getCurrentEditor()?.getModel()?.uri;
        if (!uri) {
          return;
        }

        if (uri.scheme !== 'file') {
          // replace git:// or any other scheme to file://
          uri = uri.with({
            scheme: 'file',
            path: uri.path,
            query: '',
          });
        }

        commandService.executeCommand(EDITOR_COMMANDS.API_OPEN_EDITOR_COMMAND_ID, uri);
      }}
      canNavigate={canNavigate}
      handlePrev={() => {
        mergeEditorService.resultView.navigateForwards();
      }}
      handleNext={() => {
        mergeEditorService.resultView.navigateBackwards();
      }}
      isAIResolving={isAIResolving}
      onAIResolve={handleAIResolve}
      beforeAddons={
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
      }
      afterAddons={
        <Button
          loading={applyLoading}
          id='merge.editor.action.button.apply'
          size='default'
          className={styles.merge_editor_apply_btn}
          onClick={handleApply}
        >
          {localize('mergeEditor.action.button.apply-and-stash')}
        </Button>
      }
    />
  );
};

/**
 * ! 这个组件不能进行二次渲染，否则会导致 Monaco Editor 无法出现
 */
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
  }, [mergeEditorService]);

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
      <BottomBar />
    </div>
  );
};
