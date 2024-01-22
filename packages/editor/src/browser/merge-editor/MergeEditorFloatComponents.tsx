import React, { useCallback } from 'react';

import { Icon } from '@opensumi/ide-components';
import {
  CommandRegistry,
  CommandService,
  SCM_COMMANDS,
  URI,
  localize,
  useInjectable,
} from '@opensumi/ide-core-browser';

import styles from '../editor.module.less';
import { ReactEditorComponent } from '../types';

export const MergeEditorFloatComponents: ReactEditorComponent<{ uri: URI }> = ({ resource }) => {
  const commandService = useInjectable<CommandService>(CommandService);
  const commandRegistry = useInjectable<CommandRegistry>(CommandRegistry);

  const handleOpenMergeEditor = useCallback(async () => {
    const { uri } = resource;

    [SCM_COMMANDS.GIT_OPEN_MERGE_EDITOR, SCM_COMMANDS._GIT_OPEN_MERGE_EDITOR].forEach(({ id: command }) => {
      if (commandRegistry.getCommand(command) && commandRegistry.isEnabled(command)) {
        commandService.executeCommand(command, uri);
      }
    });
  }, [resource]);

  const handlePrev = () => {
    commandService.tryExecuteCommand('merge-conflict.previous');
  };

  const handleNext = () => {
    commandService.tryExecuteCommand('merge-conflict.next');
  };

  const handleAIResolve = () => {
    // TODO
  };
  return (
    <div className={styles.merge_editor_float_container}>
      <div className={styles.merge_conflict_bottom_btn} onClick={handlePrev}>
        <Icon icon={'left'} />
        <span style={{ marginLeft: '5px' }}>{localize('mergeEditor.conflict.prev')}</span>
      </div>
      <div className={styles.merge_conflict_bottom_btn} onClick={handleNext}>
        <span style={{ marginRight: '5px' }}>{localize('mergeEditor.conflict.next')}</span>
        <Icon icon={'right'} />
      </div>
      <span className={styles.line_vertical}></span>
      <div className={styles.merge_conflict_bottom_btn} onClick={handleOpenMergeEditor}>
        <span>{localize('mergeEditor.open.3way')}</span>
      </div>
      <div className={`${styles.merge_conflict_bottom_btn} ${styles.magic_btn}`} onClick={handleAIResolve}>
        <Icon icon={'magic-wand'} />
        <span>{localize('mergeEditor.conflict.resolve.all')}</span>
      </div>
    </div>
  );
};
