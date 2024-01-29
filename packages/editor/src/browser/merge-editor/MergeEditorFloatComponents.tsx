import React, { useCallback, useState } from 'react';

import { Button, Icon } from '@opensumi/ide-components';
import {
  AiNativeConfigService,
  CommandRegistry,
  CommandService,
  SCM_COMMANDS,
  URI,
  localize,
} from '@opensumi/ide-core-browser';
import { useInjectable } from '@opensumi/ide-core-browser';

import styles from '../editor.module.less';
import { ReactEditorComponent } from '../types';

export const MergeEditorFloatComponents: ReactEditorComponent<{ uri: URI }> = ({ resource }) => {
  const aiNativeConfigService = useInjectable<AiNativeConfigService>(AiNativeConfigService);
  const commandService = useInjectable<CommandService>(CommandService);
  const commandRegistry = useInjectable<CommandRegistry>(CommandRegistry);
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

  const handleAIResolve = async () => {
    setIsAiResolving(true);

    if (isAiResolving) {
      await commandService.executeCommand('merge-conflict.ai.all-accept-stop', resource.uri);
    } else {
      await commandService.executeCommand('merge-conflict.ai.all-accept', resource.uri);
    }
    setIsAiResolving(false);
  };

  const handleReset = useCallback(() => {
    commandService.executeCommand('merge-conflict.ai.all-reset', resource.uri);
  }, []);
  return (
    <div className={styles.merge_editor_float_container}>
      <Button className={styles.merge_conflict_bottom_btn} size='large' onClick={handlePrev}>
        <Icon icon={'left'} />
        <span>{localize('mergeEditor.conflict.prev')}</span>
      </Button>
      <Button className={styles.merge_conflict_bottom_btn} size='large' onClick={handleNext}>
        <span>{localize('mergeEditor.conflict.next')}</span>
        <Icon icon={'right'} />
      </Button>
      <span className={styles.line_vertical}></span>
      <Button className={styles.merge_conflict_bottom_btn} size='large' onClick={handleOpenMergeEditor}>
        <Icon icon={'swap'} />
        <span>{localize('mergeEditor.open.3way')}</span>
      </Button>
      <Button className={styles.merge_conflict_bottom_btn} size='large' onClick={handleReset}>
        <Icon icon={'diuqi'} />
        <span>{localize('mergeEditor.reset')}</span>
      </Button>
      {isSupportAiResolve() && (
        <Button
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
