import cls from 'classnames';
import React, { useCallback, useEffect, useState } from 'react';

import { Button, Icon } from '@opensumi/ide-components';
import {
  AINativeConfigService,
  CommandRegistry,
  CommandService,
  DisposableStore,
  MERGE_CONFLICT_COMMANDS,
  SCM_COMMANDS,
  URI,
  localize,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { formatLocalize } from '@opensumi/ide-core-common';
import { MergeConflictCommands } from '@opensumi/ide-core-common/lib/commands/git';

import { useEditorDocumentModelRef } from '../hooks/useEditor';
import { useInMergeChanges } from '../hooks/useInMergeChanges';
import { DocumentMergeConflict, MergeConflictParser } from '../merge-conflict';
import { ReactEditorComponent } from '../types';

import styles from './merge-editor.module.less';

export interface IMergeActionsProps {
  uri?: URI;
  summary: string;
  editorType: '3way' | 'text';
  containerClassName?: string;

  isAIResolving: boolean;
  onAIResolve: () => void;

  handlePrev: () => void;
  handleNext: () => void;

  onReset: () => void;
  onSwitchEditor: () => void;

  beforeAddons?: React.ReactNode;
  afterAddons?: React.ReactNode;
}

export const MergeActions = ({
  uri,
  summary,
  editorType,
  containerClassName,
  onReset,
  onSwitchEditor,
  handleNext,
  handlePrev,
  beforeAddons,
  afterAddons,
  isAIResolving,
  onAIResolve,
}: IMergeActionsProps) => {
  const inMergeChanges = useInMergeChanges(uri?.toString() || '');

  const aiNativeConfigService = useInjectable<AINativeConfigService>(AINativeConfigService);

  const isSupportAIResolve = useCallback(
    () => aiNativeConfigService.capabilities.supportsConflictResolve,
    [aiNativeConfigService],
  );

  return (
    <div className={cls(styles.merge_editor_float_container, containerClassName)}>
      <div className={styles.merge_editor_float_container_info}>
        <div className={styles.merge_editor_nav_operator}>
          <div className={styles.merge_editor_nav_operator_btn} onClick={handlePrev}>
            {localize('mergeEditor.conflict.prev')}
          </div>
          <div className={styles['vertical-divider']} />
          <div className={styles.merge_editor_nav_operator_btn} onClick={handleNext}>
            {localize('mergeEditor.conflict.next')}
          </div>
        </div>
        <div className={styles['vertical-divider']} />
        <div>{summary}</div>
      </div>
      <div className={styles.merge_editor_float_container_operation_bar}>
        {editorType === 'text' && inMergeChanges && (
          <Button
            id='merge.editor.open.3way'
            className={styles.merge_conflict_bottom_btn}
            size='default'
            onClick={onSwitchEditor}
            style={{
              alignSelf: 'flex-start',
            }}
          >
            <Icon icon={'swap'} />
            <span>{localize('mergeEditor.open.3way')}</span>
          </Button>
        )}
        {editorType === '3way' && (
          <Button
            id='merge.editor.open.tradition'
            className={styles.merge_conflict_bottom_btn}
            size='default'
            onClick={onSwitchEditor}
          >
            <Icon icon={'swap'} />
            <span>{localize('mergeEditor.open.tradition')}</span>
          </Button>
        )}
        <div
          style={{
            flex: 1,
          }}
        />
        {beforeAddons ? (
          <>
            {beforeAddons}
            <span className={styles.line_vertical}></span>
          </>
        ) : null}
        <Button id='merge.editor.rest' className={styles.merge_conflict_bottom_btn} size='default' onClick={onReset}>
          <Icon icon={'discard'} />
          <span>{localize('mergeEditor.reset')}</span>
        </Button>
        {isSupportAIResolve() && (
          <Button
            id='merge.editor.conflict.resolve.all'
            size='default'
            className={`${styles.merge_conflict_bottom_btn} ${styles.magic_btn}`}
            onClick={onAIResolve}
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
        {afterAddons ? (
          <>
            <span className={styles.line_vertical}></span>
            {afterAddons}
          </>
        ) : null}
      </div>
    </div>
  );
};

export const MergeEditorFloatComponents: ReactEditorComponent<{ uri: URI }> = ({ resource }) => {
  const { uri } = resource;
  const editorModel = useEditorDocumentModelRef(uri);
  const mergeConflictParser: MergeConflictParser = useInjectable(MergeConflictParser);
  const commandService = useInjectable<CommandService>(CommandService);
  const commandRegistry = useInjectable<CommandRegistry>(CommandRegistry);

  const [isVisiable, setIsVisiable] = useState(false);
  const [conflicts, setConflicts] = useState<DocumentMergeConflict[]>([]);

  useEffect(() => {
    const disposables = new DisposableStore();

    if (editorModel) {
      const { instance } = editorModel;
      const run = () => {
        const conflicts = mergeConflictParser.scanDocument(instance.getMonacoModel());
        if (conflicts.length > 0) {
          setIsVisiable(true);
          setConflicts(conflicts);
        } else {
          setIsVisiable(false);
          setConflicts([]);
        }
      };

      disposables.add(
        editorModel.instance.getMonacoModel().onDidChangeContent(() => {
          run();
        }),
      );
      run();
      return () => {
        disposables.dispose();
      };
    }
  }, [editorModel]);

  const [isAIResolving, setIsAIResolving] = useState(false);
  const handlePrev = useCallback(() => {
    commandService.tryExecuteCommand(MergeConflictCommands.Previous).then(() => {
      // TODO: 编辑器向上滚动一行
    });
  }, []);

  const handleNext = useCallback(() => {
    commandService.tryExecuteCommand(MergeConflictCommands.Next).then(() => {
      // TODO: 编辑器向上滚动一行
    });
  }, []);
  const handleAIResolve = useCallback(async () => {
    setIsAIResolving(true);
    if (isAIResolving) {
      await commandService.executeCommand(MERGE_CONFLICT_COMMANDS.AI_ALL_ACCEPT_STOP.id, uri);
    } else {
      await commandService.executeCommand(MERGE_CONFLICT_COMMANDS.AI_ALL_ACCEPT.id, uri);
    }
    setIsAIResolving(false);
  }, [uri, isAIResolving]);

  if (!isVisiable) {
    return null;
  }

  const summary = formatLocalize('merge-conflicts.merge.conflict.remain', conflicts.length);
  return (
    <MergeActions
      uri={uri}
      editorType='text'
      summary={summary}
      handleNext={handleNext}
      handlePrev={handlePrev}
      isAIResolving={isAIResolving}
      onAIResolve={handleAIResolve}
      onReset={() => {
        commandService.executeCommand(MERGE_CONFLICT_COMMANDS.ALL_RESET.id, uri);
      }}
      onSwitchEditor={() => {
        [SCM_COMMANDS.GIT_OPEN_MERGE_EDITOR, SCM_COMMANDS._GIT_OPEN_MERGE_EDITOR].forEach(({ id: command }) => {
          if (commandRegistry.getCommand(command) && commandRegistry.isEnabled(command)) {
            commandService.executeCommand(command, uri);
          }
        });
      }}
    />
  );
};
