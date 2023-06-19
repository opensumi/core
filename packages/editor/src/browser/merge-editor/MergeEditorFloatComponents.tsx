import React, { useCallback } from 'react';

import { Button } from '@opensumi/ide-components';
import { CommandService, SCM_COMMANDS, URI, localize } from '@opensumi/ide-core-browser';
import { useInjectable } from '@opensumi/ide-core-browser';

import styles from '../editor.module.less';
import { ReactEditorComponent } from '../types';

export const MergeEditorFloatComponents: ReactEditorComponent<{ uri: URI }> = ({ resource }) => {
  const commandService = useInjectable<CommandService>(CommandService);

  const handleOpenMergeEditor = useCallback(async () => {
    const { uri } = resource;

    [SCM_COMMANDS.GIT_OPEN_MERGE_EDITOR, SCM_COMMANDS._GIT_OPEN_MERGE_EDITOR].forEach(({ id: command }) => {
      commandService.tryExecuteCommand(command, uri);
    });
  }, [resource]);

  return (
    <div className={styles.merge_editor_float_container}>
      <Button size='large' onClick={handleOpenMergeEditor}>
        {localize('mergeEditor.open.in.editor')}
      </Button>
    </div>
  );
};
