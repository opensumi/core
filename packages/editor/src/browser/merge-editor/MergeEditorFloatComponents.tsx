import React, { useCallback, useEffect, useState } from 'react';

import { Button, Icon } from '@opensumi/ide-components';
import {
  AINativeConfigService,
  CommandRegistry,
  CommandService,
  DisposableStore,
  IContextKeyService,
  MERGE_CONFLICT_COMMANDS,
  SCM_COMMANDS,
  URI,
  Uri,
  localize,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { MergeConflictCommands } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/constants';

import { useEditorDocumentModelRef } from '../hooks/useEditor';
import { DocumentMergeConflict, MergeConflictParser } from '../merge-conflict';
import { ReactEditorComponent } from '../types';

import styles from './merge-editor.module.less';

const gitMergeChangesSet = new Set(['git.mergeChanges']);

export const MergeEditorFloatComponents: ReactEditorComponent<{ uri: URI }> = ({ resource }) => {
  const aiNativeConfigService = useInjectable<AINativeConfigService>(AINativeConfigService);
  const commandService = useInjectable<CommandService>(CommandService);
  const commandRegistry = useInjectable<CommandRegistry>(CommandRegistry);
  const contextKeyService = useInjectable<IContextKeyService>(IContextKeyService);
  const mergeConflictParser: MergeConflictParser = useInjectable(MergeConflictParser);

  const editorModel = useEditorDocumentModelRef(resource.uri);

  const [isVisiable, setIsVisiable] = useState(false);
  const [conflicts, setConflicts] = useState<DocumentMergeConflict[]>([]);

  useEffect(() => {
    const run = () => {
      const mergeChanges = contextKeyService.getValue<Uri[]>('git.mergeChanges') || [];
      const isVisiable = mergeChanges.some((uri) => uri.toString() === resource.uri.toString());
      setIsVisiable((prev) => {
        if (!prev && isVisiable) {
          return true;
        }
        return prev;
      });
    };

    const disposed = contextKeyService.onDidChangeContext(({ payload }) => {
      if (payload.affectsSome(gitMergeChangesSet)) {
        run();
      }
    });
    run();
    return () => disposed.dispose();
  }, [resource]);

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
  const handleOpenMergeEditor = useCallback(async () => {
    const { uri } = resource;

    [SCM_COMMANDS.GIT_OPEN_MERGE_EDITOR, SCM_COMMANDS._GIT_OPEN_MERGE_EDITOR].forEach(({ id: command }) => {
      if (commandRegistry.getCommand(command) && commandRegistry.isEnabled(command)) {
        commandService.executeCommand(command, uri);
      }
    });
  }, [resource]);

  const isSupportAIResolve = useCallback(
    () => aiNativeConfigService.capabilities.supportsConflictResolve,
    [aiNativeConfigService],
  );

  const handlePrev = useCallback(() => {
    commandService.tryExecuteCommand(MergeConflictCommands.Previous);
  }, []);

  const handleNext = useCallback(() => {
    commandService.tryExecuteCommand(MergeConflictCommands.Next);
  }, []);

  const handleAIResolve = useCallback(async () => {
    setIsAIResolving(true);
    if (isAIResolving) {
      await commandService.executeCommand(MERGE_CONFLICT_COMMANDS.AI_ALL_ACCEPT_STOP.id, resource.uri);
    } else {
      await commandService.executeCommand(MERGE_CONFLICT_COMMANDS.AI_ALL_ACCEPT.id, resource.uri);
    }
    setIsAIResolving(false);
  }, [resource, isAIResolving]);

  const handleReset = useCallback(() => {
    commandService.executeCommand(MERGE_CONFLICT_COMMANDS.ALL_RESET.id, resource.uri);
  }, [resource]);

  if (!isVisiable) {
    return null;
  }

  return (
    <div className={styles.merge_editor_float_container}>
      <div className={styles.merge_editor_float_container_info}>剩余未解决冲突 {conflicts.length} 处</div>
      <div className={styles.merge_editor_float_container_operation_bar}>
        <div id='merge.editor.action.button.nav'>
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
          onClick={handleOpenMergeEditor}
        >
          <Icon icon={'swap'} />
          <span>{localize('mergeEditor.open.3way')}</span>
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
      </div>
    </div>
  );
};
