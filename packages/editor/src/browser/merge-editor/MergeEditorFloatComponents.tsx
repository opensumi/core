import React, { useCallback, useEffect, useState } from 'react';

import { Button, Icon } from '@opensumi/ide-components';
import {
  AINativeConfigService,
  CommandRegistry,
  CommandService,
  IContextKeyService,
  SCM_COMMANDS,
  URI,
  Uri,
  localize,
  useInjectable,
} from '@opensumi/ide-core-browser';

import styles from '../editor.module.less';
import { ReactEditorComponent } from '../types';

export const MergeEditorFloatComponents: ReactEditorComponent<{ uri: URI }> = ({ resource }) => {
  const aiNativeConfigService = useInjectable<AINativeConfigService>(AINativeConfigService);
  const commandService = useInjectable<CommandService>(CommandService);
  const commandRegistry = useInjectable<CommandRegistry>(CommandRegistry);
  const contextKeyService = useInjectable<IContextKeyService>(IContextKeyService);

  const [isVisiable, setIsVisiable] = useState(false);

  const gitMergeChangesSet = new Set(['git.mergeChanges']);

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

  const [isAiResolving, setIsAiResolving] = useState(false);
  const handleOpenMergeEditor = useCallback(async () => {
    const { uri } = resource;

    [SCM_COMMANDS.GIT_OPEN_MERGE_EDITOR, SCM_COMMANDS._GIT_OPEN_MERGE_EDITOR].forEach(({ id: command }) => {
      if (commandRegistry.getCommand(command) && commandRegistry.isEnabled(command)) {
        commandService.executeCommand(command, uri);
      }
    });
  }, [resource]);

  const isSupportAiResolve = useCallback(
    () => aiNativeConfigService.capabilities.supportsConflictResolve,
    [aiNativeConfigService],
  );

  const handlePrev = () => {
    commandService.tryExecuteCommand('merge-conflict.previous');
  };

  const handleNext = () => {
    commandService.tryExecuteCommand('merge-conflict.next');
  };

  const handleAIResolve = useCallback(async () => {
    setIsAiResolving(true);
    if (isAiResolving) {
      await commandService.executeCommand('merge-conflict.ai.all-accept-stop', resource.uri);
    } else {
      await commandService.executeCommand('merge-conflict.ai.all-accept', resource.uri);
    }
    setIsAiResolving(false);
  }, [resource, isAiResolving]);

  const handleReset = useCallback(() => {
    commandService.executeCommand('merge-conflict.ai.all-reset', resource.uri);
  }, [resource]);

  if (!isVisiable) {
    return null;
  }

  return (
    <div className={styles.merge_editor_float_container}>
      <div id='merge.editor.action.button.accept'>
        <Button className={styles.merge_conflict_bottom_btn} size='large' onClick={handlePrev}>
          <Icon icon={'left'} />
          <span>{localize('mergeEditor.conflict.prev')}</span>
        </Button>
        <Button className={styles.merge_conflict_bottom_btn} size='large' onClick={handleNext}>
          <span>{localize('mergeEditor.conflict.next')}</span>
          <Icon icon={'right'} />
        </Button>
      </div>
      <span className={styles.line_vertical}></span>
      <Button
        id='merge.editor.open.tradition'
        className={styles.merge_conflict_bottom_btn}
        size='large'
        onClick={handleOpenMergeEditor}
      >
        <Icon icon={'swap'} />
        <span>{localize('mergeEditor.open.3way')}</span>
      </Button>
      <Button id='merge.editor.rest' className={styles.merge_conflict_bottom_btn} size='large' onClick={handleReset}>
        <Icon icon={'discard'} />
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
    </div>
  );
};
