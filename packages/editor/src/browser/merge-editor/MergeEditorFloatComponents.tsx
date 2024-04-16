import React, { useCallback, useEffect, useState } from 'react';

import { Button, Icon } from '@opensumi/ide-components';
import {
  AINativeConfigService,
  CommandRegistry,
  CommandService,
  IContextKeyService,
  MERGE_CONFLICT_COMMANDS,
  SCM_COMMANDS,
  URI,
  Uri,
  localize,
  useInjectable,
} from '@opensumi/ide-core-browser';
import { MergeConflictCommands } from '@opensumi/ide-monaco/lib/browser/contrib/merge-editor/constants';

import styles from '../editor.module.less';
import { ReactEditorComponent } from '../types';

const gitMergeChangesSet = new Set(['git.mergeChanges']);

export const MergeEditorFloatComponents: ReactEditorComponent<{ uri: URI }> = ({ resource }) => {
  const aiNativeConfigService = useInjectable<AINativeConfigService>(AINativeConfigService);
  const commandService = useInjectable<CommandService>(CommandService);
  const commandRegistry = useInjectable<CommandRegistry>(CommandRegistry);
  const contextKeyService = useInjectable<IContextKeyService>(IContextKeyService);

  const [isVisiable, setIsVisiable] = useState(false);

  useEffect(() => {
    const run = () => {
      const mergeChanges = contextKeyService.getValue<Uri[]>('git.mergeChanges') || [];
      setIsVisiable(mergeChanges.some((value) => value.toString() === resource.uri.toString()));
    };

    const disposed = contextKeyService.onDidChangeContext(({ payload }) => {
      if (payload.affectsSome(gitMergeChangesSet)) {
        run();
      }
    });
    run();
    return () => disposed.dispose();
  }, [resource]);

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
      <Button id='merge.editor.rest' className={styles.merge_conflict_bottom_btn} size='default' onClick={handleReset}>
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
    </div>
  );
};
